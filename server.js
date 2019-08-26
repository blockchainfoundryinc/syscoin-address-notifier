const http = require('http');
const sockjs = require('sockjs');
const zmq = require('zeromq');
const sock = zmq.socket('sub');
const bitcoin = require('bitcoinjs-lib');
const utils = require('./utils');
const { logState, handleDevLogging } = require('./logging');
const printObject = require('print-object');
const messageHander = require('./message-handlers');
const TOPIC = require('./message-topic');
const rpcServices = require("@syscoin/syscoin-js").rpcServices;
const SyscoinRpcClient = require("@syscoin/syscoin-js").SyscoinRpcClient;
const config = {
  host: "localhost",
  rpcPort: 8368, // This is the port used in the docker-based integration tests, change at your peril
  username: "7d012d9bf253183d",
  password: "912e80993a303db807fdffb97f299531",
  logLevel: 'error'
};
const client = new SyscoinRpcClient(config);

let globalUnconfirmedTxToAddressArr = [];
let globalBlockTxArr = [];
let globalUnconfirmedTxMap = {};

module.exports = {
  sysClient: client,
  TOPIC,
  blockTxArr: globalBlockTxArr,
  startServer(config = {zmq_address: null, ws_port: null},
              onReady = () => {},
              onReadyToIndex = () => {},
              onError = () => {}) {
    console.log("ZQMSocket starting with config:", JSON.stringify(config));

    if (typeof config.zmq_address !== 'string' && typeof config.ws_port !== 'number') {
      console.log("Bad config. Exiting.");
      process.exit(0);
    }

    // connect to ZMQ
    handleDevLogging(sock);
    sock.connect(config.zmq_address);
    sock.subscribe(TOPIC.RAW_TX);
    sock.subscribe(TOPIC.HASH_BLOCK);

    // setup a persistent handler
    sock.on('message', async (topic, message) => {
      switch (topic.toString('utf8')) {
        case TOPIC.RAW_TX:
          await messageHander.handleRawTxMessage(topic, message, globalUnconfirmedTxMap, globalUnconfirmedTxToAddressArr);
          logState(null, globalUnconfirmedTxToAddressArr, globalUnconfirmedTxMap, globalBlockTxArr);
          break;

        case TOPIC.HASH_BLOCK:
          // setTimeout(doTimeout, 500, topic, message, unconfirmedTxMap, globalUnconfirmedTxToAddressArr);
          let res = await doTimeout(topic, message, globalUnconfirmedTxMap, globalUnconfirmedTxToAddressArr, globalBlockTxArr);
          globalUnconfirmedTxToAddressArr = res.unconfirmedTxToAddressArr;
          globalBlockTxArr = res.confirmed;
          logState(null, globalUnconfirmedTxToAddressArr, globalUnconfirmedTxMap, globalBlockTxArr);
          break;
      }
    });

    // create websocket server
    const websocketServer = sockjs.createServer({prefix: '/zmq'});

    // setup websocket
    websocketServer.on('connection', function (conn) {
      console.log("client connected", parseAddress(conn.url));

      // setup the connection object w additional data
      conn.syscoinAddress = parseAddress(conn.url);
      if (!conn.syscoinAddress) {
        console.log('connection missing address data, kicking:', conn.url);
        conn.close();
      }
      dumpPendingMessagesToClient(conn);

      conn.on('close', function () {
        console.log("client disconnected", conn.syscoinAddress);
        sock.removeListener('message', conn.messageHandler);
      });

      sock.on('message', conn.messageHandler = async (topic, message) => {
        switch (topic.toString('utf8')) {
          case TOPIC.RAW_TX:
            await messageHander.handleRawTxMessage(topic, message, conn.unconfirmedTxMap, conn.unconfirmedTxToAddressArr, conn);
            logState(conn, conn.unconfirmedTxToAddressArr, conn.unconfirmedTxMap, conn.blockTxArr);
            break;

          case TOPIC.HASH_BLOCK:
            // setTimeout(doTimeout, 500, topic, message, conn.unconfirmedTxMap, conn.unconfirmedTxToAddressArr, conn);
            let res = await doTimeout(topic, message, conn.unconfirmedTxMap, conn.unconfirmedTxToAddressArr, conn.blockTxArr, conn);
            conn.unconfirmedTxToAddressArr = res.unconfirmedTxToAddressArr;
            conn.blockTxArr = res.confirmed;
            logState(conn, conn.unconfirmedTxToAddressArr, conn.unconfirmedTxMap, conn.blockTxArr);
            break;
        }
      });
    });

    const server = http.createServer();
    websocketServer.installHandlers(server);
    server.listen(config.ws_port, '0.0.0.0');

    // let external processes know we're ready
    onReady();
  }
};

async function doTimeout(topic, message, unconfirmedTxMap, unconfirmedTxToAddressArr, blockTxArr, conn) {
  if (conn) {
    return await messageHander.handleHashBlockMessage(topic, message, unconfirmedTxMap, unconfirmedTxToAddressArr, blockTxArr, conn);
  } else {
    return await messageHander.handleHashBlockMessage(topic, message, unconfirmedTxMap, unconfirmedTxToAddressArr, blockTxArr);
  }
}

function dumpPendingMessagesToClient(conn) {
  let pendingTxForConn = [];
  globalUnconfirmedTxToAddressArr.forEach(entry => {
    if (entry.address === conn.syscoinAddress) {
      pendingTxForConn.push(entry);
    }
  });

  conn.unconfirmedTxToAddressArr = pendingTxForConn;
  conn.unconfirmedTxMap = { ...globalUnconfirmedTxMap };
  conn.blockTxArr = [ ...globalBlockTxArr ];

  if (pendingTxForConn.length > 0)
    conn.write(JSON.stringify({topic: 'unconfirmed', message: pendingTxForConn.map(entry => ({ tx: entry.tx, hex: entry.hex })) }));
}

function parseAddress(url) {
  return url.substr((url.indexOf('address') + 8));
}

