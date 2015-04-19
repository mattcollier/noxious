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
          // run for 100 ms
          if(!rsa.stepKeyPairGenerationState(state, 1000)) {
            console.log('[NoxiousCrypto] Generating Key...');
            process.nextTick(step);
          }
          else {
            // done, turn off progress indicator, use state.keys
            console.log('[NoxiousCrypto] Key Generation Complete.');
            this.pubPem = pki.publicKeyToPem(state.keys.publicKey);
            keyData.set('privPem', pki.privateKeyToPem(state.keys.privateKey));
            keyData.set('pubPem', this.pubPem);
            this.myPrivKey = state.keys.privateKey;
            // make a public key, to be used for encryption
            this.myPubKey = state.keys.publicKey;
            this.keySize = this.newKeySize;
          }
        }).bind(this);
        // turn on progress indicator, schedule generation to run
        process.nextTick(step);
      }
    }
  }
  binEncrypt(plainText) {
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
      console.log("encryptedBuffer is a Buffer : ", Buffer.isBuffer(encryptedBuffer));
      encryptedBuffersList.push(encryptedBuffer);
      bytesEncrypted += amountToCopy;
    }
    //let something = new Buffer(encryptedBuffersList.length * keySizeBytes);
    //let bufferCount = 0;
    return Buffer.concat(encryptedBuffersList).toString('base64');
    //console.log("BufferListSize :", encryptedBuffersList.length);
    //for(let buf of encryptedBuffersList) {
    //  console.log("Length of THIS buffer : ", buf.length);
    //  buf.copy(something, bufferCount * keySizeBytes);
    //  bufferCount++;
    //}
    //console.log('Length of Something: ', something.length);
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
    //encryptedBuffersList = [];
    //encryptedBuffersList.push(new Buffer('First Thing'));
    //encryptedBuffersList.push(new Buffer('Second Thing'));
    //console.log('[ebl] ', Buffer.concat(encryptedBuffersList).toString('base64'));
    // console.log('decrypted: ', decrypt(Buffer.concat(encryptedBuffersList).toString('base64')));
    // Works for binary
    // return Buffer.concat(encryptedBuffersList);
    return Buffer.concat(encryptedBuffersList).toString('base64');
    //return new Buffer(this.myPubKey.encrypt(plainText, 'RSA-OAEP'), binary).toString('base64');
  }
  binDecrypt(cipherText) {
    console.log('****** cipherText length: ', cipherText.length);
    var keySizeBytes = Math.ceil(this.keySize/8);
    // works for binary
    //var encryptedBuffer = new Buffer(cipherText, 'binary');
    var encryptedBuffer = new Buffer(cipherText, 'base64');
    console.log('****** ebuffer length: ', encryptedBuffer.length);
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
      // console.log('#### decrypted chunk: ', decryptpedBuffer.toString());
      decryptedBuffers.push(new Buffer(decryptedBuffer, 'utf8'));
    }
    //concatenates all decrypted buffers and returns the corresponding String
    return Buffer.concat(decryptedBuffers).toString();
  }
  decrypt(cipherText) {
    console.log('****** base64 length: ', cipherText.length);
    var keySizeBytes = Math.ceil(this.keySize/8);
    var binaryString = new Buffer(cipherText, 'base64').toString('binary');
    console.log('****** binary length: ', binaryString.length);
    var encryptedBuffer = new Buffer(binaryString, 'binary');
    console.log('****** ebuffer length: ', encryptedBuffer.length);
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
      var decryptedBuffer = this.myPrivKey.decrypt(tempBuffer, 'RSA-OAEP');
      console.log('#### decrypted chunk: ', decryptpedBuffer.toString());
      decryptedBuffers.push(decryptedBuffer);
    }
    //concatenates all decrypted buffers and returns the corresponding String
    return Buffer.concat(decryptedBuffers).toString();
  }
  signString(data) {
    //let signature = this.myPrivKey.hashAndSign('sha256' , new Buffer(data) , undefined, 'base64', true);
    var md = forge.md.sha1.create();
    md.update(data, 'utf8');
    var pss = forge.pss.create({
      md: forge.md.sha1.create(),
      mgf: forge.mgf.mgf1.create(forge.md.sha1.create()),
      saltLength: 20
      // optionally pass 'prng' with a custom PRNG implementation
      // optionalls pass 'salt' with a forge.util.ByteBuffer w/custom salt
    });
    // return new Buffer(this.myPrivKey.sign(md, pss)).toString('base64');
    return new Buffer(this.myPrivKey.sign(md, pss), 'binary').toString('base64');
  }
  signatureVerified(data, signature) {
    // verify RSASSA-PSS signature
    let pss = forge.pss.create({
      md: forge.md.sha1.create(),
      mgf: forge.mgf.mgf1.create(forge.md.sha1.create()),
      saltLength: 20
      // optionally pass 'prng' with a custom PRNG implementation
    });
    var md = forge.md.sha1.create();
    md.update(data, 'utf8');
    // return this.myPubKey.verify(md.digest().getBytes(), new Buffer(signature).toString('binary'), pss);
    return this.myPubKey.verify(md.digest().getBytes(), new Buffer(signature, 'base64').toString('binary'), pss);
  }
}

module.exports = NoxiousCrypto;
