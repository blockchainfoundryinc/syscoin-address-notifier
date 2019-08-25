const bitcoin = require('bitcoinjs-lib');
const utils = require('./utils');
const printObject = require('print-object');
const SyscoinRpcClient = require("@syscoin/syscoin-js").SyscoinRpcClient;
const rpcServices = require("@syscoin/syscoin-js").rpcServices;
const sysTxParser = require('./sys-tx-parser');
const config = {
  host: "localhost",
  rpcPort: 8368, // This is the port used in the docker-based integration tests, change at your peril
  username: "7d012d9bf253183d",
  password: "912e80993a303db807fdffb97f299531",
  logLevel: 'error'
};
const client = new SyscoinRpcClient(config);

async function handleRawTxMessage(topic, message, unconfirmedTxMap, unconfirmedTxToAddressArr, conn) {
  let hexStr = message.toString('hex');
  let tx = bitcoin.Transaction.fromHex(hexStr);

  // get all the addresses associated w the transaction
  let sysTxAddresses = [];
  let inAddresses = utils.getInputAddressesFromVins(tx.ins);
  let outAddresses = utils.getOutputAddressesFromVouts(tx.outs);
  tx = await rpcServices(client.callRpc).decodeRawTransaction(hexStr).call();
  if (tx.systx) {
    sysTxAddresses = sysTxParser.parseAddressesFromSysTx(tx.systx);
  }

  let affectedAddresses = [ ...inAddresses, ...outAddresses, ...sysTxAddresses ].filter((value, index, self) => {
    if (!conn) {
      return self.indexOf(value) === index;
    } else {
      return conn.syscoinAddress === value && self.indexOf(value) === index;
    }
  });

  // add tx to unconfirmed map
  if (!conn || affectedAddresses.find(entry => entry === conn.syscoinAddress))
    unconfirmedTxMap[tx.txid] = tx;

  if (!process.env.DEV) {
    const prefix = conn ? '|| ' : '';
    console.log(prefix + '>> ' + topic.toString('utf8') + ' conn:', conn ? conn.syscoinAddress : 'n/a');
  }

  // map address to tx
  affectedAddresses.forEach(address => {
    // see if we already have an entry for this address/tx
    if (!unconfirmedTxToAddressArr.find(entry => entry.address === address && entry.txid === tx.txid)) {
      if (conn && conn.syscoinAddress === address) {
        unconfirmedTxToAddressArr.push({address, txid: tx.txid});
        console.log('|| UNCONFIRMED TX Notifying:', address, ' of ', tx.txid);
        conn.write(JSON.stringify({topic: 'unconfirmed', message: tx.txid}));
      } else if (!conn) {
        unconfirmedTxToAddressArr.push({address, txid: tx.txid});
      }
    }
  });

  return null;
}

async function handleHashBlockMessage(topic, message, unconfirmedTxMap, unconfirmedTxToAddressArr, conn) {
  let hash = message.toString('hex');
  let block = await rpcServices(client.callRpc).getBlock(hash).call();
  let removeArrCount = 0;
  let removeTxCount = 0;

  // clean up matching map address entries
  let toNotify = [];
  unconfirmedTxToAddressArr = unconfirmedTxToAddressArr.filter(entry => {
    let txMatch = block.tx.find(txid => txid === entry.txid);
    if (txMatch) {
      removeArrCount ++;
      toNotify.push(entry);
      return false;
    } else {
      return true;
    }
  });

  // cleanup the tx array in case there are coinbase txs or such that don't map to an address
  block.tx.forEach(txid => {
    if (unconfirmedTxMap[txid]) removeTxCount ++;
    delete unconfirmedTxMap[txid]
  });

  if (!process.env.DEV) {
    const prefix = conn ? '|| ' : '';
    console.log(prefix + '>> ' + topic.toString('utf8') + ' conn:', conn ? conn.syscoinAddress : 'n/a');
    console.log(prefix + '>> ' + block.tx);

    if (removeArrCount > 0 || removeTxCount > 0)
      console.log(`${prefix} Removed ${removeArrCount} ADDRESS entries and ${removeTxCount} TX entries`);
  }

  if (conn) {
    if (toNotify.length > 0) console.log('|| CONFIRMED TX Notifying:', printObject(toNotify));
    toNotify.forEach(entry => {
      if (conn && conn.syscoinAddress === entry.address) {
        conn.write(JSON.stringify({topic: 'confirmed', message: entry.txid}));
      }
    });
  }

  return unconfirmedTxToAddressArr;
}

module.exports = {
  handleRawTxMessage,
  handleHashBlockMessage
};

