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
var ths = new thsBuilder();
// crypto related

var NoxCrypto = require(__dirname + '/nox-crypto.js');
var myCrypto = new NoxCrypto({ dataDir: dataDir, fileName: 'privatekey.json'});

var myAddress;

var person = function (lastName) {
  this.lastName = lastName;
}

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
    }
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
  tmpObj.pubKey = req.pubKey;
  tmpObj.contactAddress = req.from;
  tmpObj.direction = 'incoming';
  // check for dups in requests list and contact list
  if(contactRequestList.getKey[req.from] == null && contactList.getKey[req.from] == null) {
    contactRequestList.addKey(req.from, tmpObj);
    var msgObj={};
    msgObj.method = 'contact';
    msgObj.content = { type: 'contactRequest', from: req.from, direction: 'incoming' };
    notifyGUI(msgObj);
  }
}

function processMessage(msg) {
  msgObj = JSON.parse(msg);
  var content = msgObj.content;
  var signature = msgObj.signature;
  switch (content.type) {
    case 'introduction':
      tmpCrypto = new NoxCrypto({'pubPEM': content.pubPEM});
      if (tmpCrypto.signatureVerified(JSON.stringify(content), signature)) {
        console.log('Introduction is properly signed.');
        // TODO enhance from address checking, for now, not null, and not myAddress
        if (content.to==myAddress && content.from!=='undefined' && content.from && content.from!==myAddress) {
          // content.to is part of the signed content.
          console.log('Introduction is properly addressed.');
          // Contact request is valid, register it, TODO check for dups?
          registerContactRequest(content);
        }
      } else {
        console.log('Introduction is NOT properly signed.  Disregarding.');
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
    ths.createHiddenService('noxious','1111', true);
  } else {
    console.log('Noxious Service Exists: %j', noxiousProperties);
  }
  myAddress=ths.getOnionAddress('noxious');
  var msgObj = {};
  msgObj.method = 'status';
  msgObj.content = { type:'onionAddress', content: myAddress };
  notifyGUI(msgObj);
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
  mainWindow = new BrowserWindow({width: 800, height: 600});
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

  ipc.on('contact', function(event, content) {
    console.log('[contact event] ', content);
    switch (content.type) {
      case 'acceptContactRequest':
        // user has chosen to accept the contact request
        // pull the info from the contactRequestList and make a new conact.
        contactList.addKey(content.contactAddress, contactRequestList.getKey(content.contactAddress));
        // remove the contact request and save
        contactRequestList.delKey(content.contactAddress);
        // for now, just reinit the contact list
        getContacts();
        // now send encrypted message back to contact containing this Public Key.
        break;
      case 'sendContactRequest':
        // do not send request to myAddress
        // TODO display error message if to=myAddress, for now, discard
        if(content.contactAddress!==myAddress) {
          var introObj = {};
          introObj.type = 'introduction';
          introObj.from = myAddress;
          introObj.to = content.contactAddress;
          introObj.pubPEM = myCrypto.pubPEM;
          var signature = myCrypto.signString(JSON.stringify(introObj));
          var msgObj = {};
          msgObj.content = introObj;
          msgObj.signature = signature;
          myNoxClient.transmitObject(content.contactAddress, msgObj);
        }
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
