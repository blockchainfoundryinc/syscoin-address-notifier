const http = require('http');
const sockjs = require('sockjs');
const zmq = require('zeromq');
const sock = zmq.socket('sub');
const bitcoin = require('bitcoinjs-lib');
const utils = require('./utils');

const printObject = require('print-object');
const messageHander = require('./message-handlers');

const TOPIC = {
  RAW_BLOCK: 'rawblock',
  RAW_TX: 'rawtx',
  HASH_BLOCK: 'hashblock',
  HASH_TX: 'hashtx',
  WALLET_STATUS: 'walletstatus',
  ETH_STATUS: 'ethstatus',
  NETWORK_STATUS: 'networkstatus',
  WALLET_RAW_TX: 'walletrawtx'
};

let globalUnconfirmedTxToAddressArr = [];
let unconfirmedTxMap = {};

module.exports = {
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
          await messageHander.handleRawTxMessage(topic, message, unconfirmedTxMap, globalUnconfirmedTxToAddressArr);
          logState();
          break;

        case TOPIC.HASH_BLOCK:
          setTimeout(doTimeout, 500, topic, message, unconfirmedTxMap, globalUnconfirmedTxToAddressArr);
          // logState();
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
      dumpPendingMessagesToClient(conn);

      conn.on('close', function () {
        console.log("client disconnected");
        sock.removeListener('message', conn.messageHandler);
      });

      sock.on('message', conn.messageHandler = async (topic, message) => {
        switch (topic.toString('utf8')) {
          case TOPIC.RAW_TX:
            await messageHander.handleRawTxMessage(topic, message, conn.unconfirmedTxMap, conn.unconfirmedTxToAddressArr, conn);
            logState(conn);
            break;

          case TOPIC.HASH_BLOCK:
            setTimeout(doTimeout.bind(conn), 500, topic, message, conn.unconfirmedTxMap, conn.unconfirmedTxToAddressArr, conn);
            // logState(conn);
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

async function doTimeout(topic, message, unconfirmedTxMap, unconfirmedTxToAddressArr, conn) {
  if (conn) {
    conn.unconfirmedTxToAddressArr = await messageHander.handleHashBlockMessage(topic, message, unconfirmedTxMap, unconfirmedTxToAddressArr, conn);
  } else {
    globalUnconfirmedTxToAddressArr = await messageHander.handleHashBlockMessage(topic, message, unconfirmedTxMap, unconfirmedTxToAddressArr);
  }
  logState(conn);
}

function dumpPendingMessagesToClient(conn) {
  let pendingTxForConn = [];
  globalUnconfirmedTxToAddressArr.forEach(entry => {
    if (entry.address === conn.syscoinAddress) {
      pendingTxForConn.push(entry);
    }
  });

  conn.unconfirmedTxToAddressArr = pendingTxForConn;
  conn.unconfirmedTxMap = { ...unconfirmedTxMap };
  conn.write(JSON.stringify({topic: 'address', message: pendingTxForConn}));
}

function logState(conn) {
  if (!conn) {
    console.log('=====');
    console.log('ADDRESS MAP');
    Object.values(globalUnconfirmedTxToAddressArr).forEach(entry => {
      console.log(entry.address, entry.txid);
    });

    console.log('TX MAP');
    Object.keys(unconfirmedTxMap).forEach(txid => {
      console.log(txid);
    });
    console.log('=====\n')
  } else {
    console.log('|| =====');
    console.log('|| ' + conn.syscoinAddress,' \n|| ADDRESS MAP');
    Object.values(conn.unconfirmedTxToAddressArr).forEach(entry => {
      console.log('|| ' + entry.address, entry.txid);
    });

    console.log('|| TX MAP');
    Object.keys(conn.unconfirmedTxMap).forEach(txid => {
      console.log('|| ' + txid);
    });
    console.log('|| =====\n')
  }
}

function parseAddress(url) {
  return url.substr((url.indexOf('address') + 8));
}

function handleDevLogging(sock) {
  if (process.env.DEV) {
    console.log('dev mode.');
    sock.on('message', function (topic, message) {
      //console.log('[raw] TOPIC:', topic, ' MESSAGE', message);
      switch (topic.toString('utf8')) {
        case TOPIC.NETWORK_STATUS:
        case TOPIC.WALLET_RAW_TX:
        case TOPIC.WALLET_STATUS:
        case TOPIC.ETH_STATUS:
          console.log('[->client] JSON TOPIC:', topic.toString('utf8'), ' MESSAGE', message.toString());
          break;

        default:
          console.log('[~debug~] HEX TOPIC:', topic.toString('utf8'), ' MESSAGE', message.toString('hex'));
      }
    });
  }
}
