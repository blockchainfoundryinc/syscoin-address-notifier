const dotenv = require('dotenv');
dotenv.config({ silent: true });

module.exports = {
  zmq_address: process.env.ZMQ_ADDRESS || 'tcp://127.0.0.1:28332',
  ws_port: process.env.WA_PORT || 9999,
  rpc: {
    host: "localhost",
    rpcPort: 8368, // This is the port used in the docker-based integration tests, change at your peril
    username: "e7e1fea351c65ad2",
    password: "17c6f164187e3ab2b7d3f594f010ab9d",
    logLevel: 'error'
  }
};
