const TOPIC = require('./message-topic');
const {table} = require('table');

function logState(addr, unconfirmed, blocks, connMap) {

  console.log("Connections");
  console.log(table(Object.keys(connMap)));
  console.log("Address Maps");
  console.log(table(unconfirmed));
  console.log("Block History");
  console.log(table(blocks));

  /*const prefix = conn ? '|| ' : '';
    console.log(`${prefix}=====`);
    console.log(`${prefix}ADDRESS MAP`);
    Object.values(addr).forEach(entry => {
      console.log(prefix, entry.address, entry.txid);
    });

    console.log(`${prefix}BLOCK MAP`);
    Object.values(blocks).forEach(block => {
      console.log(`${prefix}${block.height} ${block.txs}`);
    });
    console.log(`${prefix}=====\n`);*/
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
