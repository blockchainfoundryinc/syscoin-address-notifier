const server = require('./server');
console.log("Zdag Server Wrapper");

module.exports.startServer = function(config, onReady ,onReadyToIndex ,onError) {
  server.startServer(...arguments);
};

const config = require('./config');
this.startServer(config);



