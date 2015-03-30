

"use strict";
var
  Debug = require('debug')('noxious:messaging');

class Messaging{
  static Introduction(Message, ToReturn){
    //TODO: Do Something
  }
  static Encrypted(Message, ToReturn){
    //TODO: Do Something
  }
  static Process(Message){
    var ToReturn = {Code: 403, Reason: ''};
    try {
      Message = JSON.parse(Message);
    } catch(error){return ToReturn}
    Debug("Messaging::Process Decoding Message");
    if(!Message.content) return ToReturn;
    Message = Message.content;
    if(!Message.type) return ToReturn;

    if(Message.type === 'introduction'){
      Messaging.Introduction(Message, ToReturn);
    } else if(Message.type === 'encryptedData'){
      Messaging.Encrypted(Message, ToReturn);
    }
    return ToReturn;
  }
}
module.exports = Messaging;