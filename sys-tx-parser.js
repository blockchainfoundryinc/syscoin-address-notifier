const parseAddressesFromSysTx = (sysTx) => {
  const addresses = [];
  switch (sysTx.txtype) {
    case 'assetallocationsend':
      addresses.push(sysTx.sender);
      sysTx.allocations.forEach(allocation => {
        addresses.push(allocation.address);
      });
      break;
  }

  return addresses;
};

module.exports = {
  parseAddressesFromSysTx
};
