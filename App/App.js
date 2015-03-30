
"use strict";

var
  HTTP = require('http'),
  Debug = require('debug')('noxious'),

  Server = null,
  Config = {
    ServerPort: 1111
  };

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
      } else if(Request.method !== 'Post' || Request.url !== '/') return ;

    });
    Server.listen(Config.ServerPort, '127.0.0.1');
    Debug(`Main::CreateServer listening on localhost:${Config.ServerPort}`);
  }
}
Main.Init();