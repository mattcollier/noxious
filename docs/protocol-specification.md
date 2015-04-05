Noxious Messaging Protocol Specification
==================================
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
  }
  signature: '<digitalSignature>'
}
```
Name | Type | Required | Encoding | Description
---- | ---- | -------- | --------   | -----------
content   | object    | true  |     |
from      | property  | true  | utf-8   | Sender's Tor hidden service name
pubPEM    | property  | true  | BASE64  | Sender's public key in PEM format
to        | property  | true  | utf-8   | Recipient's Tor hidden service name
type      | property  | true  | utf-8   | must equal 'introduction'
signature | property  | true  | BASE64  | Digital signature based on a SHA256 hash of a stringified version of the content object.
#####Signing the 'content' object
The digital signature is based on a SHA256 hash of a stringified version of the
'content' object.  JavaScript's built-in JSON.stringify() method does not
guarantee that objects will be stringified in any particular order.  In io.js
the [canonical-json module][CJ] is used to stringify the properties of the 'content'
object in **alphabetical order** as shown in the example above.

####encryptedData Messages
```
{
  content: {
    clearFrom: 'f5jya7neu64cmhuz.onion',
    data: '<encrypted'
  }
}
```

[CJ]:https://www.npmjs.com/package/canonical-json
