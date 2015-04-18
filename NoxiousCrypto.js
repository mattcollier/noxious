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
    console.log('[NoxiousCrypto] obj: ', obj);
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
  encrypt(plainText) {
    return this.myPubKey.encrypt(plainText, 'RSA-OAEP');
  }
  decrypt(cipherText) {
    return this.myPrivKey.decrypt(cipherText, 'RSA-OAEP');
  }
  signString(data) {
    //let signature = this.myPrivKey.hashAndSign('sha256' , new Buffer(data) , undefined, 'base64', true);
    var md = forge.md.sha256.create();
    md.update(data, 'utf8');
    var pss = forge.pss.create({
      md: forge.md.sha256.create(),
      mgf: forge.mgf.mgf1.create(forge.md.sha256.create()),
      saltLength: 20
      // optionally pass 'prng' with a custom PRNG implementation
      // optionalls pass 'salt' with a forge.util.ByteBuffer w/custom salt
    });
    return this.myPrivKey.sign(md, pss);
  }
  signatureVerified(data, signature) {
    // verify RSASSA-PSS signature
    let pss = forge.pss.create({
      md: forge.md.sha256.create(),
      mgf: forge.mgf.mgf1.create(forge.md.sha256.create()),
      saltLength: 20
      // optionally pass 'prng' with a custom PRNG implementation
    });
    var md = forge.md.sha256.create();
    md.update(data, 'utf8');
    return this.myPubKey.verify(md.digest().getBytes(), signature, pss);
  }
}

module.exports = NoxiousCrypto;
