const bitcoin = require('bitcoinjs-lib');
const utils = require('./utils');
const printObject = require('print-object');
const sysTxParser = require('./sys-tx-parser');
const confirmedTxPruneHeight = 3; // number of blocks after which we discard confirmed tx data
const rpcServices = require("@syscoin/syscoin-js").rpcServices;
const SyscoinRpcClient = require("@syscoin/syscoin-js").SyscoinRpcClient;
const config = {
  host: "localhost",
  rpcPort: 8368, // This is the port used in the docker-based integration tests, change at your peril
  username: "u",
  password: "p",
  logLevel: 'error'
};
const client = new SyscoinRpcClient(config);

async function handleRawTxMessage(topic, message, unconfirmedTxToAddressArr, conn) {
  let hexStr = message.toString('hex');
  let tx = bitcoin.Transaction.fromHex(hexStr);

  // get all the addresses associated w the transaction
  let sysTxAddresses = [];
  let inAddresses = utils.getInputAddressesFromVins(tx.ins);
  let outAddresses = utils.getOutputAddressesFromVouts(tx.outs);
  try {
    tx = await rpcServices(client.callRpc).decodeRawTransaction(hexStr).call();
    if (!tx.txid) {
      console.error('\nERROR! Undef txid!', tx, hexStr, '\n');
    }
  } catch (e) {
    console.log("ERROR:", e);
  }

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

  if (!process.env.DEV && !conn) {
    const prefix = conn ? '|| ' : '';
    console.log(prefix + '>> ' + topic.toString('utf8') + ' conn:', conn ? conn.syscoinAddress : 'n/a');
    console.log(prefix + '>> ' + tx.txid);
  }

  // map address to tx
  affectedAddresses.forEach(address => {
    // see if we already have an entry for this address/tx
    if (!unconfirmedTxToAddressArr.find(entry => entry.address === address && entry.txid === tx.txid)) {
      if (conn && conn.syscoinAddress === address) {
        unconfirmedTxToAddressArr.push({address, txid: tx.txid, tx: tx , hex: hexStr });
        console.log('|| UNCONFIRMED NOTIFY:', address, ' of ', tx.txid);
        const message = { tx, hex: hexStr };
        conn.write(JSON.stringify({topic: 'unconfirmed', message }));
      } else if (!conn) {
        unconfirmedTxToAddressArr.push({address, txid: tx.txid, tx });
      }
    }
  });
  return null;
}

async function handleHashBlockMessage(topic, message, unconfirmedTxToAddressArr, blockTxArr, conn) {
  let hash = message.toString('hex');
  let block = await rpcServices(client.callRpc).getBlock(hash).call();
  let removeArrCount = 0;
  let removeTxCount = 0;

  // TRANSACTION MGMT
  // remove old txs from confirmed array
  blockTxArr = blockTxArr.filter(tx => block.height - tx.height < confirmedTxPruneHeight);

  // add new txs to it in memo-ized format
  blockTxArr.push({ height: block.height, hash: block.hash, txs: block.tx });

  // ADDRESS MGMT
  let toNotify = []; //only used if we have a conn

  // remove matching map address entries
  unconfirmedTxToAddressArr = unconfirmedTxToAddressArr.filter(entry => {
    let txMatch = blockTxArr.find(block => block.txs.find(txid => entry.txid === txid));
    if (txMatch) {
      removeArrCount++;
      toNotify.push(entry);
      return false;
    } else {
      return true;
    }
  });

  // notify clients
  if (conn) {
    const flattenedNotificationList = {};
    toNotify.forEach(entry => {
      if (flattenedNotificationList[entry.address]) {
        flattenedNotificationList[entry.address].push(entry.txid);
      } else {
        flattenedNotificationList[entry.address] = [entry.txid];
      }
    });

    if (Object.keys(flattenedNotificationList).length > 0) console.log('|| CONFIRMED NOTIFY:', printObject(flattenedNotificationList));

    Object.keys(flattenedNotificationList).forEach(key => {
      const entry = flattenedNotificationList[key];
      if (conn && conn.syscoinAddress === key) {
        conn.write(JSON.stringify({topic: 'confirmed', message: entry}));
      }
    });
  }

  if (!process.env.DEV && !conn) {
    const prefix = conn ? '|| ' : '';
    console.log(prefix + '>> ' + topic.toString('utf8') + ' conn:', conn ? conn.syscoinAddress : 'n/a');
    console.log(prefix + '>> Block hash:' + block.hash);
    console.log(prefix + '>> Contains transactions:' + block.tx);

    if (removeArrCount > 0 || removeTxCount > 0)
      console.log(`${prefix} Removed ${removeArrCount} ADDRESS entries`);
  }

  return { unconfirmedTxToAddressArr, confirmedTxIds: blockTxArr };
}

module.exports = {
  handleRawTxMessage,
  handleHashBlockMessage
};

