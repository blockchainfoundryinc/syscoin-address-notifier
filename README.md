# Zdag Server
This module listens to ZMQ messages from Syscoin Core and filter them and send them out via websocket to subscribers

Pre-req
-------
node, g++, make

Installation
------------
`git clone http://www.github.com/blockchainfoundryinc/syscoin-address-notifier`
`cd syscoin-address-notifier`
`npm install`
`npm run start`

Configuration
-------------
RPC configurations are in both server.js and message-handler.js.

Subscribing
-----------
Applications can subscribe to syscoin-address-notifier via websocket and pass in address as qstring:
```
ws|wss://server:port?address=syscoin_address
```
If you are using SockJS as the client you can use `http|https`.

Sample Output
-------------
For non-assetallocationsend transactions:
```
{"topic":"confirmed","message":"71d56b617b747e53d68c267650449d759447a37719efd1324dbad10609234e31"}
```
For assetallocationsend transactions:
```
{"topic":"confirmed","message":{"txid":"9d0b0e9072a8d1abb8b713868d0a37c1259e5d82329b30bdb505565a973e0978","sender":"sys1q7vkc0zmjhd4njv56a3z6rp3em79kwrnzvk9mr3","receivers":[{"address":"sys1qsu35vkf0df5r8vn4yqswsy6vln0scpkkv6p7xd","amount":1}],"asset_guid":341906151,"amount":1,"memo":"this is a memo"}}
```
