const dotenv = require('dotenv');
dotenv.config({ silent: true });

module.exports = {
  zmq_address: process.env.ZMQ_ADDRESS || 'tcp://127.0.0.1:28332',
  ws_port: process.env.WA_PORT || 9999,
  rpc: {
    host: "localhost",
    rpcPort: 8368, // This is the port used in the docker-based integration tests, change at your peril
    username: "u",
    password: "p",
    logLevel: 'error'
  }
};
