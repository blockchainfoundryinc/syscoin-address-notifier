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
    const arraySplit = function (master, find) {
      let lastScanIndex = -1;
      return master.reduce((total, currentValue, currentIndex) => {
        if (currentIndex >= master.length - find.length) {
          total[total.length - 1].push(currentValue);
          return total;
         }
         total = Array.isArray(total) ? total : [total];
        if (arrayStartsWith(master.slice(currentIndex), find)) {
          lastScanIndex = currentIndex + find.length;
          total.push([]);
          return total;
        } else {
          if (currentIndex >= lastScanIndex) {
            total[total.length - 1].push(currentValue);
          }
          return total;
        }
      }, [[]]);
    };
    const arrayStartsWith = function (master, find) {
      let result = true;
      for (let j = 0; j < find.length; j++) {
        if (master[j] !== find[j]) {
          result = false;
          break;
        }
      }
      return result;
    };
    const arrayToString = (array) => {
      let out, i, len, c;
      let char2, char3;
      out = "";
      len = array.length;
      i = 0;
      while (i < len) {
        c = array[i++];
        switch (c >> 4) {
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
          case 7:
            out += String.fromCharCode(c);
            break;
          case 12:
          case 13:
            char2 = array[i++];
            out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
            break;
          case 14:
            char2 = array[i++];
            char3 = array[i++];
            out += String.fromCharCode(((c & 0x0F) << 12) |
              ((char2 & 0x3F) << 6) |
              ((char3 & 0x3F) << 0));
            break;
        }
      }
      return out;
    };
    txn = txn.hex ? bitcoin.Transaction.fromHex(txn.hex) : txn;
    for (let key = 0; key < txn.vout.length; key++) {
      const out = txn.vout[key];
      const chunksIn = bitcoin.script.decompile(Buffer.from(out.scriptPubKey.hex, 'hex'));
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
  },

};

