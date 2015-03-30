

"use strict";
class H{
  static ReadStream(Stream){
    return new Promise(function(Resolve){
      var ToReturn = [];
      Stream.on('data', function(Data){
        ToReturn.push(Data.toString());
      }).on('end', function(){
        Resolve(ToReturn.join(''));
      });
    });
  }
}
module.exports = H;