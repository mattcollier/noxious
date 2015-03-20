var fs = require('fs');

function ensureExists(path, mask, cb) {
    if (typeof mask == 'function') { // allow the `mask` parameter to be optional
        cb = mask;
        mask = 0777;
    }
    fs.mkdir(path, mask, function(err) {
        if (err) {
          if (err.code == 'EEXIST') cb(null); // ignore the error if the folder already exists
          else cb(err); // something else went wrong
        } else cb(null); // successfully created folder
    });
}

function saveObject(dataDir, fileName, obj) {
  ensureExists(dataDir, 0777, function(err) {
    if(err) throw(err)
    else {
      fs.writeFile(dataDir + '/' + fileName, JSON.stringify(obj), {'encoding':'utf8'}, function(err) {
        if(err) {
            console.log('[' + fileName + '] File Save Error: ', err);
        } else {
            console.log('[' + fileName + '] File Save OK.');
        }
      });
    }
  });
}

function Object2File (dataDir, fileName) {
  this.content={};
  this.dataDir = dataDir;
  this.fileName=fileName;
  this.contentLoadedFromFile = false;
}

Object2File.prototype.getKey = function(key) {
  return this.content[key];
}

Object2File.prototype.addKey = function(key, value) {
  this.content[key] = value;
  saveObject(this.dataDir, this.fileName, this.content);
}

Object2File.prototype.delKey = function(key) {
  delete this.content[key];
  saveObject(this.dataDir, this.fileName, this.content);
}

Object2File.prototype.setContent = function(obj) {
  this.content = obj;
  saveObject(this.dataDir, this.fileName, this.content);
}

Object2File.prototype.getContent = function(callback) {
  if (!this.contentLoadedFromFile) {
    ensureExists(this.dataDir, 0777, (function(err) {
      fs.open(this.dataDir + '/' + this.fileName, 'r', (function(err, fd) {
        if (err && err.code == 'ENOENT') {
          console.log('[' + this.fileName + '] File does not exist, generating new object.');
          // create empty contact list
          this.content={};
          saveObject(this.dataDir, this.fileName, this.content);
        } else if (!err) {
          // file exists
          console.log('[' + this.fileName + ']  File exists.  Loading object.');
          this.content = JSON.parse(fs.readFileSync(this.dataDir + '/' + this.fileName, {'encoding':'utf8'}));
        } else throw(err);
        this.contentLoadedFromFile = true;
        callback(this.content);
      }).bind(this));
    }).bind(this));
  } else {
    callback(this.content);
  }
}

module.exports = Object2File;
