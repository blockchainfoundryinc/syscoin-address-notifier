const bitcoin = require('bitcoinjs-lib');
const networks = require('./network.config').networks;
var crypto = require('crypto');

module.exports = {
  getInputAddressesFromVins(ins) {
    const result = [];
    ins.forEach((input) => {
      try {
        const p2sh = bitcoin.payments.p2sh({
          witness: input.witness,
          network: networks.mainnet,
          input: input.script
        });

        // Logger.info('Decoded', input.script.toString(), 'to', p2sh.address);
        result.push(p2sh.address)
      } catch (e) {
        // Logger.info('Failed to decode', input.script.toString(), ' s p2sh');
        try {
          const p2wpkh = bitcoin.payments.p2wpkh({
            witness: input.witness,
            network: networks.mainnet,
            input: input.script
          });

          // Logger.info('Decoded', input, 'to', p2wpkh.address);
          result.push(p2wpkh.address)
        } catch (e) {
          // console.error('Failed to decode', input.witness.toString(), 'as p2wpkh');
        }
      }
    });

    return result;
  },
  getOutputAddressesFromVouts(outs) {
    let result = [];
    outs.forEach((out) => {
      let address;
      try {
        address = bitcoin.address.fromOutputScript(out.script, networks.mainnet);
      } catch (e) {}

      if (address) result.push(address);
    });

    return result;
  },
  getUniqueID() {
    var current_date = (new Date()).valueOf().toString();
    var random = Math.random().toString();
    return crypto.createHash('sha1').update(current_date + random).digest('hex');
  },

  getTransactionMemo(txn) {
    const memoHeader = Buffer.from([0xff, 0xff, 0xaf, 0xaf, 0xaa, 0xaa]);
    let memo = null;
    txn = txn.hex ? bitcoin.Transaction.fromHex(txn.hex) : txn;
    for (let key = 0; key < txn.outs.length; key++) {
      const out = txn.outs[key];
      const chunksIn = bitcoin.script.decompile(out.script);
      if (chunksIn[0] !== bitcoin.opcodes.OP_RETURN) {
        continue;
      }
      const scriptValChunks = arraySplit(chunksIn[1], memoHeader);
      if (scriptValChunks.length === 1) {
        continue;
      }
      memo = arrayToString(scriptValChunks[1]);
      break;
      }
    return memo;
  };
};


