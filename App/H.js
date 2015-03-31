

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
  static ForEach(Object, Callback){
    for(var I in Object){
      if(Object.hasOwnProperty(I) && I !== 'length'){
        Callback.call(Object[I], Object[I], I, Object);
      }
    }
  }
}
module.exports = H;