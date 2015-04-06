Noxious Messaging Protocol Overview
==================================

Noxious applies a **REST**ful approach for information exchange.  Messages are
transmitted as HTTP POST requests.  Message delivery confirmation is accomplished
through the use of HTTP status codes.

### Tor and Hidden Services

The Noxious 'Client ID' is a [Tor hidden service name][THSN]
with '.onion' removed from the end.  Noxious sets up a rudimentary HTTP server
to accept messages arriving at the hidden service name.  The Tor network is responsible
for delivering messages to their destination.  Messages sent from a Tor client
to a Tor hidden service never leave the Tor network which would make it difficult
for anyone, including other chat participants, to determine a user's physical
location.  At the time of this writing, ALL traffic passing over the Tor network
is encrypted using the RSA algorithm using a 1024 bit key.

### Message Encryption

All Noxious chat messages are digitally signed, then encrypted using the RSA
algorithm using a 3072 bit key before they are passed to the Tor network for
delivery.  The public key is used to encrypt the message and only the person
possessing the matching private key will be able to decrypt the message.  Before
encryption, the message message, including the senders Tor hidden service name
is digitally signed using the SHA-256 hashing algorithm.  

Upon receipt, message are decrypted using the recipients private key.  This
reveals the contents of the message including the digital signature.  The
digital signature is verified using the senders public key.  This insures that
the message has not been altered during transit and in fact originated from the
proper sender.

[THSN]:https://trac.torproject.org/projects/tor/wiki/doc/HiddenServiceNames