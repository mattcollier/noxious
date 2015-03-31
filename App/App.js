
"use strict";

var
  App = require('app'),
  HTTP = require('http'),
  Path = require('path'),
  Debug = require('debug')('noxious:app'),

  H = require('./H'),
  Messaging = require('./Messaging'),

  Server = null,
  Config = {
    ServerPort: 1111
  };

class Main{
  static Init(){
    App.setName("noxious");
    App.setPath('userData', Path.join(App.getPath('appData'), App.getName()));
    App.setPath('userCache', Path.join(App.getPath('cache'), App.getName()));
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
    Server.listen(Config.ServerPort, '127.0.0.1');
    Debug(`Main::CreateServer listening on localhost:${Config.ServerPort}`);
  }
}
Main.Init();