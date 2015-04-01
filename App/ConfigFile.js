

"use strict";
var
  FS = require('fs'),
  Debug = require('debug')('noxious:config');
class ConfigFile{
  constructor(Type, Path, Default){
    this.Type = Type;
    this.Path = Path;
    try {
      FS.accessSync(Path, FS.R_OK);
      this.Collection = new global[Type](JSON.parse(FS.readFileSync(Path)));
    } catch(error){
      this.Collection = new global[Type](Default);
      this.Write();
    }
  }
  Write(){
    var ToWrite = [];
    if(this.Type === 'Map'){
      this.Collection.forEach((Value, Key) => ToWrite.push([Key,Value]));
    } else {
      this.Collection.forEach((Value) => ToWrite.push(Value));
    }
    FS.writeFile(this.Path, JSON.stringify(ToWrite));
    Debug(`ConfigFile::Write writing to ${this.Path}`);
  }
  add(Value){this.Collection.add(Value); this.Write();}
  get(Key){return this.Collection.get(Key)}
  has(Key){return this.Collection.has(Key)}
  set(Key,Value){this.Collection.set(Key, Value); this.Write();}
  delete(Key){this.Collection.delete(Key); this.Write();}
  clear(){this.Collection.clear(); this.Write();}
  forEach(Callback, thisArg){this.Collection.forEach(Callback, thisArg)}
}
module.exports = ConfigFile;