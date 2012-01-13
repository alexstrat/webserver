var Hook   = require('hook.io').Hook,
    http   = require('http'),
    util   = require('util');

//
// TODO: create a Hook.io browser hook with browserify,
// instead of requiring dnode directly here

var Webserver = exports.Webserver = function(options, callback) {
  Hook.call(this, options);
  this.clients = {};
};

util.inherits(Webserver, Hook);

Webserver.prototype.listenToServer = function(server, fn) {
  var self = this;

  if ('undefined' == typeof server) {
    // create a server that listens on port 80
    server = 80;
  }

  if ('number' == typeof server) {
    // if a port number is passed
    var port = server;
    server = require('http').createServer();
    this.server = server;

    // default response
    server.on('request', function (req, res) {
      res.writeHead(200);
      res.end('Welcome to hook.io.');
    });

    server.listen(port, function(err, result){
      if (err) {
        self.emit('webserver::error', error);
        fn(err);
        return;
      }
      _attachToDnode.call(self);
      self.emit('webserver::started');
      fn(undefined, result);
    });

  } else {
    this.server = server;
    this._attachToDnode();
  }
};

Webserver.prototype._attachToDnode = function() {
  var dnode = require('dnode');
  var self = this;

  //from hook cloud to clients
  //WARNING : echo ???
  this.on("**", function(data, callback){
    for(var id in this.clients) {
      self.clients[id].message(this.event, data, callback);
    }
  });

  dnode(function (client, conn) {
    conn.on('ready', function () {
        self.clients[conn.id] = client;
    });
  
    conn.on('end', function () {
        delete self.clients[conn.id];
    });

    this.message = function (event, data, callback) {
      //
      // Remark: Re-emits the browser event to your hook cloud
      //
      self.emit(event, data, callback);
    };
  }).listen(this.server);
};
