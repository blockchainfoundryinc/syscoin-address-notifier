# Syscoin Websocket
Socket.io websocket server for surfacing realtime events from the Syscoin blockchain. Websocket subscribers can recieve information about the following events:
* New blocks
* New unconfirmed transactions
* Zdag events relative to SPT transactions
* New confirmed transactions


Installation
------------
```
git clone http://www.github.com/blockchainfoundryinc/syscoin-websocket
cd syscoin-websocket
npm install
npm run start
```


Configuration
-------------
Configuration is controlled by `config.js` and can also be modified through environmental variables / `.env`.

* `zmq_address` -  Address ZMQ messages are published to by the local Syscoin RPC. Default: `tcp://127.0.0.1:28332`.
* `ws_port` -  Port the websocket server will run on. Default: `9999`.
* `zdag_check_time` - Time in seconds to wait for zdag status checks on a per-transaction basis. Default: `10`.
* `rpc` - Configuration for local Syscoin RPC server.

Syscoin Core requires the following zmq configuration in syscoin.conf:
```
zmqpubhashblock=tcp://127.0.0.1:28332
zmqpubrawtx=tcp://127.0.0.1:28332
```


Subscribing as a Client
-----------
Applications can subscribe to syscoin-websocket using syscoin-websocket-client (recommended) or any socket.io client. When subscribing pass the query string parameter 
`address` to further identify concurrently connected clients.

```
const socket = io(url, { query: `address=sys1q7vkc0zmjhd4njv56a3z6rp3em79kwrnzvk9mr3` });
```

### Event Channels
Clients can listen for `hashblock` channel for events or events specific to an address by subscribing to that address as a channel.

_Subscribing to the `hashblock` channel:_
```
socket.on('hahsblock', function (msg) { ... });
```

_Subscribing to an address channel `sys1q7vkc0zmjhd4njv56a3z6rp3em79kwrnzvk9mr3`:_
```
socket.on('sys1q7vkc0zmjhd4njv56a3z6rp3em79kwrnzvk9mr3', function (msg) { ... });
```


Sample Output
-------------
**Address Channel `sys1q7vkc0zmjhd4njv56a3z6rp3em79kwrnzvk9mr3`:**

For non-assetallocationsend transactions:
```
{"topic":"confirmed","message":"71d56b617b747e53d68c267650449d759447a37719efd1324dbad10609234e31"}
```

For assetallocationsend transactions there will be 3 messages per transaction:

1. Unconfirmed transaction message
```
{"topic":"unconfirmed","message":{"tx":{"txid":"2e794fff6f57be647535d7ca809096ba65c829f44f7d48b0f610aa9cf9974a0b","hash":"4ba331fb8c00b38b83ff0fabfc04b011a6290d0194a91767bd5dc16c80f19d0f","version":29704,"size":337,"vsize":256,"weight":1021,"locktime":0,"vin":[{"txid":"f33629fcb5ef05389fdde65d96fd7f689590f0b2d0c2f4af32c93c196e70a248","vout":2,"scriptSig":{"asm":"","hex":""},"txinwitness":["304402203439c0505151f90e27c1978a626b1bc69aee994a6c55007f5887619dc2a44dbe02201daef7530dd95a2b8a0191269bb2b70ffb8e74083e4524462f5c769d6245188401","039745c963684d6667b9b799a8c4f5841e1144b11003f7e70619d0a34723ca9b7f"],"sequence":4294967294}],"vout":[{"value":0.0000098,"n":0,"scriptPubKey":{"asm":"0 20066f0d6e872c01dccf73c709a24539d3fbf36b","hex":"001420066f0d6e872c01dccf73c709a24539d3fbf36b","reqSigs":1,"type":"witness_v0_keyhash","addresses":["sys1qyqrx7rtwsukqrhx0w0rsngj988flhumtdj32gw"]}},{"value":636.40318427,"n":1,"scriptPubKey":{"asm":"0 02e001487a7aa6e5f4c25bbb6ce8b0f04e6f5835","hex":"001402e001487a7aa6e5f4c25bbb6ce8b0f04e6f5835","reqSigs":1,"type":"witness_v0_keyhash","addresses":["sys1qqtsqzjr602nwtaxztwake69s7p8x7kp4m8twvf"]}},{"value":0,"n":2,"scriptPubKey":{"asm":"OP_RETURN e7126114001402e001487a7aa6e5f4c25bbb6ce8b0f04e6f583502001420066f0d6e872c01dccf73c709a24539d3fbf36b00e1f50500000000001474cea0887d8089fb855759e2d0a3410c8507d44540420f000000000000ffffafafaaaa74657374206d656d6f","hex":"6a4c67e7126114001402e001487a7aa6e5f4c25bbb6ce8b0f04e6f583502001420066f0d6e872c01dccf73c709a24539d3fbf36b00e1f50500000000001474cea0887d8089fb855759e2d0a3410c8507d44540420f000000000000ffffafafaaaa74657374206d656d6f","type":"nulldata"}}],"systx":{"txtype":"assetallocationsend","asset_allocation":"341906151-sys1qqtsqzjr602nwtaxztwake69s7p8x7kp4m8twvf","asset_guid":341906151,"symbol":"AGXS","txid":"2e794fff6f57be647535d7ca809096ba65c829f44f7d48b0f610aa9cf9974a0b","height":0,"sender":"sys1qqtsqzjr602nwtaxztwake69s7p8x7kp4m8twvf","allocations":[{"address":"sys1qyqrx7rtwsukqrhx0w0rsngj988flhumtdj32gw","amount":1},{"address":"sys1qwn82pzraszylhp2ht83dpg6ppjzs04z9jkce7f","amount":0.01}],"total":1.01,"blockhash":"0000000000000000000000000000000000000000000000000000000000000000"}},"hex":"0874000000010148a2706e193cc932aff4c2d0b2f09095687ffd965de6dd9f3805efb5fc2936f30200000000feffffff03d40300000000000016001420066f0d6e872c01dccf73c709a24539d3fbf36bdb3142d10e00000016001402e001487a7aa6e5f4c25bbb6ce8b0f04e6f583500000000000000006a6a4c67e7126114001402e001487a7aa6e5f4c25bbb6ce8b0f04e6f583502001420066f0d6e872c01dccf73c709a24539d3fbf36b00e1f50500000000001474cea0887d8089fb855759e2d0a3410c8507d44540420f000000000000ffffafafaaaa74657374206d656d6f0247304402203439c0505151f90e27c1978a626b1bc69aee994a6c55007f5887619dc2a44dbe02201daef7530dd95a2b8a0191269bb2b70ffb8e74083e4524462f5c769d624518840121039745c963684d6667b9b799a8c4f5841e1144b11003f7e70619d0a34723ca9b7f00000000"}}
```

2. Zdag status message (update to unconfirmed state). Note the additional balance and status properties:
```
{"topic":"unconfirmed","message":{"tx":{"txid":"2e794fff6f57be647535d7ca809096ba65c829f44f7d48b0f610aa9cf9974a0b","hash":"4ba331fb8c00b38b83ff0fabfc04b011a6290d0194a91767bd5dc16c80f19d0f","version":29704,"size":337,"vsize":256,"weight":1021,"locktime":0,"vin":[{"txid":"f33629fcb5ef05389fdde65d96fd7f689590f0b2d0c2f4af32c93c196e70a248","vout":2,"scriptSig":{"asm":"","hex":""},"txinwitness":["304402203439c0505151f90e27c1978a626b1bc69aee994a6c55007f5887619dc2a44dbe02201daef7530dd95a2b8a0191269bb2b70ffb8e74083e4524462f5c769d6245188401","039745c963684d6667b9b799a8c4f5841e1144b11003f7e70619d0a34723ca9b7f"],"sequence":4294967294}],"vout":[{"value":0.0000098,"n":0,"scriptPubKey":{"asm":"0 20066f0d6e872c01dccf73c709a24539d3fbf36b","hex":"001420066f0d6e872c01dccf73c709a24539d3fbf36b","reqSigs":1,"type":"witness_v0_keyhash","addresses":["sys1qyqrx7rtwsukqrhx0w0rsngj988flhumtdj32gw"]}},{"value":636.40318427,"n":1,"scriptPubKey":{"asm":"0 02e001487a7aa6e5f4c25bbb6ce8b0f04e6f5835","hex":"001402e001487a7aa6e5f4c25bbb6ce8b0f04e6f5835","reqSigs":1,"type":"witness_v0_keyhash","addresses":["sys1qqtsqzjr602nwtaxztwake69s7p8x7kp4m8twvf"]}},{"value":0,"n":2,"scriptPubKey":{"asm":"OP_RETURN e7126114001402e001487a7aa6e5f4c25bbb6ce8b0f04e6f583502001420066f0d6e872c01dccf73c709a24539d3fbf36b00e1f50500000000001474cea0887d8089fb855759e2d0a3410c8507d44540420f000000000000ffffafafaaaa74657374206d656d6f","hex":"6a4c67e7126114001402e001487a7aa6e5f4c25bbb6ce8b0f04e6f583502001420066f0d6e872c01dccf73c709a24539d3fbf36b00e1f50500000000001474cea0887d8089fb855759e2d0a3410c8507d44540420f000000000000ffffafafaaaa74657374206d656d6f","type":"nulldata"}}],"systx":{"txtype":"assetallocationsend","asset_allocation":"341906151-sys1qqtsqzjr602nwtaxztwake69s7p8x7kp4m8twvf","asset_guid":341906151,"symbol":"AGXS","txid":"2e794fff6f57be647535d7ca809096ba65c829f44f7d48b0f610aa9cf9974a0b","height":0,"sender":"sys1qqtsqzjr602nwtaxztwake69s7p8x7kp4m8twvf","allocations":[{"address":"sys1qyqrx7rtwsukqrhx0w0rsngj988flhumtdj32gw","amount":1},{"address":"sys1qwn82pzraszylhp2ht83dpg6ppjzs04z9jkce7f","amount":0.01}],"total":1.01,"blockhash":"0000000000000000000000000000000000000000000000000000000000000000"}},"hex":"0874000000010148a2706e193cc932aff4c2d0b2f09095687ffd965de6dd9f3805efb5fc2936f30200000000feffffff03d40300000000000016001420066f0d6e872c01dccf73c709a24539d3fbf36bdb3142d10e00000016001402e001487a7aa6e5f4c25bbb6ce8b0f04e6f583500000000000000006a6a4c67e7126114001402e001487a7aa6e5f4c25bbb6ce8b0f04e6f583502001420066f0d6e872c01dccf73c709a24539d3fbf36b00e1f50500000000001474cea0887d8089fb855759e2d0a3410c8507d44540420f000000000000ffffafafaaaa74657374206d656d6f0247304402203439c0505151f90e27c1978a626b1bc69aee994a6c55007f5887619dc2a44dbe02201daef7530dd95a2b8a0191269bb2b70ffb8e74083e4524462f5c769d624518840121039745c963684d6667b9b799a8c4f5841e1144b11003f7e70619d0a34723ca9b7f00000000","status":0,"balance":{"asset_allocation":"341906151-sys1qqtsqzjr602nwtaxztwake69s7p8x7kp4m8twvf","asset_guid":341906151,"symbol":"AGXS","address":"sys1qqtsqzjr602nwtaxztwake69s7p8x7kp4m8twvf","balance":49081.12269723,"balance_zdag":49080.11269723}}}"
```

3. Confirmed transaction message.  Note the additional memo field:
```
{"topic":"confirmed","message":{"txid":"2e794fff6f57be647535d7ca809096ba65c829f44f7d48b0f610aa9cf9974a0b","sender":"sys1qqtsqzjr602nwtaxztwake69s7p8x7kp4m8twvf","receivers":[{"address":"sys1qyqrx7rtwsukqrhx0w0rsngj988flhumtdj32gw","amount":1},{"address":"sys1qwn82pzraszylhp2ht83dpg6ppjzs04z9jkce7f","amount":0.01}],"asset_guid":341906151,"amount":1.01,"memo":"test memo"}}"
```

For standard Syscoin transactions there will be 2 messages per transaction:
1. Unconfirmed transaction message.
```
{"topic":"unconfirmed","message":{"tx":{"txid":"adda096d16a732e9f84ad6190f07dca7bf366045d6e804980da372b8cf8ff28d","hash":"66d6991a965828c046659022bd54430096c0448c6db05b6917f3f64dc9f623df","version":2,"size":249,"vsize":167,"weight":666,"locktime":0,"vin":[{"txid":"290ef748db5aed1d62870ef216923aedb61f26ab44c02a0c813b0617b46a572f","vout":1,"scriptSig":{"asm":"","hex":""},"txinwitness":["30450221009369db347e0d69cbe15f720d612276c4c2bd10a7509cced690f698002addc524022028c7eec5a6245a0d2c081ef573655fbe9904377ce6426332c39a14c040a80d4c01","039745c963684d6667b9b799a8c4f5841e1144b11003f7e70619d0a34723ca9b7f"],"sequence":4294967295}],"vout":[{"value":1,"n":0,"scriptPubKey":{"asm":"0 20066f0d6e872c01dccf73c709a24539d3fbf36b","hex":"001420066f0d6e872c01dccf73c709a24539d3fbf36b","reqSigs":1,"type":"witness_v0_keyhash","addresses":["sys1qyqrx7rtwsukqrhx0w0rsngj988flhumtdj32gw"]}},{"value":632.90307427,"n":1,"scriptPubKey":{"asm":"0 02e001487a7aa6e5f4c25bbb6ce8b0f04e6f5835","hex":"001402e001487a7aa6e5f4c25bbb6ce8b0f04e6f5835","reqSigs":1,"type":"witness_v0_keyhash","addresses":["sys1qqtsqzjr602nwtaxztwake69s7p8x7kp4m8twvf"]}},{"value":0,"n":2,"scriptPubKey":{"asm":"OP_RETURN ffffafafaaaa74657374206d656d6f","hex":"6a0fffffafafaaaa74657374206d656d6f","type":"nulldata"}}]},"hex":"020000000001012f576ab417063b810c2ac044ab261fb6ed3a9216f20e87621ded5adb48f70e290100000000ffffffff0300e1f5050000000016001420066f0d6e872c01dccf73c709a24539d3fbf36b637365bc0e00000016001402e001487a7aa6e5f4c25bbb6ce8b0f04e6f58350000000000000000116a0fffffafafaaaa74657374206d656d6f024830450221009369db347e0d69cbe15f720d612276c4c2bd10a7509cced690f698002addc524022028c7eec5a6245a0d2c081ef573655fbe9904377ce6426332c39a14c040a80d4c0121039745c963684d6667b9b799a8c4f5841e1144b11003f7e70619d0a34723ca9b7f00000000"}}"
```

2. Confirmed transaction message.
```
{"topic":"confirmed","message":"adda096d16a732e9f84ad6190f07dca7bf366045d6e804980da372b8cf8ff28d"}"```


**`hashblock` Channel:**
```
{"topic":"hashblock","message":{"blockhash":"9d0b0e9072a8d1abb8b713868d0a37c1259e5d82329b30bdb505565a973e0978"}}
```
