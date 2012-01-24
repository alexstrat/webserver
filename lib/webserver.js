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
  var self = this;
  //Start http server according to options :
  
  if(typeof options.webserver == 'function') {
    this.webserver = options.webserver;
    this.once('hook::ready', function()  {
      self.startHookProxy();
    });

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

    this.webserver.listen(port, function(err, result){
      if (err) {
        self.emit('webserver::error', error);
        return;
      }
      self.emit('webserver::started');
      self.once('hook::ready', function()  {
        self.startHookProxy();
      });
    });
  }
  
  return this;
};

util.inherits(Webserver, Hook);

/**
 * The webserver listen on browser-client connection thru dnode (over socket.io).
 *
 * When a client gets connected, a dnode (over raw tcp or http) connection
 * is established with the main hook (could be the webserver or an other one)
 * communcation is proxied between the 2 dnode connections.
 *
 * WARN : for each new browser-cleint connection a new dnode connection with the hook
 * is established..
 * TODO : multiplexing these connection in a single one to spare tcp connections.
 */
Webserver.prototype.startHookProxy = function() {
  var dnode = require('dnode');

  //get hook to connect
  var remoteOptions = {
    host: this['hook-host'],
    port: this['hook-port']
  };

  var self = this;


  dnode(function(client, client_conn) {
    var hook_wrapper = this;
    var remote_hook;
    var client_name;

    client_conn.on('ready', function () {
      dnode(function(hook, hook_conn) {
        var client_wrapper = this;
        remote_hook = hook;

        //from hook to browser client
        client_wrapper.message = function(event, data, callback, sender) {
          client.message(event, data, callback, sender);
        };

        client_wrapper.hasEvent = function(event, callback) {
          client.hasEvent(event, callback);
        };

        hook_conn.on('ready', function() {
          client.message('proxy::ready');
        });

        client_conn.on('end', function () {
          hook_conn.end();
        });
      }).connect(remoteOptions);
    });
  

    //from client to hook
    this.message = function(event, data, callback, sender) {
      remote_hook.message(event, data, callback, sender);
    };

    this.hasEvent = function(event, callback) {
      remote_hook.hasEvent(event, callback);
    };

    this.report= function(_hook, cb) {
      remote_hook.report(_hook, cb);
    };

  }).listen(this.webserver);
};
