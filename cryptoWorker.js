"use strict";

//var
//  NoxiousCrypto = require('./NoxiousCrypto');
var
  myCrypto = null,
  initialized = false,
  NoxiousCrypto = require('./NoxiousCrypto');

process.on('message', function(msgObj) {
  switch(msgObj.type) {
    case 'init':
      myCrypto = new NoxiousCrypto(msgObj.pathToKey);
      initialized = true;
      break;
    case 'decrypt':
      if(initialized) {
        var parentMsg = {};
        parentMsg.type = 'decryptedData';
        parentMsg.data = JSON.parse(myCrypto.decrypt(msgObj.data));
        process.send(parentMsg);
      }
      break;
  }
});
