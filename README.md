# noxious
noxious is designed to be a secure, decentralized, and anonymous instant messaging platform.

##Anonymous
All communications are conducted between [tor hidden services](https://www.torproject.org/docs/hidden-services.html.en) and never leave the tor network.

##Secure
In addition to the encryption offered by the tor hidden service protocol, all chat messages are
RSA public-key encrypted using a 3072 bit key.  All cryto is handled by native OpenSSL libraries via
the [node ursa module](https://github.com/quartzjer/ursa).

##Platform
noxious is built on the [Atom Shell Framework](https://github.com/atom/atom-shell).

##Screenshot
![noxious screenshot](https://github.com/mattcollier/noxious/blob/screenshots/screenshot1.png)

###Operating System Support

####Linux
The current version has been tested on 32bit and 64bit version of Debian Linux.
#####Build Instructions
######OS Dependencies
```
apt-get install tor build-essential libssl-dev git
```
######io.js
[Get io.js here.](https://iojs.org/en/index.html), and you can install it based on
[these instructions](http://jonathanmh.com/installing-io-js-ubuntu-digital-ocean-droplet/). npm, node package
manager will be included with the other io.js binaries.
######npm
Once you have a working npm installation, **as root**, installing the following modules globally with the following command:
```
npm install node-gyp -g
```
######Clone and build
Next, as a **regular user**, clone this repository into the folder of your choice:
```
git clone https://github.com/mattcollier/noxious.git
cd noxious
npm install
```
The 'npm install' command will download all the required dependencies.
#####Rebuild the native modules
from inside the noxious folder, run the build script appropriate for your OS.

OS        | Script Name
--------- | -----------
Linux 64  | build_x64.sh
Linux 32  | build_ia32.sh
OSX       | build_darwin.sh

At the end of the script execution, you should see 'gyp info ok'.

note: if you already have atom-shell installed on your system, the build scripts
expect you to have at least v0.22.1.  You may upgrade atom-shell or modify the
'target' specified in the build script as appropriate.
#####Run noxious
From inside the noxious folder do:
```
npm start
```
You should see the GUI appear.  Within 30 seconds or so, you should see your 'Chat ID'
appear next to the asterisk (*) in the upper left hand corner of the window.  You may now
provide your ID to another noxious user who can add you as a contact which initiates a 'contact
request' process which facilitates the exchange of public keys.

####OSX
The current version has been tested on OSX
####Windows
noxious has been successfully built on Windows.  Instructions are forthcoming.
###Support
Please submit and issue.  We can also be reached via irc at #noxious on freenode.
