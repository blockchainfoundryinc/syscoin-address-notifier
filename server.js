const fs = require('fs');
const zmq = require('zeromq');
const sock = zmq.socket('sub');
const { logState, handleDevLogging } = require('./logging');
const messageHander = require('./message-handlers');
const TOPIC = require('./message-topic');
const config = require('./config');
const txData = {
  unconfirmedTxToAddressArr: [],
  blockTxArr: []
};
let connectionMap = {};
let io;
if (config.use_ssl) {
  console.log('USING SSL.');
  const options = {
    key: fs.readFileSync(config.ssl_key),
    cert: fs.readFileSync(config.ssl_cert)
  };
  const app = require('https').createServer(options);
  io = require('socket.io')(app);
} else {
  console.log('NOT USING SSL.');
  io = require('socket.io')(config.ws_port);
}

module.exports = {
  startServer(config = {zmq_address: null, ws_port: null},
              onReady = () => {},
              onReadyToIndex = () => {},
              onError = () => {}) {
    console.log("Zdag Server starting with config:", JSON.stringify(config));

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
    sock.on('message', handleZmqSockMessage);

    // setup websocket
    io.on('connection', handleIoConnection);

    // let external processes know we're ready
    onReady();
  }
};

function dumpPendingMessagesToClient(socket) {
  console.log('Dumping pending messages for:', socket.syscoinAddress);
  let pendingTxForSocket = [];
  txData.unconfirmedTxToAddressArr.forEach(entry => {
    if (entry.addresses.includes(socket.syscoinAddress)) {
      pendingTxForSocket.push(entry);
    }
  });

  if (pendingTxForSocket.length > 0) {
    pendingTxForSocket.forEach( entry => {
      let message = {
        tx: entry.tx,
        hex: entry.hex
      };

      if(entry.tx.systx) {
        message = {
          ...message,
          status: entry.status,
          balance: entry.balances[socket.syscoinAddress]
        }
      }

      socket.emit(socket.syscoinAddress, JSON.stringify({
        topic: 'unconfirmed',
        message
      }));
    });
  }
}

async function handleZmqSockMessage(topic, message) {
  switch (topic.toString('utf8')) {
    case TOPIC.RAW_TX:
      await messageHander.handleRawTxMessage(topic, message, txData, io);
      logState(txData, connectionMap);
      break;

    case TOPIC.HASH_BLOCK:
      let res = await messageHander.handleHashBlockMessage(topic, message, txData, io);
      txData.unconfirmedTxToAddressArr = res.unconfirmedTxToAddressArr;
      txData.blockTxArr = res.confirmedTxIds;
      logState(txData, connectionMap);
      break;
  }
}

function handleIoConnection(socket) {
  // associate client data with socket connection
  const address = socket.request._query['address'];
  console.log("client connected", socket.conn.id, address);
  if (address) {
    socket.join(address);
    socket.syscoinAddress = address;
  }

  connectionMap[address ? `${socket.syscoinAddress}-${socket.conn.id}` : socket.conn.id] = socket;
  dumpPendingMessagesToClient(socket);

  socket.on('disconnect', function () {
    console.log("client disconnected", `${socket.syscoinAddress}-${socket.conn.id}`);
    delete connectionMap[`${socket.syscoinAddress}-${socket.conn.id}`];
  });
}
