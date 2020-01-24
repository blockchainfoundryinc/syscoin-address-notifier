const http = require('http');
const arraync = require('arraync');
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
const config = require('./config');
const client = new SyscoinRpcClient(config.rpc);
const io = require('socket.io')(config.ws_port);


let globalUnconfirmedTxToAddressArr = [];
let globalBlockTxArr = [];
let connectionMap = {};

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
          await messageHander.handleRawTxMessage(topic, message, globalUnconfirmedTxToAddressArr);
          await Object.values(connectionMap).forEachAsync(async conn => {
            await messageHander.handleRawTxMessage(topic, message, conn.unconfirmedTxToAddressArr, conn);
            // logState(conn, conn.unconfirmedTxToAddressArr, conn.blockTxArr, connectionMap);
            return null;
          });

          logState(null, globalUnconfirmedTxToAddressArr, globalBlockTxArr, connectionMap);

          break;

        case TOPIC.HASH_BLOCK:
          // setTimeout(doTimeout, 500, topic, message, unconfirmedTxMap, globalUnconfirmedTxToAddressArr);
          let res = await doTimeout(topic, message, globalUnconfirmedTxToAddressArr, globalBlockTxArr);
          globalUnconfirmedTxToAddressArr = res.unconfirmedTxToAddressArr;
          globalBlockTxArr = res.confirmedTxIds;
          await Object.values(connectionMap).forEachAsync(async conn => {
            let res = await doTimeout(topic, message, conn.unconfirmedTxToAddressArr, conn.blockTxArr, conn);
            conn.unconfirmedTxToAddressArr = res.unconfirmedTxToAddressArr;
            conn.blockTxArr = res.confirmedTxIds;
            //logState(conn, conn.unconfirmedTxToAddressArr, conn.blockTxArr, connectionMap);
            return null;
          });

          logState(null, globalUnconfirmedTxToAddressArr, globalBlockTxArr, connectionMap);

          break;
      }
    });

    // setup websocket
    io.on('connection', function (socket) {
      console.log("client connected", socket.conn.id);

      var handshakeData = socket.request;
      const address = handshakeData._query['address'];
      console.log('setaddress', socket.conn.id, address);
      socket.syscoinAddress = address;

      if (!socket.syscoinAddress) {
        console.log('connection missing address data, kicking:', socket.request.url);
        socket.disconnect();
      }
      connectionMap[socket.conn.id] = socket;

      // TODO: REENSTATE THIS!
      //dumpPendingMessagesToClient(socket);

      socket.on('disconnect', function () {
        console.log("client disconnected", socket.syscoinAddress);
        delete connectionMap[socket.conn.id];
      });
    });

    //const server = http.createServer();
    //websocketServer.installHandlers(server);
    //server.listen(config.ws_port, '0.0.0.0');

    // let external processes know we're ready
    onReady();
  }
};

async function doTimeout(topic, message, unconfirmedTxToAddressArr, blockTxArr, conn) {
  if (conn) {
    return await messageHander.handleHashBlockMessage(topic, message, unconfirmedTxToAddressArr, blockTxArr, conn);
  } else {
    return await messageHander.handleHashBlockMessage(topic, message, unconfirmedTxToAddressArr, blockTxArr);
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
  conn.blockTxArr = [ ...globalBlockTxArr ];

  if (pendingTxForConn.length > 0) {
    pendingTxForConn.forEach( entry => {
      conn.write(JSON.stringify({topic: 'unconfirmed', message: {tx: entry.tx, hex: entry.hexStr}}));
    });
  }
}

function parseAddress(url) {
  return url.substring((url.indexOf('address') + 8), url.indexOf('&') !== -1 ? url.indexOf('&') : undefined);
}

