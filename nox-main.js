var queryString = require('querystring');
var http = require('http');
var Object2File = require(__dirname + '/object2file.js');

// communications functions
var NoxClient = require(__dirname + '/nox-client.js');
var myNoxClient = new NoxClient();

var dataDir = __dirname + '/noxious-data';
var contactList = new Object2File(dataDir, 'contacts.json');
var contactRequestList = new Object2File(dataDir, 'contact-requests.json');

var app = require('app');  // Module to control application life.
var BrowserWindow = require('browser-window');  // Module to create native browser window.

var thsBuilder = require('ths');
var ths = new thsBuilder(dataDir);
// crypto related

var NoxCrypto = require(__dirname + '/nox-crypto.js');
var myCrypto = new NoxCrypto({ dataDir: dataDir, fileName: 'privatekey.json'});

var myAddress;

function notifyGUI(msg) {
  // TODO, needs improvement?
  if(!mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send(msg.method, msg.content);
  }
}

function isEmptyObject(obj) {
  return !Object.keys(obj).length;
}

function getContacts() {
  // do nothing if contact list is empty
  contactList.getContent(function(content) {
    if (!isEmptyObject(content)) {
      var msgObj = {};
      msgObj.method = 'contact';
      msgObj.content = { type: 'initContactList', contactList: content };
      notifyGUI(msgObj);
    }
  });
}

function getContactRequests() {
  contactRequestList.getContent(function(content) {
    if (!isEmptyObject(content)) {
      var msgObj = {};
      msgObj.method = 'contact';
      msgObj.content = { type: 'initContactRequestList', contactRequestList: content };
      notifyGUI(msgObj);
    } else {
      var msgObj = {};
      msgObj.method = 'contact';
      msgObj.content = { type: 'clearContactRequestList', contactRequestList: {} };
      notifyGUI(msgObj);
    }
  });
}

function encrypt(noxCrypto, clearText){
    var keySizeBytes = noxCrypto.keySize/8;
    var buffer = new Buffer(clearText);
    var maxBufferSize = keySizeBytes - 42; //according to ursa documentation
    var bytesDecrypted = 0;
    var encryptedBuffersList = [];

    //loops through all data buffer encrypting piece by piece
    while(bytesDecrypted < buffer.length){
        //calculates next maximun length for temporary buffer and creates it
        var amountToCopy = Math.min(maxBufferSize, buffer.length - bytesDecrypted);
        var tempBuffer = new Buffer(amountToCopy);

        //copies next chunk of data to the temporary buffer
        buffer.copy(tempBuffer, 0, bytesDecrypted, bytesDecrypted + amountToCopy);

        //encrypts and stores current chunk
        var encryptedBuffer = noxCrypto.myPubKey.encrypt(tempBuffer);
        encryptedBuffersList.push(encryptedBuffer);

        bytesDecrypted += amountToCopy;
    }

    //concatenates all encrypted buffers and returns the corresponding String
    return Buffer.concat(encryptedBuffersList).toString('base64');
}

function decrypt(encryptedString){
    var keySizeBytes = myCrypto.keySize;
    var encryptedBuffer = new Buffer(encryptedString, 'base64');
    var decryptedBuffers = [];

    //if the clear text was encrypted with a key of size N, the encrypted
    //result is a string formed by the concatenation of strings of N bytes long,
    //so we can find out how many substrings there are by diving the final result
    //size per N
    var totalBuffers = encryptedBuffer.length / keySizeBytes;

    //decrypts each buffer and stores result buffer in an array
    for(var i = 0 ; i < totalBuffers; i++){
        //copies next buffer chunk to be decrypted in a temp buffer
        var tempBuffer = new Buffer(keySizeBytes);
        encryptedBuffer.copy(tempBuffer, 0, i*keySizeBytes, (i+1)*keySizeBytes);
        //decrypts and stores current chunk
        var decryptedBuffer = myCrypto.myPrivKey.decrypt(tempBuffer);
        decryptedBuffers.push(decryptedBuffer);
    }

    //concatenates all decrypted buffers and returns the corresponding String
    return Buffer.concat(decryptedBuffers).toString();
}

function buildEncryptedMessage(destAddress, msgText) {
  // TODO should crypto objects be stored in an array for reuse?
  var tmpPubPEM = contactList.getKey(destAddress).pubPEM;
  var tmpCrypto = new NoxCrypto({'pubPEM': tmpPubPEM});
  var msgContent = {};
  msgContent.type = 'message';
  msgContent.from = myAddress;
  msgContent.to = destAddress;
  msgContent.msgText = msgText;
  msgObj = {};
  msgObj.content = msgContent;
  msgObj.signature = myCrypto.signString(JSON.stringify(msgContent));
  var encryptedData = encrypt(tmpCrypto, JSON.stringify(msgObj));
  var encObj = {};
  encObj.content = {type: 'encryptedData', data: encryptedData};
  return encObj;
}

function buildContactRequest(destAddress) {
  var introObj = {};
  introObj.type = 'introduction';
  introObj.from = myAddress;
  introObj.to = destAddress;
  introObj.pubPEM = myCrypto.pubPEM;
  var signature = myCrypto.signString(JSON.stringify(introObj));
  var msgObj = {};
  msgObj.content = introObj;
  msgObj.signature = signature;
  return msgObj;
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
var mainWindow = null;
var pageLoaded = false;

var server = http.createServer(function (req, res){
  if (req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello world!');
  } else if (req.method === 'POST') {
    if (req.url === '/') {
      var reqBody = '';
      req.on('data', function(d) {
        reqBody += d;
        if (reqBody.length > 1e7) {
          res.writeHead(413, 'Request Entity Too Large', {'Content-Type': 'text/html'});
          res.end('<!doctype html><html><head><title>413</title></head><body>413: Request Entity Too Large</body></html>');
        }
      });
      req.on('end', function() {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write('Thanks for the data, ');
        res.end();
        processMessage(reqBody);
      });
    }
  }
});
server.listen(1111, '127.0.0.1');
console.log('Server running at http://127.0.0.1:1111');

function logSomething() {
  console.log('something');
}

function relayMessage(msg) {
  mainWindow.webContents.send('msg', 'from: ' + msg.name + ' message: ' + msg.message);
}

function registerContactRequest(req) {
  // add to list of other contact requests for saving to disk
  // build object
  // TODO is a date/time wanted or needed here? Other Data?
  // this same data structure is copied to the contact list upon acceptance.
  var tmpObj = {};
  tmpObj.pubPEM = req.pubPEM  ;
  tmpObj.contactAddress = req.from;
  // check for dups in requests list and contact list
  if(contactRequestList.getKey(req.from) === undefined && contactList.getKey(req.from) === undefined) {
    // this is a new incoming contact Request
    console.log('[contact] New Contact Request Received');
    tmpObj.direction = 'incoming';
    contactRequestList.addKey(req.from, tmpObj);
    var msgObj={};
    msgObj.method = 'contact';
    msgObj.content = { type: 'contactRequest', from: req.from, direction: 'incoming' };
    notifyGUI(msgObj);
  } else if (contactRequestList.getKey(req.from).direction == 'outgoing') {
    // this person accepted a contact request
    console.log('[contact] Contact Request Accepted');
    contactList.addKey(req.from, tmpObj);
    contactRequestList.delKey(req.from);
    // TODO fancy GUI work goes here, for now, just reinit both lists
    getContacts();
    getContactRequests();
  }
}

function processMessage(msg) {
  msgObj = JSON.parse(msg);
  var content = msgObj.content;
  switch (content.type) {
    case 'introduction':
      var signature = msgObj.signature;
      tmpCrypto = new NoxCrypto({'pubPEM': content.pubPEM});
      if (tmpCrypto.signatureVerified(JSON.stringify(content), signature)) {
        console.log('Introduction is properly signed.');
        // TODO enhance from address checking, for now, not null or undefined, and not myAddress
        if (content.to==myAddress && content.from!==undefined && content.from && content.from!==myAddress) {
          // content.to is part of the signed content.
          console.log('Introduction is properly addressed.');
          // Contact request is valid, register it, TODO check for dups?
          registerContactRequest(content);
        }
      } else {
        console.log('Introduction is NOT properly signed.  Disregarding.');
      }
      break;
    case 'encryptedData':
      console.log('Encrypted Data: ', content.data);
      console.log('Decrypted Data: ', decrypt(content.data));
      break;
  }
}

function startHiddenService() {
  // we know that tor is loaded and web page is loaded.
  var serviceList = ths.getServices();
  console.log('Service List: %j',serviceList);

  function noxiousExists(element) {
    return element.name=='noxious';
  }

  noxiousProperties=serviceList.filter(noxiousExists);
  if (noxiousProperties==0) {
    // does not exist, create it
    console.log('Creating new noxious service');
    ths.createHiddenService('noxious','1111', true);
  } else {
    // TODO does not work propery on initial startup: https://github.com/Mowje/node-ths/issues/3
    ths.getOnionAddress('noxious', function(err, onionAddress) {
      if(!err) {
        myAddress = onionAddress;
        var msgObj = {};
        msgObj.method = 'status';
        msgObj.content = { type:'onionAddress', content: myAddress };
        notifyGUI(msgObj);
      }
    });
  }
}

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  if (process.platform != 'darwin')
    app.quit();
});

// This method will be called when atom-shell has done everything
// initialization and ready for creating browser windows.
app.on('ready', function() {
  // handles communication between browser and io.js (webpage)
  var ipc = require('ipc');

  // Create the browser window.
  mainWindow = new BrowserWindow({width: 900, height: 600});
//  mainWindow = new BrowserWindow({width: 900, height: 600, 'web-preferences': {'overlay-scrollbars': true}});
  mainWindow.openDevTools();

  ths.start(false, function () {
    console.log("tor Started!");
    if(!mainWindow.webContents.isLoading()) {
      mainWindow.webContents.send('ping', 'Tor is ready');
      startHiddenService();
    }
  });

  // and load the index.html of the app.
  mainWindow.loadUrl('file://' + __dirname + '/index.html');
  mainWindow.webContents.on('did-finish-load', function() {
    console.log('did finish loading.');
    getContacts();
    getContactRequests();
  });

  ipc.on('message', function(event, content) {
    console.log('[message event] ', content);
    switch (content.type) {
      case 'sendEncrypted':
        var encObj = buildEncryptedMessage(content.destAddress, content.msgText);
        myNoxClient.transmitObject(content.destAddress, encObj)
        break;
    }
  });

  ipc.on('contact', function(event, content) {
    console.log('[contact event] ', content);
    switch (content.type) {
      case 'acceptContactRequest':
        // user has chosen to accept the contact request
        // send a contact request to sender to provide pubKey
        // TODO transmitObject should have a callback that triggers only on successful delivery of Message
        myNoxClient.transmitObject(content.contactAddress, buildContactRequest(content.contactAddress));
        // pull the info from the contactRequestList and make a new conact.
        contactList.addKey(content.contactAddress, contactRequestList.getKey(content.contactAddress));
        // remove the contact request and save
        contactRequestList.delKey(content.contactAddress);
        // for now, just reinit the contact list
        getContacts();
        break;
      case 'declineContactRequest':
        // TODO Should the sender be notified?
        contactRequestList.delKey(content.contactAddress);
        // no need to update GUI
        break;
      case 'sendContactRequest':
        // do not send request to myAddress
        // TODO display error message if to=myAddress, for now, discard
        if(content.contactAddress!==myAddress) {
          myNoxClient.transmitObject(content.contactAddress, buildContactRequest(content.contactAddress));
          var contactRequest = { contactAddress: content.contactAddress, direction: 'outgoing' };
          contactRequestList.addKey(content.contactAddress, contactRequest);
          // reinit the request list
          getContactRequests();
        }
        break;
      case 'setNickName':
        var contactInfo = contactList.getKey(content.contactAddress);
        contactInfo.nickName=content.nickName;
        contactList.addKey(content.contactAddress, contactInfo);
        break;
      case 'delNickName':
        var contactInfo = contactList.getKey(content.contactAddress);
        contactInfo.nickName='';
        contactList.addKey(content.contactAddress, contactInfo);
        break;
    }
  });

  // test ipc communications
  ipc.on('asynchronous-message', function(event, arg) {
    console.log(arg);  // prints "ping"
    event.sender.send('asynchronous-reply', 'pong');
  });

  ipc.on('synchronous-message', function(event, arg) {
    console.log(arg);  // prints "ping"
    event.returnValue = 'pong';
  });



  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
});

app.on('before-quit', function(e) {
  if (ths.isTorRunning()) {
    e.preventDefault();
    ths.stop(function () {
      console.log("tor has been stopped");
      app.quit();
    });
  }
  console.log('I\'m quitting.');
});
