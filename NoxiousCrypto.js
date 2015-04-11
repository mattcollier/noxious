"use strict";

var
  ursa = require('ursa'),
  DataFile = require('./DataFile');

class NoxiousCrypto{
  constructor(obj) {
    this.myPrivKey='';
    this.pubPEM;
    this.myPubKey='';
    this.keySize=0;
    // default size for new keys
    this.newKeySize=3072;
    let
      keys,
      privPEM;

    // accepts either dir, filename or public key
    if(obj['pubPEM']) {
      // object has public Key
      this.pubPEM=obj.pubPEM;
      this.myPubKey = ursa.createPublicKey(this.pubPEM, 'base64');
      this.keySize = this.myPubKey.getModulus().length*8;
    } else {
      // assume it's a dataDir and filename
      let keyData = new DataFile(obj.path);
      if(keyData.has('PEM')) {
        // key already exists
        privPEM = keyData.get('PEM');
      } else {
        // key was not on disk, create a new one
        keys = ursa.generatePrivateKey(this.newKeySize, 65537);
        privPEM = keys.toPrivatePem('base64');
        keyData.set('PEM', privPEM);
      }
      this.myPrivKey = ursa.createPrivateKey(privPEM, '', 'base64');
      // make a public key, to be used for encryption
      this.pubPEM = this.myPrivKey.toPublicPem('base64');
      this.myPubKey = ursa.createPublicKey(this.pubPEM, 'base64');
      this.keySize = this.myPubKey.getModulus().length*8;
    }
  }
  encrypt(plainText) {
    let
      keySizeBytes = this.keySize/8,
      buffer = new Buffer(plainText),
      maxBufferSize = keySizeBytes - 42, //according to ursa documentation
      bytesDecrypted = 0,
      encryptedBuffersList = [];
    //loops through all data buffer encrypting piece by piece
    while(bytesDecrypted < buffer.length){
      //calculates next maximun length for temporary buffer and creates it
      let amountToCopy = Math.min(maxBufferSize, buffer.length - bytesDecrypted);
      let tempBuffer = new Buffer(amountToCopy);
      //copies next chunk of data to the temporary buffer
      buffer.copy(tempBuffer, 0, bytesDecrypted, bytesDecrypted + amountToCopy);
      //encrypts and stores current chunk
      encryptedBuffersList.push(this.myPubKey.encrypt(tempBuffer));
      bytesDecrypted += amountToCopy;
    }
    //concatenates all encrypted buffers and returns the corresponding String
    return Buffer.concat(encryptedBuffersList).toString('base64');
  }
  decrypt(cipherText) {
    let
      keySizeBytes = this.keySize/8,
      encryptedBuffer = new Buffer(cipherText, 'base64'),
      decryptedBuffers = [];
    //if the plain text was encrypted with a key of size N, the encrypted
    //result is a string formed by the concatenation of strings of N bytes long,
    //so we can find out how many substrings there are by diving the final result
    //size per N
    let totalBuffers = encryptedBuffer.length / keySizeBytes;
    //decrypts each buffer and stores result buffer in an array
    for(let i = 0 ; i < totalBuffers; i++){
      //copies next buffer chunk to be decrypted in a temp buffer
      let tempBuffer = new Buffer(keySizeBytes);
      encryptedBuffer.copy(tempBuffer, 0, i*keySizeBytes, (i+1)*keySizeBytes);
      //decrypts and stores current chunk
      decryptedBuffers.push(this.myPrivKey.decrypt(tempBuffer, 'base64'));
    }
    //concatenates all decrypted buffers and returns the corresponding String
    return Buffer.concat(decryptedBuffers).toString();
  }
  signString(data) {
    let signature = this.myPrivKey.hashAndSign('sha256' , new Buffer(data) , undefined, 'base64', true);
    return signature;
  }
  signatureVerified(data, signature) {
    // receive public key in PEM format, data, and a signature
    // returns true if signature is valid.
    let verified = false;
    try {
      verified = this.myPubKey.hashAndVerify('sha256', new Buffer(data), signature, 'base64', true);
    } catch(error) {
      // TODO Found that if one attempts to verify signature with an incorrect
      // pub key an error is thrown.  Possible ursa issue?
      console.log('[NoxCrypto] Error thrown while verifying signature.');
    }
    return verified;
  }
}

module.exports = NoxiousCrypto;
