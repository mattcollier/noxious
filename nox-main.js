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
var dataTransmitDomain = require('domain').create();
var contactRequestDomain = require('domain').create();
var myAddress;

function notifyCommError(error) {
  var msgObj = {};
  msgObj.method = 'error';
  switch(error) {
    case 'EHOSTUNREACH':
      msgObj.content = { type: 'communication',
        message: 'The recipient does not appear to be online at this time.  Try again later.'};
      break;
    case 'ETTLEXPIRED':
      msgObj.content = { type: 'communication',
        message: 'There seems to be trouble with your Internet connection.  Try again later.'};
    default:
      msgObj.content = { type: 'communication',
        message: 'A communication error occurred, see the console log for more information.'};
      break;
  }
  notifyGUI(msgObj);
}

dataTransmitDomain.on('error', function(err){
  console.log(err);
  notifyCommError(err.code);
});

contactRequestDomain.on('error', function(err){
  console.log(err);
  notifyCommError(err.code);
  var de = err.domainEmitter['_dstaddr'];
  updateRequestStatus(err.domainEmitter['_dstaddr'], 'failed');
});

function notifyGUI(msg) {
  // TODO, needs improvement?
  if(!mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send(msg.method, msg.content);
  }
}

function isEmptyObject(obj) {
  return !Object.keys(obj).length;
}

function getContacts(forceReload) {
  contactList.getContent(function(content) {
    if (!isEmptyObject(content) || forceReload) {
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

function updateRequestStatus(contactAddress, status) {
  var tmpContact = contactRequestList.getKey(contactAddress);
  tmpContact.status=status;
  contactRequestList.addKey(contactAddress, tmpContact);
  getContactRequests();
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
    var keySizeBytes = myCrypto.keySize/8;
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
        var decryptedBuffer = myCrypto.myPrivKey.decrypt(tempBuffer, 'base64');
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
  encObj.content = {type: 'encryptedData', clearFrom: myAddress, data: encryptedData};
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
        switch(preProcessMessage(reqBody)) {
          case 200:
            res.writeHead(200, {'Content-Type': 'text/html'});
            processMessage(reqBody);
            break;
          case 409:
            res.writeHead(409, {'Content-Type': 'text/html'});
            break;
          case 410:
            res.writeHead(410, {'Content-Type': 'text/html'});
            break;
          case 403:
            res.writeHead(403, {'Content-Type': 'text/html'});
            break;
        }
        res.write('Thank you, come again.');
        res.end();
      });
    }
  }
});
server.listen(1111, '127.0.0.1');
console.log('Server running at http://127.0.0.1:1111');

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
  } else if (contactRequestList.getKey(req.from) && contactRequestList.getKey(req.from).direction == 'outgoing') {
    // this person accepted a contact request
    console.log('[contact] Contact Request Accepted');
    contactList.addKey(req.from, tmpObj);
    contactRequestList.delKey(req.from);
    // TODO fancy GUI work goes here, for now, just reinit both lists
    getContacts();
    getContactRequests();
  } else if(contactRequestList.getKey(req.from)) {
    console.log('[contact] Contact request is from an existing contact.');
  }
}

function preProcessMessage(msg) {
  // default statusCode = forbidden;
  var statusCode = 403;
  msgObj = JSON.parse(msg);
  console.log('[preprocessing message] Start');
  // TODO this function should verify message integrity
  if (msgObj.content !== undefined) {
    var content = msgObj.content;
    if (content.type !== undefined) {
      switch (content.type) {
        case 'introduction':
          if (content.from !== undefined && content.from) {
            // TODO add address validation
            if(contactList.getKey(content.from) === undefined &&
              contactRequestList.getKey(content.from) === undefined) {
              // we don't know this person already, intro is OK
              statusCode = 200;
            } else if (contactRequestList.getKey(content.from) !== undefined &&
              contactRequestList.getKey(content.from)['direction'] == 'outgoing' &&
              contactRequestList.getKey(content.from)['status'] == 'delivered') {
              // we're expecting to hear back from this person, intro is OK
              statusCode = 200;
            } else {
              // contact request (key exchange) process needs to be repeated.
              statusCode = 409;
            }
          }
          break;
        case 'encryptedData':
          if (content.clearFrom !== undefined && content.clearFrom) {
            if(contactList.getKey(content.clearFrom)) {
              // this is from an existing contact, it's OK
              statusCode = 200;
            } else {
              // there is no public key for this contact
              statusCode = 410;
            }
          }
          break;
      }
    }
  }
  return statusCode;
}

function processMessage(msg) {
  msgObj = JSON.parse(msg);
  console.log('[process message] ', msgObj);
  var content = msgObj.content;
  switch (content.type) {
    case 'introduction':
      var signature = msgObj.signature;
      var tmpCrypto = new NoxCrypto({'pubPEM': content.pubPEM});
      if (tmpCrypto.signatureVerified(JSON.stringify(content), signature)) {
        console.log('[process message] Introduction is properly signed.');
        // TODO enhance from address checking, for now, not null or undefined, and not myAddress
        if (content.to==myAddress && content.from!==undefined && content.from && content.from!==myAddress) {
          // content.to and content.from are part of the signed content.
          console.log('[process message] Introduction is properly addressed.');
          registerContactRequest(content);
        }
      } else {
        console.log('[process message] Introduction is NOT properly signed.  Disregarding.');
      }
      break;
    case 'encryptedData':
      console.log('Encrypted Data: ', content.data);
      var decObj = JSON.parse(decrypt(content.data));
      console.log('Decrypted Data: ', decObj);
      var content = decObj.content;
      var signature = decObj.signature;
      // TODO additional integrity checks
      // if a message is sent by someone who has my public key, but I no longer have theirs the
      // message will still arrive here, but it will not be possible to verify the signature.
      // do we have a public key for this sender?
      if (content.to && content.from && content.type && content.msgText) {
        if (contactList.getKey(content.from)) {
          switch (content.type) {
            case 'message':
              var tmpCrypto = new NoxCrypto({'pubPEM': contactList.getKey(content.from).pubPEM});
              if (tmpCrypto.signatureVerified(JSON.stringify(content), signature)) {
                console.log('[process message] Message is properly signed.');
                if (content.to==myAddress && content.from!==undefined && content.from && content.from!==myAddress) {
                  console.log('[process message] Message is properly addressed.');
                  var msgObj = {};
                  msgObj.method = 'message';
                  msgObj.content = { type:'message', from: content.from, msgText: content.msgText };
                  notifyGUI(msgObj);
                }
              } else {
                console.log('[process message] Message is NOT properly signed.  Disregarding.');
              }
              break;
          }
        }
      }
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
    ths.createHiddenService('noxious','1111');
    ths.saveConfig();
    // Why this?  https://github.com/Mowje/node-ths/issues/5
    var myDelegate = function() {
      ths.signalReload();
    }
    var myVar = setTimeout(myDelegate, 250);
  }
  // TODO does not work propery on initial startup: https://github.com/Mowje/node-ths/issues/3
  ths.getOnionAddress('noxious', function(err, onionAddress) {
    if(err) {
      console.error('[getOnionAddress] Error while reading hostname file: ' + err);
    }
    else {
      console.log('[getOnionAddress] Onion Address is: ', onionAddress);
      myAddress = onionAddress;
      var msgObj = {};
      msgObj.method = 'status';
      msgObj.content = { type:'onionAddress', content: myAddress };
      notifyGUI(msgObj);
    }
  });
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
//  mainWindow.openDevTools();

  ths.start(false, function () {
    console.log("tor Started!");
    if(!mainWindow.webContents.isLoading()) {
      startHiddenService();
    }
  });

  // and load the index.html of the app.
  mainWindow.loadUrl('file://' + __dirname + '/index.html');
  mainWindow.webContents.on('did-finish-load', function() {
    console.log('[webContents] Finished loading.');
    getContacts();
    getContactRequests();
  });

  ipc.on('message', function(event, content) {
    console.log('[message event] ', content);
    switch (content.type) {
      case 'sendEncrypted':
        var encObj = buildEncryptedMessage(content.destAddress, content.msgText);
        dataTransmitDomain.run(function() {
          myNoxClient.transmitObject(content.destAddress, encObj, function(status) {
            switch(status) {
              case 200:
                // sent OK, update GUI
                var msgObj = {};
                msgObj.method = 'message';
                msgObj.content = { type: 'status', status: 'delivered', msgId: content.msgId };
                notifyGUI(msgObj);
                break;
              case 410:
                // recipient does not have the public key (anymore)
                var msgObj = {};
                msgObj.method = 'error';
                msgObj.content = { type: 'message',
                  message: 'The recipient no longer has you in their contact list.  Delete the contact, then send a contact request.'};
                notifyGUI(msgObj);
                msgObj.method = 'message';
                msgObj.content = { type: 'status', status: 'failed', msgId: content.msgId };
                notifyGUI(msgObj);
                break;
            }
          });
        });
        break;
    }
  });

  ipc.on('contact', function(event, content) {
    console.log('[contact event] ', content);

    switch (content.type) {
      case 'acceptContactRequest':
        // user has chosen to accept the contact request
        // send a contact request to sender to provide pubKey
        updateRequestStatus(content.contactAddress, 'sending');
        contactRequestDomain.run(function() {
          myNoxClient.transmitObject(content.contactAddress, buildContactRequest(content.contactAddress), function(status) {
            if(status == 200) {
              // pull the info from the contactRequestList and make a new conact.
              contactList.addKey(content.contactAddress, contactRequestList.getKey(content.contactAddress));
              // remove the contact request and save
              contactRequestList.delKey(content.contactAddress);
              // for now, just reinit the contact lists
              getContacts();
              getContactRequests();
            } else if (status == 409) {
              // this can occur in a case where a successfully transmitted contact
              // request is deleted before a reply is sent.
              updateRequestStatus(content.contactAddress, 'failed');
              var msgObj = {};
              msgObj.method = 'error';
              msgObj.content = { type: 'contact',
                message: 'The recipient already has your contact information.  Ask them to delete your contact information and try again.'};
              notifyGUI(msgObj);
            }
          });
        });
        break;
      case 'delContactRequest':
        contactRequestList.delKey(content.contactAddress);
        break;
      case 'declineContactRequest':
        // TODO Should the sender be notified?
        contactRequestList.delKey(content.contactAddress);
        // no need to update GUI
        break;
      case 'sendContactRequest':
        // do not send request to myAddress
        if(content.contactAddress==myAddress) {
          var msgObj = {};
          msgObj.method = 'error';
          msgObj.content = { type: 'contact',
            message: 'You may not send a contact request to your own Client ID.'};
          notifyGUI(msgObj);
        } else if (contactList.getKey(content.contactAddress)) {
          var msgObj = {};
          msgObj.method = 'error';
          msgObj.content = { type: 'contact',
            message: 'You may not send a contact request to an existing contact.  Delete the contact and try again.'};
          notifyGUI(msgObj);
        } else if (contactRequestList.getKey(content.contactAddress)) {
          var msgObj = {};
          msgObj.method = 'error';
          msgObj.content = { type: 'contact',
            message: 'There is already a pending contact request for this Client ID.  Delete the contact request and try again.'};
          notifyGUI(msgObj);
        } else {
          contactRequestDomain.run(function() {
            myNoxClient.transmitObject(content.contactAddress, buildContactRequest(content.contactAddress), function(status) {
              switch(status) {
                case 200:
                  updateRequestStatus(content.contactAddress, 'delivered');
                  break;
                case 409:
                  updateRequestStatus(content.contactAddress, 'failed');
                  var msgObj = {};
                  msgObj.method = 'error';
                  msgObj.content = { type: 'contact',
                    message: 'The recipient already has your contact information.  Ask them to delete your contact information and try again.'};
                  notifyGUI(msgObj);
                  break;
              }
            });
          });
          var contactRequest = { contactAddress: content.contactAddress, direction: 'outgoing', status: 'sending' };
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
      case 'delContact':
        contactList.delKey(content.contactAddress);
        getContacts(true);
        break;
    }
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
