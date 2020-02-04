const bitcoin = require('bitcoinjs-lib');
const utils = require('./utils');
const printObject = require('print-object');
const config = require('./config');
const sysTxParser = require('./sys-tx-parser');
const confirmedTxPruneHeight = 3; // number of blocks after which we discard confirmed tx data
const rpc = utils.getRpc().rpc;

async function handleRawTxMessage(topic, message, txData, io) {
  let hexStr = message.toString('hex');
  let tx = bitcoin.Transaction.fromHex(hexStr);

  // get all the addresses associated w the transaction
  let sysTxAddresses = [];
  let inAddresses = utils.getInputAddressesFromVins(tx.ins);
  let outAddresses = utils.getOutputAddressesFromVouts(tx.outs);
  try {
    tx = await rpc.decodeRawTransaction(hexStr).call();
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
  affectedAddresses = affectedAddresses.filter((a, b) => affectedAddresses.indexOf(a) === b);

  if (!process.env.DEV) {
    console.log('>> ' + topic.toString('utf8'));
    console.log('>> ' + tx.txid);
    console.log('>> ' + affectedAddresses);
  }

  // see if we already have an entry for this tx
  const entryExists = txData.unconfirmedTxToAddressArr.find(entry => entry.txid === tx.txid);
  if (!entryExists) {
    let payload = {addresses: affectedAddresses, txid: tx.txid, tx: tx , hex: hexStr };
    if(tx.systx) {
      payload = {
        ...payload,
        time: Date.now(),
        status: null,
        balances: [],
        timeout: null
      };

      payload.timeout = setTimeout(utils.checkSptTxStatus, config.zdag_check_time * 1000, payload, io);
    }
    txData.unconfirmedTxToAddressArr.push(payload);
    affectedAddresses.forEach(address => {
      console.log('|| UNCONFIRMED NOTIFY:', address, ' of ', tx.txid);
      io.sockets.emit(address, JSON.stringify({topic: 'unconfirmed', message:  { tx, hex: hexStr } }));
    });
  }

  return null;
}

async function handleHashBlockMessage(topic, message, txData, io) {
  let hash = message.toString('hex');
  let block = await rpc.getBlock(hash).call();
  let removedUnconfirmedTxCount = 0;

  if (!process.env.DEV) {
    console.log('>> ' + topic.toString('utf8'));
    console.log('>> Block hash:' + block.hash);
    console.log('>> Contains transactions:' + block.tx);
  }
  
  //notify the hashblock channel of the event ahead of clients on lower-priority channels
  io.sockets.emit('hashblock', JSON.stringify({
    topic: 'hashblock',
    message: {
      blockhash: hash
    }
  }));

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

      // kill any intervals related to spt status check (zdag)
      clearTimeout(entry.timeout);
      return false;
    } else {
      return true;
    }
  });

  // notify clients
  const flattenedNotificationList = {};
  toNotify.forEach(entry => {
    entry.addresses.forEach(address =>{
      if (flattenedNotificationList[address]) {
        flattenedNotificationList[address].push(entry);
      } else {
        flattenedNotificationList[address] = [entry];
      }
    });
  });

  Object.keys(flattenedNotificationList).forEach(key => {
    const entry = flattenedNotificationList[key];
    let  txids = [];
    entry.forEach(tx => txids.push(tx.txid));
    console.log('|| CONFIRMED NOTIFY:', key, 'of', txids);
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

  if (!process.env.DEV) {
    if (removedUnconfirmedTxCount > 0)
      console.log(`Removed ${removedUnconfirmedTxCount} ADDRESS entries`);
  }

  return { unconfirmedTxToAddressArr: txData.unconfirmedTxToAddressArr, confirmedTxIds: txData.blockTxArr };
}

module.exports = {
  handleRawTxMessage,
  handleHashBlockMessage
};

