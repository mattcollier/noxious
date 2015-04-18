"use strict";

var
  socks = require('socksv5'),
  http = require('http');

class NoxiousClient {
  constructor() {
    this.socksConfig = {
      proxyHost: '127.0.0.1',
      proxyPort: 9999,
      localDNS: false,
      auths: [
        socks.auth.None()
      ]
    };
  }
  transmitObject(destAddress, msg, cb) {
    let postData = JSON.stringify(msg);
    // localDNS: false is a critical parameter here, this allows lookup of hidden (*.onion) addresses.
    // proxy here refers to the tor instance

    let postOptions = {
      host: destAddress,
      port: 1111,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      agent: new socks.HttpAgent(this.socksConfig)
    }
    let postReq = http.request(postOptions, function(res) {
      res.setEncoding('utf8');
      let body = '';
      res.on('data', function(d) {
        body += d;
      });
      res.on('end', function() {
        console.log('[noxclient transmitObject] HTTP Status: ', res.statusCode);
        if(cb && typeof(cb) == 'function') {
          let response = {};
          response.status = res.statusCode;
          response.body = JSON.parse(body);
          cb(response);
        }
      });
    });
    postReq.end(postData,'utf8');
  }
}

module.exports = NoxiousClient;
