# Noxious
Noxious is designed to be a secure, decentralized, and anonymous instant messaging platform.
## Anonymous
All communications are conducted between [tor hidden services](https://www.torproject.org/docs/hidden-services.html.en) and never leave the tor network.
## Secure
In addition to the encryption offered by the tor hidden service protocol, all chat messages are
RSA public-key encrypted using a 3072 bit key.  All crytography is handled by the [forge module](https://github.com/digitalbazaar/forge).  Although forge is 100%
JavaScript, it does access the CSPRNG (Cryptographically Secure Random Number
Generator) provided by the native openssl library via a call to [node's crypto.randomBytes
function](https://iojs.org/api/crypto.html#crypto_crypto_randombytes_size_callback).
## Platform
Noxious is built on the [Electron Application Shell](http://electron.atom.io/).
## Screenshot
![noxious screenshot](https://github.com/mattcollier/noxious/blob/screenshots/screenshot1.png)
### Operating System Support
The current version has been tested on 32bit and 64bit version of Debian Linux,
OSX 64bit
##### Installation Instructions
###### Node.js
[Get Node.js here.](https://nodejs.org).  npm, node package manager will be included with the other Node.js binaries.

###### Clone and Build
Next, as a **regular user**, clone this repository into the folder of your choice:
```
git clone https://github.com/mattcollier/noxious.git
cd noxious
npm install
```
The 'npm install' command will download all the required dependencies.
##### Run Noxious
From inside the noxious folder do:
```
npm start
```
You should see the GUI appear.  Within 30 seconds or so, you should see your 'Chat ID'
appear next to the asterisk (*) in the upper left hand corner of the window.  
You may now provide your Chat ID to another Noxious user who can add you as a
contact which initiates a 'contact request' process which facilitates the
exchange of public keys.
### Support
Please [submit an issue](https://github.com/mattcollier/noxious/issues).  We can
also be reached via irc at #noxious on freenode.
## Noxious Chat Bot
The [Noxious Chat Bot](https://github.com/mattcollier/noxiousChatBot) is
available for testing.  The bot is console based and utilizes native openssl
libraries for crypto.  Successful communication between the Noxious Client and
the Noxious Chat Bot demonstrates that the JavaScript forge module utilized
in the Noxious client is openssl compatible.
