

"use strict";
var
  EventEmitter = require('events').EventEmitter,
  BrowserWindow = require('browser-window'),
  Path = require('path'),
  FS = require('fs'),
  Debug = require('debug')('noxious:renderer'),

  H = null,
  BrowserInstance = null;
class Renderer extends EventEmitter{
  constructor(){
    H = module.parent.exports.H;

    this.on('Spawn' , this.OnSpawn.bind(this));
    this.emit('Spawn');
  }
  OnSpawn(){
    BrowserInstance = new BrowserWindow({
      width: 900,
      height: 600
    });
    BrowserInstance.loadUrl(FS.realpathSync(__dirname + '/../Frontend/index.html'));
    if(process.argv.indexOf('--dev') !== -1){
      BrowserInstance.openDevTools();
    }
  }
}
module.exports = Renderer;