var ursa = require('ursa');
var Object2File = require(__dirname + '/object2file.js');

function isEmptyObject(obj) {
  return !Object.keys(obj).length;
}

function NoxCrypto (obj) {
  this.myPrivKey='';
  this.pubPEM;
  this.myPubKey='';
  // TODO this var currently only informs encryption, size is not currently saved with key!
  // this should be user configurable, and then saved as part of the key object.
  this.keySize=0;
  this.newKeySize=2048;
  var keys, privPEM;

  // accepts either dir, filename or public key
  if(obj['pubPEM']) {
    // object has public Key
    this.pubPEM=obj.pubPEM;
    this.myPubKey = ursa.createPublicKey(this.pubPEM, 'base64');
    this.keySize = this.myPubKey.getModulus().length*8;
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
        keys = ursa.generatePrivateKey(this.newKeySize, 65537);
        privPEM = keys.toPrivatePem('base64');
        keyData.addKey('PEM', privPEM);
      }
      this.myPrivKey = ursa.createPrivateKey(privPEM, '', 'base64');
      // make a public key, to be used for encryption
      this.pubPEM = this.myPrivKey.toPublicPem('base64');
      this.myPubKey = ursa.createPublicKey(this.pubPEM, 'base64');
      this.keySize = this.myPubKey.getModulus().length*8;
    }).bind(this));
  }
}

NoxCrypto.prototype.encrypt = function(plainText) {
  var keySizeBytes = this.keySize/8;
  var buffer = new Buffer(plainText);
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
    var encryptedBuffer = this.myPubKey.encrypt(tempBuffer);
    encryptedBuffersList.push(encryptedBuffer);
    bytesDecrypted += amountToCopy;
  }
  //concatenates all encrypted buffers and returns the corresponding String
  return Buffer.concat(encryptedBuffersList).toString('base64');
}

NoxCrypto.prototype.decrypt = function(cipherText) {
  var keySizeBytes = this.keySize/8;
  var encryptedBuffer = new Buffer(cipherText, 'base64');
  var decryptedBuffers = [];
  //if the plain text was encrypted with a key of size N, the encrypted
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
    var decryptedBuffer = this.myPrivKey.decrypt(tempBuffer, 'base64');
    decryptedBuffers.push(decryptedBuffer);
  }
  //concatenates all decrypted buffers and returns the corresponding String
  return Buffer.concat(decryptedBuffers).toString();
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
