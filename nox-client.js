var socks = require('socksv5');
var http = require('http');

// localDNS=false here is key to looking up .onion addresses
function NoxClient () {
  this.socksConfig = {
    proxyHost: '127.0.0.1',
    proxyPort: 9999,
    localDNS: false,
    auths: [
      socks.auth.None()
    ]
  };
}

NoxClient.prototype.transmitObject = function (destAddress, msg, cb) {

  postData = JSON.stringify(msg);
  // console.log('Stringified PostData: ', postData);
  // localDNS: false is a critical parameter here, this allows lookup of hidden (*.onion) addresses.
  // proxy here refers to the tor instance

  var postOptions = {
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

  var postReq = http.request(postOptions, function(res) {
    res.setEncoding('utf8');
    var body = '';
    res.on('data', function(d) {
      body += d;
    });
    res.on('end', function() {
      console.log('[noxclient transmitObject] HTTP Status: ', res.statusCode);
      //console.log(res.statusCode, res.headers);
      //console.log(body);
      if(cb && typeof(cb) == 'function') {
        var response = {};
        response.status = res.statusCode;
        response.body = JSON.parse(body);
        cb(response);
      }
    });
  });

  postReq.write(postData,'utf8');
  postReq.end();
}

module.exports = NoxClient;
