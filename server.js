const http = require('http');
const sockjs = require('sockjs');
const zmq = require('zeromq');
const sock = zmq.socket('sub');
const bitcoin = require('bitcoinjs-lib');
const utils = require('./utils');
const SyscoinRpcClient = require("@syscoin/syscoin-js").SyscoinRpcClient;
const rpcServices = require("@syscoin/syscoin-js").rpcServices;
const printObject = require('print-object');

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

const config = {
  host: "localhost",
  rpcPort: 8368, // This is the port used in the docker-based integration tests, change at your peril
  username: "7d012d9bf253183d",
  password: "912e80993a303db807fdffb97f299531",
  logLevel: 'error'
};
const client = new SyscoinRpcClient(config);
let unconfirmedTxToAddressArr = [];
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

    // create websocket server
    const echo = sockjs.createServer({prefix: '/zmq'});

    // setup websocket
    echo.on('connection', function (conn) {
      console.log("client connected", parseAddress(conn.url));
      conn.syscoinAddress = parseAddress(conn.url);

      conn.on('close', function () {
        console.log("client disconnected");
      });

      sock.on('message', async (topic, message) => {
        switch (topic.toString('utf8')) {
          case TOPIC.RAW_TX:
            await handleRawTxMessage(topic, message, conn);
            logState();
            break;

          case TOPIC.HASH_BLOCK:
            await handleHashBlockMessage(topic, message, conn);
            logState();
            break;
        }
      });
    });

    const server = http.createServer();
    echo.installHandlers(server);
    server.listen(config.ws_port, '0.0.0.0');

    // let external processes know we're ready
    onReady();
  }
};

async function handleRawTxMessage(topic, message, conn) {
  if (!process.env.DEV) {
    console.log(topic.toString('utf8'));
  }

  let hexStr = message.toString('hex');
  let tx = bitcoin.Transaction.fromHex(hexStr);

  // get all the addresses associated w the transaction
  let inAddresses = utils.getInputAddressesFromVins(tx.ins);
  let outAddresses = utils.getOutputAddressesFromVouts(tx.outs);
  let affectedAddresses = [...inAddresses, ...outAddresses].filter((value, index, self) => {
    return self.indexOf(value) === index;
  });

  tx = await rpcServices(client.callRpc).decodeRawTransaction(hexStr).call();

  // add tx to unconfirmed map
  unconfirmedTxMap[tx.txid] = tx;

  // map address to tx
  console.log('UNCONFIRMED TX Notifying:', printObject(affectedAddresses));
  affectedAddresses.forEach(address => {
    // see if we already have an entry for this address/tx
    if (!unconfirmedTxToAddressArr.find(entry => entry.address === address && entry.txid === tx.txid)) {
      unconfirmedTxToAddressArr.push({address, txid: tx.txid});

      if (conn.syscoinAddress === address) {
        conn.write(JSON.stringify({topic: 'address', message: tx.txid}));
      }
    }
  });

  return null;
}

async function handleHashBlockMessage(topic, message, conn) {
  if (!process.env.DEV) {
    console.log(topic.toString('utf8'));
  }

  let hash = message.toString('hex');
  let block = await rpcServices(client.callRpc).getBlock(hash).call();

  // clean up matching map address entries
  let toNotify = [];
  unconfirmedTxToAddressArr = unconfirmedTxToAddressArr.filter(entry => {
    let txMatch = block.tx.find(txid => txid === entry.txid);
    if (txMatch) {
      delete unconfirmedTxMap[entry.txid];
      toNotify.push(entry);
      return false;
    } else {
      return true;
    }
  });

  console.log('CONFIRMED TX Notifying:', printObject(toNotify));

  if (conn) {
    toNotify.forEach(entry => {
      if (conn.syscoinAddress === entry.address) {
        conn.write(JSON.stringify({topic: 'address', message: entry.txid}));
      }
    });
  }

  return null;
}

function logState() {
  console.log('=====');
  console.log('ADDRESS MAP');
  Object.values(unconfirmedTxToAddressArr).forEach(entry => {
    console.log(entry.address, entry.txid);
  });

  console.log('TX MAP');
  Object.keys(unconfirmedTxMap).forEach(txid => {
    console.log(txid);
  });
  console.log('=====\n')
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
