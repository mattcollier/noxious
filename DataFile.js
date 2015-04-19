
"use strict";
var
  fs = require('fs');

class DataFile{
  constructor(path, init) {
    this.path = path;
    this.init = init ? init : {};
    try {
      fs.accessSync(this.path, fs.R_OK);
      this.collection = JSON.parse(fs.readFileSync(this.path));
    } catch(error){
      this.collection = this.init;
      this.write();
    }
  }

  write(){
    fs.writeFile(this.path, JSON.stringify(this.collection));
  }
  getAll() { return this.collection; }
  get(key) { return this.collection[key]; }
  has(key) {
    let hasKey = true;
    if (this.collection[key] === undefined) {
      hasKey = false;
    }
    return hasKey;
  }
  set(key,value) { this.collection[key] = value; this.write(); }
  delete(key) { delete this.collection[key]; this.write(); }
  size() { return Object.keys(this.collection).length }
}

module.exports = DataFile;
