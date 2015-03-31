
"use strict";

var
  App = require('app'),
  HTTP = require('http'),
  Path = require('path'),
  Debug = require('debug')('noxious:app'),

  H = require('./H'),
  Messaging = require('./Messaging'),
  ConfigFile = require('./ConfigFile');

App.setName("noxious");
App.setPath('userData', Path.join(App.getPath('appData'), App.getName()));
App.setPath('userCache', Path.join(App.getPath('cache'), App.getName()));

var
  Server = null,
  Contacts = new ConfigFile('Set', Path.join(App.getPath('userData'), 'Contacts.json'), []),
  Config = new ConfigFile('Map', Path.join(App.getPath('userData'), 'Config.json'), [['ServerPort', 1111]]);

class Main{
  static Init(){
    Main.CreateServer();
  }
  static CreateServer(){
    Server = HTTP.createServer(function(Request, Resource){
      if(Request.method === 'GET'){
        Resource.writeHead(200, {'Content-Type': 'text/plain'});
        Resource.end('Hello world!');
        return ;
      } else if(Request.method !== 'POST' || Request.url !== '/'){
        Resource.writeHead(400, {'Content-Type': 'text/plain'});
        Resource.end('*cough* *cough*');
        return ;
      }
      H.ReadStream(Request).then(function(Data){
        var Info = Messaging.Process(Data);
        Resource.writeHead(Info.Code, {'Content-Type': 'application/json'});
        if(Info.Code === 20){
          Resource.write(JSON.stringify({status: 'OK'}));
        } else {
          Resource.write(JSON.stringify({reason: Info.Reason}));
        }
        Resource.end();
        // TODO: Notify the UI
      });
    });
    Server.listen(Config.get('ServerPort'), '127.0.0.1');
    Debug(`Main::CreateServer listening on localhost:${Config.get('ServerPort')}`);
  }
}
Main.Init();