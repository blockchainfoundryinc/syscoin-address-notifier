const parseAddressesFromSysTx = (sysTx) => {
  const addresses = [];
  // TODO: expand this case for all the systx types!
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
