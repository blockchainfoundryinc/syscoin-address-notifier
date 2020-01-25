const bitcoin = require('bitcoinjs-lib');
const utils = require('./utils');
const printObject = require('print-object');
const sysTxParser = require('./sys-tx-parser');
const confirmedTxPruneHeight = 3; // number of blocks after which we discard confirmed tx data
const rpcServices = require("@syscoin/syscoin-js").rpcServices;
const SyscoinRpcClient = require("@syscoin/syscoin-js").SyscoinRpcClient;
const config = require('./config');
const client = new SyscoinRpcClient(config.rpc);


async function handleRawTxMessage(topic, message, txData, io) {
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

  let affectedAddresses = [ ...inAddresses, ...outAddresses, ...sysTxAddresses ];

  if(tx.systx) {
    txData.sptTxArr[tx.txid] = {
      txid: tx.txid,
      addresses: affectedAddresses,
      systx: tx.systx,
      time: Date.now(),
      status: null,
      balance: null
    };
  }

  if (!process.env.DEV && !socket) {
    const prefix = socket ? '|| ' : '';
    console.log(prefix + '>> ' + topic.toString('utf8') + ' socket:', socket ? socket.syscoinAddress : 'n/a');
    console.log(prefix + '>> ' + tx.txid);
  }

  // map address to tx
  affectedAddresses.forEach(address => {
    // see if we already have an entry for this address/tx
    if (!txData.unconfirmedTxToAddressArr.find(entry => entry.address === address && entry.txid === tx.txid)) {
      txData.unconfirmedTxToAddressArr.push({address, txid: tx.txid, tx: tx , hex: hexStr });
      console.log('|| UNCONFIRMED NOTIFY:', address, ' of ', tx.txid);
      const message = { tx, hex: hexStr };
      io.sockets.emit(address, JSON.stringify({topic: 'unconfirmed', message }));
    }
  });
  return null;
}

async function handleHashBlockMessage(topic, message, txData, io) {
  let hash = message.toString('hex');
  let block = await rpcServices(client.callRpc).getBlock(hash).call();
  let removedUnconfirmedTxCount = 0;
  let removedSptTxCount = 0;

  // TRANSACTION MGMT
  // remove old txs from confirmed array
  txData.blockTxArr = txData.blockTxArr.filter(tx => block.height - tx.height < confirmedTxPruneHeight);

  // add new txs to it in memo-ized format
  txData.blockTxArr.push({ height: block.height, hash: block.hash, txs: block.tx });

  // ADDRESS MGMT
  let toNotify = [];

  // remove matching unconfirmed tx address entries
  txData.unconfirmedTxToAddressArr = txData.unconfirmedTxToAddressArr.filter(entry => {
    let txMatch = txData.blockTxArr.find(block => block.txs.find(txid => entry.txid === txid));
    if (txMatch) {
      removedUnconfirmedTxCount++;
      toNotify.push(entry);
      return false;
    } else {
      return true;
    }
  });

  // remove matching spt tx entries
  txData.sptTxArr = txData.sptTxArr.filter(entry => {
    let txMatch = txData.blockTxArr.find(block => block.txs.find(txid => entry.txid === txid));
    if (txMatch) {
      removedSptTxCount++;
      return false;
    } else {
      return true;
    }
  });

  // notify clients
  const flattenedNotificationList = {};
  toNotify.forEach(entry => {
    if (flattenedNotificationList[entry.address]) {
      flattenedNotificationList[entry.address].push(entry);
    } else {
      flattenedNotificationList[entry.address] = [entry];
    }
  });

  if (Object.keys(flattenedNotificationList).length > 0) console.log('|| CONFIRMED NOTIFY:', printObject(flattenedNotificationList));

  Object.keys(flattenedNotificationList).forEach(key => {
    const entry = flattenedNotificationList[key];
    if (entry[0].tx.systx && entry[0].tx.systx.txtype === 'assetallocationsend') {
      let allocations = entry[0].tx.systx.allocations;
      let memo = utils.getTransactionMemo(entry[0].tx);
      io.sockets.emit(key, JSON.stringify({
        topic: 'confirmed',
        message: {
          txid: entry[0].txid,
          sender: entry[0].tx.systx.sender,
          receivers: entry[0].tx.systx.allocations,
          asset_guid: entry[0].tx.systx.asset_guid,
          amount: entry[0].tx.systx.total,
          memo: memo
        }
      }));
    } else {
      io.sockets.emit(key, JSON.stringify({
        topic: 'confirmed',
        message: entry[0].txid
      }));
    }
  });

  if (!process.env.DEV && !socket) {
    const prefix = socket ? '|| ' : '';
    console.log(prefix + '>> ' + topic.toString('utf8') + ' conn:', socket ? socket.syscoinAddress : 'n/a');
    console.log(prefix + '>> Block hash:' + block.hash);
    console.log(prefix + '>> Contains transactions:' + block.tx);

    if (removedUnconfirmedTxCount > 0)
      console.log(`${prefix} Removed ${removedUnconfirmedTxCount} ADDRESS entries`);

    if (removedSptTxCount > 0)
      console.log(`${prefix} Removed ${removedUnconfirmedTxCount} SPT entries`);
  }

  return { unconfirmedTxToAddressArr: txData.unconfirmedTxToAddressArr, confirmedTxIds: txData.blockTxArr };
}

module.exports = {
  handleRawTxMessage,
  handleHashBlockMessage
};

