var ursa = require('ursa');
var Object2File = require(__dirname + '/object2file.js');

function isEmptyObject(obj) {
  return !Object.keys(obj).length;
}

function NoxCrypto (obj) {
  this.myPrivKey='';
  this.pubPEM;
  this.myPubKey='';
  var keys, privPEM;

  // accepts either dir, filename or public key
  if(obj['pubPEM']) {
    // object has public Key
    this.pubPEM=obj.pubPEM;
    this.myPubKey = ursa.createPublicKey(this.pubPEM, 'base64');
  } else {
    // assume it's a dataDir and filename
    keyData = new Object2File(obj.dataDir, obj.fileName);
    keyData.getContent((function(content) {
      if(!isEmptyObject(content)) {
        // key already exists
        keys = ursa.createPrivateKey(content.PEM, '', 'base64');
        privPEM = keys.toPrivatePem('base64');

      } else {
        // key was not on disk, create a new one
        keys = ursa.generatePrivateKey(2048, 65537);
        privPEM = keys.toPrivatePem('base64');
        keyData.addKey('PEM', privPEM);
      }
      this.myPrivKey = ursa.createPrivateKey(privPEM, '', 'base64');
      // make a public key, to be used for encryption
      this.pubPEM = this.myPrivKey.toPublicPem('base64');
      this.myPubKey = ursa.createPublicKey(this.pubPEM, 'base64');
    }).bind(this));
  }
}

NoxCrypto.prototype.encryptString = function(data) {
  var encMsg = this.myPubKey.encrypt(new Buffer(data));
  return encMsg;
}

NoxCrypto.prototype.decryptString = function(data) {
  var decMsg = this.myPrivKey.decrypt(data);
  return decMsg;
}

NoxCrypto.prototype.signString = function(data) {
  var signature = this.myPrivKey.hashAndSign('sha256' , new Buffer(data) , undefined, 'base64', true);
  return signature;
}

NoxCrypto.prototype.signatureVerified = function(data, signature) {
  // receive public key in PEM format, data, and a signature
  // returns true if signature is valid.
  var verified = this.myPubKey.hashAndVerify('sha256', new Buffer(data), signature, 'base64', true);
  return verified;
}

module.exports = NoxCrypto;
