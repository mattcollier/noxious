"use strict";

var v8  = require('v8');
v8.setFlagsFromString('--harmony_classes');
v8.setFlagsFromString('--harmony_object_literals');
v8.setFlagsFromString('--harmony_tostring');
v8.setFlagsFromString('--harmony_arrow_functions');

//var
//  NoxiousCrypto = require('./NoxiousCrypto');
var
  myCrypto = null,
  initialized = false,
  NoxiousCrypto = require('./NoxiousCrypto');

process.on('message', function(msgObj) {
  switch (msgObj.type) {
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
