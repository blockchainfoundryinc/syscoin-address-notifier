const bitcoin = require('bitcoinjs-lib');
const networks = require('./network.config').networks;
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
          console.error('Failed to decode', input.witness.toString(), 'as p2wpkh');
        }
      }
    });

    console.info('vin2address:', result);
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
    console.info('vout2address:', result);
    return result;
  }
};


