# noxious
noxious is designed to be a secure and anonymous instant messaging platform.

##Anonymous
All communications are conducted between tor hidden services and never leave the tor network.
See https://www.torproject.org/docs/hidden-services.html.en to learn more about tor hidden services.

##Secure
In addition to the encryption offered by the tor hidden service protocol, all chat messages are
public-key encrypted using a 2048 bit key.  All cryto is handled by native OpenSSL libraries via
the [node ursa module](https://github.com/quartzjer/ursa).

##Platform
noxious is built on the [Atom Shell Framework](https://github.com/atom/atom-shell).

###Operating System Support

####Linux
The current version has been tested on 32bit and 64bit version of Debian Linux.
#####Build Instructions
######OS Dependencies
```
apt-get install tor build-essential libssl-dev
```


####OSX
The current version has been tested on OSX
