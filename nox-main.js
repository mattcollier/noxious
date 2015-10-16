"use strict";

var v8  = require('v8');
v8.setFlagsFromString('--harmony_classes');
v8.setFlagsFromString('--harmony_object_literals');
v8.setFlagsFromString('--harmony_tostring');
v8.setFlagsFromString('--harmony_arrow_functions');

var
  app = require('app'),  // Module to control application life.
  Path = require('path'),
  http = require('http'),
  DataFile = require('./DataFile'),
  // communications functions
  NoxiousClient = require('./NoxiousClient'),
  myNoxClient = new NoxiousClient(),
  // cononical json.stringify
  // This is used to stringify objects in a consistent way prior to hashing/signing
  jsStringify = require('canonical-json'),
  contactList = new DataFile(Path.join(app.getPath('userData'), 'Contacts.json')),
  contactRequestList = new DataFile(Path.join(app.getPath('userData'), 'ContactRequests.json')),
  BrowserWindow = require('browser-window'),  // Module to create native browser window.
  thsBuilder = require('ths'),
  ths = new thsBuilder(app.getPath('userData')),
  fork = require('child_process').fork,
  cryptoWorker = fork('./cryptoWorker.js'),
  NoxiousCrypto = require('./NoxiousCrypto'),
  myCrypto = new NoxiousCrypto({ path: Path.join(app.getPath('userData'), 'PrivateKey.json') }),
  dataTransmitDomain = require('domain').create(),
  contactRequestDomain = require('domain').create(),
  myAddress;


function notifyCommError(error) {
  let msgObj = {};
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
  updateRequestStatus(err.domainEmitter['_dstaddr'], 'failed');
});

function notifyGUI(msg) {
  if(!mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send(msg.method, msg.content);
  }
}

function isValidTorHiddenServiceName (name) {
  let toReturn = false;
  if (name.search(/^[a-zA-Z2-7]{16}\.onion$/) != -1) {
    // it matched
    toReturn = true;
  }
  return toReturn;
}

function getContacts(forceReload) {
  if (contactList.size() > 0 || forceReload) {
    var msgObj = {};
    msgObj.method = 'contact';
    msgObj.content = { type: 'initContactList', contactList: contactList.getAll() };
    notifyGUI(msgObj);
  }
}

function getContactRequests() {
  let msgObj = {};
  msgObj.method = 'contact';
  if (contactRequestList.size() > 0) {
    msgObj.content = { type: 'initContactRequestList', contactRequestList: contactRequestList.getAll() };
  } else {
    msgObj.content = { type: 'clearContactRequestList', contactRequestList: {} };
  }
  notifyGUI(msgObj);
}

function updateRequestStatus(contactAddress, status, updateGui) {
  if(updateGui === undefined) {
    updateGui = true;
  }
  let tmpContact = contactRequestList.get(contactAddress);
  tmpContact.status=status;
  contactRequestList.set(contactAddress, tmpContact);
  if (updateGui) {
    getContactRequests();
  }
}

function buildEncryptedMessage(destAddress, msgText) {
  let tmpCrypto = new NoxiousCrypto({ 'pubPem': contactList.get(destAddress).pubPem });
  let msgContent = {};
  msgContent.type = 'message';
  msgContent.from = myAddress;
  msgContent.to = destAddress;
  msgContent.msgText = msgText;
  let msgObj = {};
  msgObj.content = msgContent;
  // sign using my private key
  msgObj.signature = myCrypto.signString(jsStringify(msgContent));
  // encrypt using recipients public key
  let encryptedData = tmpCrypto.encrypt(JSON.stringify(msgObj));
  let encObj = {};
  encObj.content = { type: 'encryptedData', clearFrom: myAddress, data: encryptedData};
  encObj.protocol = '1.0';
  return encObj;
}

function buildContactRequest(destAddress) {
  let introObj = {};
  introObj.type = 'introduction';
  introObj.from = myAddress;
  introObj.to = destAddress;
  introObj.pubPem = myCrypto.pubPem;
  let msgObj = {};
  msgObj.content = introObj;
  msgObj.signature = myCrypto.signString(jsStringify(introObj));
  msgObj.protocol = '1.0';
  return msgObj;
}

function transmitContactRequest(destAddress) {
  contactRequestDomain.run(function() {
    myNoxClient.transmitObject(destAddress, buildContactRequest(destAddress), function(res) {
      switch(res.status) {
        case 200:
          updateRequestStatus(destAddress, 'delivered');
          break;
        case 409:
          updateRequestStatus(destAddress, 'failed');
          var msgObj = {};
          msgObj.method = 'error';
          var failedReason = res.body['reason'];
          switch (failedReason) {
            case 'EKEYSIZE':
              msgObj.content = { type: 'contact',
                message: 'The contact request was rejected because your public encryption key is not proper.  Please upgrade your Noxious software.'};
              break;
            case 'EPROTOCOLVERSION':
              msgObj.content = { type: 'contact',
                message: 'The contact request was rejected because the message format is not proper.  Please upgrade your Noxious software.'};
              break;
            default:
              msgObj.content = { type: 'contact',
                message: 'The recipient already has your contact information.  Ask them to delete your contact information and try again.'};
              break;
          }
          notifyGUI(msgObj);
          break;
      }
    });
  });
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
        console.log('[HTTP Server] ', reqBody );
        let status = preProcessMessage(reqBody);
        if (status.code == 200) {
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify( { status: 'OK' }));
          processMessage(reqBody);
        } else {
          res.writeHead(status.code, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({ reason: status.reason }));
        }
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
  tmpObj.pubPem = req.pubPem  ;
  tmpObj.contactAddress = req.from;
  // check for dups in requests list and contact list
  if(!contactRequestList.has(req.from) && !contactList.has(req.from)) {
    // this is a new incoming contact Request
    console.log('[contact] New Contact Request Received');
    tmpObj.direction = 'incoming';
    contactRequestList.set(req.from, tmpObj);
    let msgObj={};
    msgObj.method = 'contact';
    msgObj.content = { type: 'contactRequest', from: req.from, direction: 'incoming' };
    notifyGUI(msgObj);
  } else if (contactRequestList.has(req.from) && contactRequestList.get(req.from).direction == 'outgoing') {
    // this person accepted a contact request
    contactList.set(req.from, { pubPem: tmpObj.pubPem, contactAddress: tmpObj.contactAddress });
    contactRequestList.delete(req.from);
    getContacts();
    getContactRequests();
  } else if(contactRequestList.get(req.from)) {
    console.log('[contact] Contact request is from an existing contact.');
  }
}

function preProcessMessage(msg) {
  // default statusCode = forbidden;
  var status = {};
  status.code = 403;
  status.reason = '';
  var msgObj = JSON.parse(msg);
  console.log('[preProcessMessage] Start');
  // TODO this function should verify message integrity
  if (msgObj.protocol === '1.0') {
    if (msgObj.content !== undefined) {
      var content = msgObj.content;
      if (content.type !== undefined) {
        switch (content.type) {
          case 'introduction':
            if (content.from !== undefined && content.from && isValidTorHiddenServiceName(content.from)) {
              if(!contactList.has(content.from) && !contactRequestList.has(content.from)) {
                // we don't know this person already, intro is OK
                status.code = 200;
              } else if (contactRequestList.has(content.from) &&
                contactRequestList.get(content.from)['direction'] == 'outgoing' &&
                contactRequestList.get(content.from)['status'] == 'delivered') {
                // we're expecting to hear back from this person, intro is OK
                status.code = 200;
              } else {
                // contact request (key exchange) process needs to be repeated.
                status.code = 409;
              }
            }
            if (status.code == 200) {
              // so far so good, but now check the pubkey, reset status code
              status.code = 403;
              var minKeySize = 3072;
              var tmpCrypto = new NoxiousCrypto({ 'pubPem': content.pubPem });
              var keySize = tmpCrypto.keySize;
              console.log('[preprocessing message] The key size is ', keySize, 'bits.');
              if (keySize < minKeySize) {
                console.log('[preprocessing message] The key must be at least ', minKeySize, ' bits');
                status.code = 409;
                status.reason = 'EKEYSIZE';
              } else {
                console.log('[preprocessing message] The key size meets the ', minKeySize, 'bit requirement');
                status.code = 200;
              }
            }
            break;
          case 'encryptedData':
            if (content.clearFrom !== undefined && content.clearFrom && isValidTorHiddenServiceName(content.clearFrom)) {
              if(contactList.has(content.clearFrom)) {
                // this is from an existing contact, it's OK
                status.code = 200;
              } else {
                // there is no public key for this contact
                status.code = 410;
              }
            }
            break;
        }
      }
    } else {
      // protocol version mismatch
      console.log('[preprocessing message] Protocol version mismatch.');
      status.code = 409;
      status.reason = 'EPROTOCOLVERSION';
    }
  }
  return status;
}

cryptoWorker.on('message', function(msgObj) {
  switch (msgObj.type) {
    case 'decryptedData':
      var decObj = msgObj.data;
      // console.log('Decrypted Data: ', decObj);
      var content = decObj.content;
      var signature = decObj.signature;
      // TODO additional integrity checks?
      if (content.to && content.to == myAddress && content.from && isValidTorHiddenServiceName(content.from) && content.type && content.msgText) {
        if (contactList.has(content.from)) {
          switch (content.type) {
            case 'message':
              var tmpCrypto = new NoxiousCrypto({'pubPem': contactList.get(content.from).pubPem});
              if (tmpCrypto.signatureVerified(jsStringify(content), signature)) {
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
});

function processMessage(msg) {
  var msgObj = JSON.parse(msg);
  var content = msgObj.content;
  switch (content.type) {
    case 'introduction':
      var signature = msgObj.signature;
      var tmpCrypto = new NoxiousCrypto({ 'pubPem': content.pubPem });
      if (tmpCrypto.signatureVerified(jsStringify(content), signature)) {
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
      var workerMsg = {};
      workerMsg.type = 'decrypt';
      workerMsg.data = content.data;
      cryptoWorker.send(workerMsg);
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

  var noxiousProperties = serviceList.filter(noxiousExists);
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

// track ths / tor bootstrapping
ths.on('bootstrap', function(state) {
  var msgObj = {};
  msgObj.method = 'status';
  msgObj.content = { type:'bootstrap', content: state };
  notifyGUI(msgObj);
});

// This method will be called when atom-shell has done everything
// initialization and ready for creating browser windows.
app.on('ready', function() {
  // handles communication between browser and io.js (webpage)
  var ipc = require('ipc');
  var workerMsg = {};
  workerMsg.type = 'init';
  workerMsg.pathToKey = { path: Path.join(app.getPath('userData'), 'PrivateKey.json') };
  cryptoWorker.send(workerMsg);

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
          myNoxClient.transmitObject(content.destAddress, encObj, function(res) {
            var msgObj = {};
            switch(res.status) {
              case 200:
                // OK
                msgObj.method = 'message';
                msgObj.content = { type: 'status', status: 'delivered', msgId: content.msgId };
                notifyGUI(msgObj);
                break;
              case 410:
                // recipient does not have the public key (anymore)
                msgObj.method = 'error';
                msgObj.content = { type: 'message',
                  message: 'The recipient no longer has you in their contact list.  Delete the contact, then send a contact request.'};
                notifyGUI(msgObj);
                msgObj.method = 'message';
                msgObj.content = { type: 'status', status: 'failed', msgId: content.msgId };
                notifyGUI(msgObj);
                break;
              case 409:
                var failedReason = res.body['reason'];
                switch (failedReason) {
                  case 'EPROTOCOLVERSION':
                    msgObj.method = 'error';
                    msgObj.content = { type: 'message',
                      message: 'The message was rejected because the message format is not proper.  Please upgrade your Noxious software.'};
                    notifyGUI(msgObj);
                    msgObj.method = 'message';
                    msgObj.content = { type: 'status', status: 'failed', msgId: content.msgId };
                    notifyGUI(msgObj);
                    break;
                }
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
        updateRequestStatus(content.contactAddress, 'sending', false);
        contactRequestDomain.run(function() {
          myNoxClient.transmitObject(content.contactAddress, buildContactRequest(content.contactAddress), function(res) {
            if(res.status == 200) {
              contactList.set(content.contactAddress, { pubPem: contactRequestList.get(content.contactAddress).pubPem, contactAddress: content.contactAddress });
              contactRequestList.delete(content.contactAddress);
              getContacts();
              getContactRequests();
            } else if (res.status == 409) {
              // this can occur in a case where a successfully transmitted contact
              // request is deleted before a reply is sent.
              updateRequestStatus(content.contactAddress, 'failed');
              var msgObj = {};
              msgObj.method = 'error';
              var failedReason = res.body['reason'];
              switch (failedReason) {
                case 'EKEYSIZE':
                  msgObj.content = { type: 'contact',
                    message: 'The contact request was rejected because your public encryption key is not proper.  Please upgrade your Noxious software.'};
                  break;
                default:
                  msgObj.content = { type: 'contact',
                    message: 'The recipient already has your contact information.  Ask them to delete your contact information and try again.'};
                  break;
              }
              notifyGUI(msgObj);
            }
          });
        });
        break;
      case 'delContactRequest':
        contactRequestList.delete(content.contactAddress);
        break;
      case 'declineContactRequest':
        contactRequestList.delete(content.contactAddress);
        getContactRequests();
        break;
      case 'sendContactRequest':
        // do not send request to myAddress or to existing contacts
        if(content.contactAddress==myAddress) {
          var msgObj = {};
          msgObj.method = 'error';
          msgObj.content = { type: 'contact',
            message: 'You may not send a contact request to your own Client ID.'};
          notifyGUI(msgObj);
        } else if (contactList.has(content.contactAddress)) {
          var msgObj = {};
          msgObj.method = 'error';
          msgObj.content = { type: 'contact',
            message: 'You may not send a contact request to an existing contact.  Delete the contact and try again.'};
          notifyGUI(msgObj);
        } else if (contactRequestList.get(content.contactAddress)) {
          var msgObj = {};
          msgObj.method = 'error';
          msgObj.content = { type: 'contact',
            message: 'There is already a pending contact request for this Client ID.  Delete the contact request and try again.'};
          notifyGUI(msgObj);
        } else {
          transmitContactRequest(content.contactAddress);
          var contactRequest = { contactAddress: content.contactAddress, direction: 'outgoing', status: 'sending' };
          contactRequestList.set(content.contactAddress, contactRequest);
          // reinit the request list
          getContactRequests();
        }
        break;
      case 'retryContactRequest':
        // user wants to resend a failed failed contact requests
        // the address has already passed inspection and the GUI has been
        // set to show sending status
        transmitContactRequest(content.contactAddress);
        break;
      case 'setNickName':
        var contactInfo = contactList.get(content.contactAddress);
        contactInfo.nickName=content.nickName;
        contactList.set(content.contactAddress, contactInfo);
        break;
      case 'delNickName':
        var contactInfo = contactList.get(content.contactAddress);
        contactInfo.nickName='';
        contactList.set(content.contactAddress, contactInfo);
        break;
      case 'delContact':
        contactList.delete(content.contactAddress);
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
  cryptoWorker.kill();
  console.log('I\'m quitting.');
});
