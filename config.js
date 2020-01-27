const dotenv = require('dotenv');
dotenv.config({ silent: true });

module.exports = {
  zmq_address: process.env.ZMQ_ADDRESS || 'tcp://127.0.0.1:28332',
  ws_port: process.env.WA_PORT || 9999,
  zdag_check_time: process.env.ZDAG_CHECK_TIME || 10,
  rpc: {
    host: process.env.RPC_HOST || "localhost",
    rpcPort: process.env.RPC_PORT || 8368, // This is the port used in the docker-based integration tests, change at your peril
    username: process.env.RPC_USER || "u",
    password: process.env.RPC_PASS || "p",
    logLevel: process.env.LOG_LEVEL || 'error'
  }
};
