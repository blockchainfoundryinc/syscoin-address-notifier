const TOPIC = require('./message-topic');
const {table} = require('table');

function logState(txData, connMap) {

  const prefix = '';
  console.log(`${prefix}=====`);
  console.log("Connections");
  console.log(Object.keys(connMap));
  console.log("Address Maps");
  Object.values(txData.unconfirmedTxToAddressArr).forEach(entry => {
    console.log(entry.address, entry.txid);
  });
  console.log("Zdag Maps");
  Object.values(txData.sptTxArr).forEach(tx => {
    console.log(`${tx.txid} ${tx.status}`);
  });
  console.log("Block History");
  Object.values(txData.blockTxArr).forEach(block => {
    console.log(`${block.height} ${block.txs}`);
  });

  console.log(`${prefix}=====\n`);
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


module.exports = {
  handleDevLogging,
  logState
};
