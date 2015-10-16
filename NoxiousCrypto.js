"use strict";

var
  DataFile = require('./DataFile'),
  forge = require('node-forge'),
  rsa = require('node-forge').pki.rsa,
  pki = require('node-forge').pki;

class NoxiousCrypto{
  constructor(obj) {
    this.myPrivKey = null;
    this.pubPem = null;
    this.myPubKey = null;
    this.keySize=0;
    // default size for new keys
    this.newKeySize=3072;

    // accepts either dir, filename or public key
    if(obj['pubPem']) {
      // object has public Key
      this.pubPem = obj.pubPem;
      this.myPubKey = pki.publicKeyFromPem(this.pubPem);
      this.keySize = this.myPubKey.n.bitLength();
    } else {
      // assume it's a dataDir and filename
      let keyData = new DataFile(obj.path);
      if(keyData.has('privPem')) {
        // key already exists
        this.myPrivKey = pki.privateKeyFromPem(keyData.get('privPem'));
        this.pubPem = keyData.get('pubPem');
        this.myPubKey = pki.publicKeyFromPem(this.pubPem);
        this.keySize = this.myPubKey.n.bitLength();
        console.log('[NoxiousCrypto] Existing Key Bits: ', this.keySize);
      } else {
        // key was not on disk, create a new one
        // generate an RSA key pair in steps that attempt to run for a specified period
        // of time on the main JS thread
        var state = rsa.createKeyPairGenerationState(this.newKeySize, 0x10001);
        var step = (function() {
          if(!rsa.stepKeyPairGenerationState(state, 1000)) {
            console.log('[NoxiousCrypto] Generating Key...');
            process.nextTick(step);
          }
          else {
            console.log('[NoxiousCrypto] Key Generation Complete.');
            this.pubPem = pki.publicKeyToPem(state.keys.publicKey);
            keyData.set('privPem', pki.privateKeyToPem(state.keys.privateKey));
            keyData.set('pubPem', this.pubPem);
            this.myPrivKey = state.keys.privateKey;
            this.myPubKey = state.keys.publicKey;
            this.keySize = this.newKeySize;
          }
        }).bind(this);
        process.nextTick(step);
      }
    }
  }
  encrypt(plainText) {
    var keySizeBytes = Math.ceil(this.keySize/8);
    var buffer = new Buffer(plainText, 'utf8');
    var maxBufferSize = keySizeBytes - 42; //according to ursa documentation
    var bytesEncrypted = 0;
    var encryptedBuffersList = [];
    //loops through all data buffer encrypting piece by piece
    while(bytesEncrypted < buffer.length){
      //calculates next maximun length for temporary buffer and creates it
      var amountToCopy = Math.min(maxBufferSize, buffer.length - bytesEncrypted);
      var tempBuffer = new Buffer(amountToCopy);
      //copies next chunk of data to the temporary buffer
      buffer.copy(tempBuffer, 0, bytesEncrypted, bytesEncrypted + amountToCopy);
      //encrypts and stores current chunk
      var encryptedBuffer = new Buffer(this.myPubKey.encrypt(tempBuffer, 'RSA-OAEP'), 'binary');
      encryptedBuffersList.push(encryptedBuffer);
      bytesEncrypted += amountToCopy;
    }
    return Buffer.concat(encryptedBuffersList).toString('base64');
  }
  decrypt(cipherText) {
    var keySizeBytes = Math.ceil(this.keySize/8);
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
      var decryptedBuffer = this.myPrivKey.decrypt(tempBuffer.toString('binary'), 'RSA-OAEP');
      decryptedBuffers.push(new Buffer(decryptedBuffer, 'utf8'));
    }
    //concatenates all decrypted buffers and returns the corresponding String
    return Buffer.concat(decryptedBuffers).toString();
  }
  signString(data) {
    var md = forge.md.sha256.create();
    md.update(data, 'utf8');
    var pss = forge.pss.create({
      md: forge.md.sha256.create(),
      mgf: forge.mgf.mgf1.create(forge.md.sha256.create()),
      saltLength: 20
    });
    return new Buffer(this.myPrivKey.sign(md, pss), 'binary').toString('base64');
  }
  signatureVerified(data, signature) {
    let pss = forge.pss.create({
      md: forge.md.sha256.create(),
      mgf: forge.mgf.mgf1.create(forge.md.sha256.create()),
      saltLength: 20
    });
    var md = forge.md.sha256.create();
    md.update(data, 'utf8');
    return this.myPubKey.verify(md.digest().getBytes(), new Buffer(signature, 'base64').toString('binary'), pss);
  }
}

module.exports = NoxiousCrypto;
