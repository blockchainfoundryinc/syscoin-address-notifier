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
          await Object.values(connectionMap).forEachAsync(async socket => {
            await messageHander.handleRawTxMessage(topic, message, socket.unconfirmedTxToAddressArr, socket);
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
          await Object.values(connectionMap).forEachAsync(async socket => {
            let res = await doTimeout(topic, message, socket.unconfirmedTxToAddressArr, socket.blockTxArr, socket);
            socket.unconfirmedTxToAddressArr = res.unconfirmedTxToAddressArr;
            socket.blockTxArr = res.confirmedTxIds;
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

      // associate client data with socket connection
      const handshakeData = socket.request;
      const address = handshakeData._query['address'];
      console.log('setaddress', socket.conn.id, address);
      socket.syscoinAddress = address;
      connectionMap[`${socket.syscoinAddress}-${socket.conn.id}`] = socket;

      if (!socket.syscoinAddress) {
        console.log('connection missing address data, kicking:', socket.request.url);
        socket.disconnect();
      }

      dumpPendingMessagesToClient(socket);

      socket.on('disconnect', function () {
        console.log("client disconnected", socket.syscoinAddress);
        delete connectionMap[`${socket.syscoinAddress}-${socket.conn.id}`];
      });
    });

    // let external processes know we're ready
    onReady();
  }
};

async function doTimeout(topic, message, unconfirmedTxToAddressArr, blockTxArr, socket) {
  if (socket) {
    return await messageHander.handleHashBlockMessage(topic, message, unconfirmedTxToAddressArr, blockTxArr, socket);
  } else {
    return await messageHander.handleHashBlockMessage(topic, message, unconfirmedTxToAddressArr, blockTxArr);
  }
}

function dumpPendingMessagesToClient(socket) {
  let pendingTxForSocket = [];
  globalUnconfirmedTxToAddressArr.forEach(entry => {
    if (entry.address === socket.syscoinAddress) {
      pendingTxForSocket.push(entry);
    }
  });

  socket.unconfirmedTxToAddressArr = pendingTxForSocket;
  socket.blockTxArr = [ ...globalBlockTxArr ];

  if (pendingTxForSocket.length > 0) {
    pendingTxForSocket.forEach( entry => {
      socket.emit(socket.syscoinAddress, JSON.stringify({topic: 'unconfirmed', message: {tx: entry.tx, hex: entry.hexStr}}));
    });
  }
}
