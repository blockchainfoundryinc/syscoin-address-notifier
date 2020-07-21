const TOPIC = require('./message-topic');

function logState(txData, connMap) {

  const prefix = '';
  const indent = '  ';
  console.log(`${prefix}=====`);
  console.log("** Connections **");
  console.log(indent + Object.keys(connMap));

  console.log("** Address Maps **");
  if(txData.unconfirmedTxToAddressArr.length > 0) {
    Object.values(txData.unconfirmedTxToAddressArr).forEach(entry => {
      let shortAddresses = entry.addresses.map(address => address.substr(0,8));
      console.log(indent, shortAddresses, entry.txid, 'status:', entry.status, 'mempoolHeight:', entry.unconfirmedHeight);
    });
  } else {
    console.log(indent + '[]');
  }

  console.log("**  Block History **");
  if(txData.blockTxArr.length > 0) {
    Object.values(txData.blockTxArr).forEach(block => {
      let shortTxIds = block.txs.map(txid => txid.substr(0,8));
      console.log(`${indent}${block.height} ${shortTxIds}`);
    });
  } else {
    console.log(indent + '[]');
  }

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
