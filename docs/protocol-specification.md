Noxious Messaging Protocol Specification
==================================
###Encryption and Digital Signatures
All encryption and digital signatures are based on 3072 bit RSA public/private keys.

###Message Types
There are two types of messages Noxious uses to communicate: introduction, and
encryptedData.

####Introduction Messages
Introduction messages are exchanged once per contact during the contact request
process.  The introduction message contains a user's public encryption key.  The
public key is stored as part of the contact record for future use.  After
introduction messages have been exchanged between two parties, the parties may
begin sending and receiving encrypted messages.  The contents of the introduction
are digitally signed with the sending parties private key.  The recipient is able
to verify the signature utilizing the provided public key, which insures that the
contents of the introduction message have not been altered in transit.
```
{
  content: {
    from: 'f5jya7neu64cmhuz.onion',
    pubPEM: '<publicKey>',
    to: 'cniymubgqjzckk3s.onion',
    type: 'introduction'
  },
  signature: '<digitalSignature>'
}
```
Name | Type | Required | Encoding | Description
---- | ---- | -------- | --------   | -----------
content   | object    | true  |     |
from      | property  | true  | UTF-8   | Sender's Tor hidden service name
pubPEM    | property  | true  | BASE64  | Sender's public key in PEM format
to        | property  | true  | UTF-8   | Recipient's Tor hidden service name
type      | property  | true  | UTF-8   | must equal 'introduction'
signature | property  | true  | BASE64  | Digital signature based on a SHA256 hash of a stringified version of the content object.

#####Signing the 'content' object
The digital signature is based on a SHA256 hash of a stringified version of the
'content' object.  JavaScript's built-in JSON.stringify() method does not
guarantee that objects will be stringified in any particular order.  In io.js
the [canonical-json module][CJ] is used to stringify the properties of the 'content'
object in **alphabetical order** as shown in the example above.

####encryptedData Messages
Parties may begin sending 'encryptedData' messages after they have exchanged
public keys by way of sending and receiving 'introduction' messages.
```
{
  content: {
    clearFrom: 'f5jya7neu64cmhuz.onion',
    data: '<encryptedContent>',
    type: 'encryptedData'
  }
}
```
Name | Type | Required | Encoding | Description
---- | ---- | -------- | --------   | -----------
content   | object    | true  |         |
clearFrom | property  | true  | UTF-8   | Sender's Tor hidden service name
data      | property  | true  | BASE64  | RSA encrypted [message 'content' object](#message-content-object)
type      | property  | true  | UTF-8   | must equal 'encryptedData'

#####The 'clearFrom' Property
The 'clearFrom' property is used to quickly determine if the message is from a party
listed in the recipient's contact list.  This ensures that the sender's public
key is on file and therefore the digital signature contained in the message can
be verified.  A message from an unknown party is dropped which prevents the
recipient from being spammed by an unknown sender.

#####Message 'content' Object
```
{
  content: {
    from: 'f5jya7neu64cmhuz.onion',
    msgText: '<plainText>',
    to: 'cniymubgqjzckk3s.onion',
  },
  signature: '<digitalSignature>'
}
```
Name | Type | Required | Encoding | Description
---- | ---- | -------- | --------   | -----------
content   | object    | true  |     |
from      | property  | true  | UTF-8   | Sender's Tor hidden service name
msgText   | property  | true  | UTF-8   | Plain text message
to        | property  | true  | UTF-8   | Recipient's Tor hidden service name
type      | property  | true  | UTF-8   | must equal 'introduction'
signature | property  | true  | BASE64  | Digital signature based on a SHA256 hash of a stringified version of the content object.

#####Signing the 'content' object
The digital signature is based on a SHA256 hash of a stringified version of the
'content' object.  JavaScript's built-in JSON.stringify() method does not
guarantee that objects will be stringified in any particular order.  In io.js
the [canonical-json module][CJ] is used to stringify the properties of the 'content'
object in **alphabetical order** as shown in the example above.

###Transmitting Messages
Messages are transmitted to the recipient's Tor hidden service name with an HTTP
POST request on port 1111 via Tor's socksv5 proxy.  See the
[NoxClient transmitObject function][TOF] for an io.js implementation.

[CJ]:https://www.npmjs.com/package/canonical-json
[TOF]:https://github.com/mattcollier/noxious/blob/master/nox-client.js
