const bitcoin = require('syscoinjs-lib');
const utils = require('./utils');
const config = require('./config');
const confirmedTxPruneHeight = 3; // number of blocks after which we discard confirmed tx data
const rpc = utils.getRpc().rpc;

async function handleHashTxMessage(topic, message, txData, io) {
  const hexStr = message.toString('hex');
  let tx = bitcoin.utils.bitcoinjs.Transaction.fromHex(hexStr);
  console.log('tx', tx.systx);

  // get all the addresses associated w the transaction
  let sysTxAddresses = [];
  let isRBF = utils.isRBF(tx.ins);
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

  let affectedAddresses = [ ...inAddresses, ...outAddresses ];
  affectedAddresses = affectedAddresses.filter((a, b) => affectedAddresses.indexOf(a) === b);

  if (!process.env.DEV) {
    console.log('>> ' + topic.toString('utf8'));
    console.log('>> ' + tx.txid);
    console.log('>> ' + affectedAddresses);
  }

  if (isRBF) {
    txData.unconfirmedTxToAddressArr.push({ ...zdagMessage, addresses: affectedAddresses });
    return;
  }

  // see if we already have an entry for this tx
  const entryExists = txData.unconfirmedTxToAddressArr.find(entry => entry.txid === tx.txid);
  let blockHeight = (await rpc.getBlockchainInfo().call())
  blockHeight = blockHeight.blocks;
  console.log("Current blockHeight:", blockHeight);
  if (!entryExists) {
    let payload = {
      addresses: affectedAddresses,
      inAddresses,
      outAddresses,
      txid: tx.txid,
      tx: tx ,
      hex: hexStr,
      unconfirmedHeight: blockHeight
    };

    if(tx.systx) {
      payload = {
        ...payload,
        time: Date.now(),
        status: null,
        balances: [],
        timeout: null,
      };
      
      payload.timeout = setTimeout(utils.checkSptTxStatus, config.zdag_check_time * 1000, payload, txData, io);
    }
    txData.unconfirmedTxToAddressArr.push(payload);

    affectedAddresses.forEach(address => {
      console.log('|| UNCONFIRMED NOTIFY:', address, ' of ', tx.txid);
      io.to(address).emit(address, JSON.stringify({topic: 'unconfirmed', message:  { tx, hex: hexStr } }));
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
  let rejectedTxIds = [];

  // remove matching unconfirmed tx address entries
  txData.unconfirmedTxToAddressArr = txData.unconfirmedTxToAddressArr.filter(entry => {
    let txMatch = txData.blockTxArr.find(block => block.txs.find(txid => entry.txid === txid));
    let isRejectedTransaction = block.height > entry.unconfirmedHeight + config.rejected_tx_block_count;
    if (txMatch || isRejectedTransaction) {
      removedUnconfirmedTxCount++;

      // kill any intervals related to spt status check (zdag)
      clearTimeout(entry.timeout);

      if (txMatch) {
        toNotify.push(entry);
      }

      if (isRejectedTransaction) {
        console.log('Adding rejected tx:', entry.txid);
        rejectedTxIds.push(entry.txid);
      }

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
      io.to(key).emit(key, JSON.stringify({
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
      io.to(key).emit(key, JSON.stringify({
        topic: 'confirmed',
        message: entry[0].txid
      }));
    }
  });

  //notify the rejected_txs channel of the event
  if(rejectedTxIds.length > 0) {
    console.log("Notifying of rejected txids: ", rejectedTxIds);
    io.sockets.emit('rejected_txs', JSON.stringify({
      topic: 'rejected_txs',
      message: {
        txids: rejectedTxIds
      }
    }));
  }

  if (!process.env.DEV) {
    if (removedUnconfirmedTxCount > 0)
      console.log(`Removed ${removedUnconfirmedTxCount} ADDRESS entries`);
  }

  return { unconfirmedTxToAddressArr: txData.unconfirmedTxToAddressArr, confirmedTxIds: txData.blockTxArr };
}

module.exports = {
  handleHashTxMessage,
  handleHashBlockMessage
};

