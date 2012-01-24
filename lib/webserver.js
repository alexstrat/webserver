var Hook   = require('hook.io').Hook,
    http   = require('http'),
    util   = require('util');

//
// TODO: create a Hook.io browser hook with browserify,
// instead of requiring dnode directly here

/**
 * Create a new hook-webserver.
 *
 * Supplementary options :
 *
 * - webserver :
 *    Specify a instance of http server on which start hook-webserver.
 *    If a number is given, a new http server will be instanciate on the corresponding port.
 *    If no webserver specified, default port is 8080.
 *    Note : if a function (an http server) is actually given, webroot and basicAuth will be ignored.
 *
 * - webroot :
 *    if you specify a webroot a static web server will start serving files in that root.
 *
 * - basicAuth :
 *    if you nedd a basic authentication
 *      - username
 *      - password
 *
 */

var Webserver = exports.Webserver = function(options, callback) {
  Hook.call(this, options);
  this.browserClients = {};

  //Start http server according to options :
  
  if(typeof options.webserver == 'function') {
    this.webserver = options.webserver;
    this._attachToDnode();

  } else {
    // if no options create a server that listens on port 8080
    var port = ('number' == typeof options.webserver) ? options.webserver : 8080;

    var connect = require('connect');
    this.webserver = connect.createServer();

    if(typeof options.basicAuth == 'object') {
      this.webserver.use(connect.basicAuth(
        options.basicAuth.username || 'admin',
        options.basicAuth.password || 'admin'
      ));
    }

    if(typeof options.webroot == 'string') {
      var path = require('path').join(__dirname, '..', options.webroot);
      this.webserver.use(connect.static(path));
    }

    var self = this;
    this.webserver.listen(port, function(err, result){
      if (err) {
        self.emit('webserver::error', error);
        return;
      }
      self._attachToDnode();
      self.emit('webserver::started');
    });
  }
  
  return this;
};

util.inherits(Webserver, Hook);

Webserver.prototype._attachToDnode = function() {
  var dnode = require('dnode');
  var self = this;

  //from hook cloud to browserClients
  //WARNING : echo ???
  this.on("**", function(data, callback){
    for(var id in this.browserClients) {
      self.browserClients[id].message(this.event, data, callback);
    }
  });

  dnode(function (client, conn) {
    conn.on('ready', function () {
        self.browserClients[conn.id] = client;
    });
  
    conn.on('end', function () {
        delete self.browserClients[conn.id];
    });

    this.message = function (event, data, callback) {
      //
      // Remark: Re-emits the browser event to your hook cloud
      //
      self.emit(event, data, callback);
    };
  }).listen(this.webserver);
};
