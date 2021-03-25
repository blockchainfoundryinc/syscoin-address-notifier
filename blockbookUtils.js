const axios = require('axios');
const config = require('./config');

async function getAddress(address, batch = false) {
  const axiosInstance = axios.create({
    timeout: 5000
  });

  let result;
  if (batch) {
    result = axiosInstance.get(`${config.blockbook_url}/api/v2/address/${address}`);
  } else {
    result = await axiosInstance.get(`${config.blockbook_url}/api/v2/address/${address}`);
  }

  console.log('Get address', address, 'result', result);

  return result;
}

module.exports = {
  getAddress
};
