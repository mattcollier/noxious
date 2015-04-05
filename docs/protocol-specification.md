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
Name | Type | Required | Description
---- | ---- | -------- | -----------
content   | object    | true  |
from      | property  | true  | Sender's Tor hidden service name
pubPEM    | property  | true  | Sender's public key in PEM format
to        | property  | true  | Recipient's Tor hidden service name
type      | property  | true  | must equal 'introduction'

####encryptedData Messages
