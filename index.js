/*
 *  Copyright (c) 2015, vmolsa (MIT)
 *
 * API
 *  
 *   var req = new requestStream([stream]) // returns Stream object
 *   
 *   req.write(data, encoding, callback)
 *   req.end(data, encoding, callback)
 *   req.setTimeout(timeout)
 *   req.setEncoding(encoding)
 *
 *   req.on('event', callback)
 *   req.off('event', [callback])
 *
 *   req.onRequest('event', callback([arg1, [arg2, [arg3, [... [callback]]]]]]))
 *   req.onSession('event', callback(session, [arg1, [arg2, [arg3, [...]]]]]))
 *   req.onStream('event', callback(stream, [arg1, [arg2, [arg3, [...]]]]]))
 *
 *   req.newRequest('event', [arg1, [arg2, [arg3, [...]]]]], [callback([reply])])
 *   req.newSession('event', [arg1, [arg2, [arg3, [...]]]]], callback(session))
 *   req.newStream('event', [arg1, [arg2, [arg3, [...]]]]], callback(session))
 *
 *   req.offRequest('event')
 *   req.offSession('event')
 *   req.offStream('event')
 * 
 * EVENTS
 *
 *  'error', callback(error)
 *  'close', callback()
 *  'end',   callback()
 * 
 * Session Prototype
 *   
 *   session.on('event', callback([arg1, [arg2, [arg3, [... [callback]]]]]]))
 *   session.off('event', [callback])
 *
 *   session.end()
 *
 *   session.newRequest('event', [arg1, [arg2, [arg3, [...]]]]], [callback([reply])])
 *
 * Stream
 *  
 *  http://nodejs.org/api/stream.html
 *
 * Session.on || onRequest
 * 
 *  response callback is last argument of callback function if client is waiting reply from request.
 *
 */
 
'use strict';

(function() {
  var _ = require('underscore');
  var native_emitter = require('events').EventEmitter;
  var native_stream = require('stream');
  var native_buffer = null;
  
  try {
    native_buffer = Buffer;    
  } catch (ignored) { }

  if (!native_buffer) {
    native_buffer = require('buffer');
  }

  function parseCallback(argu, index, returnTo) {
    var args = _.toArray(argu).slice(index);
    var callback = _.last(args);
    
    if (_.isFunction(callback)) {
      args = _.initial(args);
    } else {
      callback = null;
    }
    
    if (_.isFunction(returnTo)) {
      return returnTo(args, callback);
    }
  }
  
  function emitError(self, code, message) {
    var codes = {
      200: 'OK',
      400: 'Bad Request',
      404: 'Not Found',
      408: 'Request Timeout',
      503: 'Service Unavailable',
    };
    
    var error = new Error();
    
    if (message) {
      error.message = message;
    }
    
    error.name = _.isString(codes[code]) ? codes[code] : 'Unknown Error';
    error.code = code;
  
    if (native_emitter.listenerCount(self, 'error')) {
      return self.emit('error', error);
    }
    
    throw error;
  }
  
  function requestStream(socket) {
    var self = this;
    native_stream.call(self);
    
    self._encoding = 'buffer';
    self._isAlive = true;
    self._sequence = 0 >>> 0;
    self._waitTime = 5000;
    self._queue = {};
    self._onRequest = {};
    self._onSession = {};
    self._onStream = {};
    
    if (_.isObject(socket) && socket instanceof native_stream) {
      socket.pipe(self).pipe(socket);
    }
  }
  
  function Session(socket, local, remote) {
    native_emitter.call(this);
    
    this._socket = socket;
    this._local = local;
    this._remote = remote;
  }
  
  function Stream(socket, local, remote) {
    native_stream.Stream.call(this);
    
    this._socket = socket;
    this._local = local;
    this._remote = remote;
    this._encoding = 'buffer';
    this.writable = true;
    this.readable = true;
  }
  
  function newEvent(self, callback) {
    var id = self._sequence++ >>> 0;
    
    if (!id) {
      return newEvent(self, callback);
    }

    if (self._queue[id]) {
      return newEvent(self, callback);
    }
    
    if (_.isFunction(callback)) {
      self._queue[id] = callback;
    }

    return id;
  }
  
  function writeToSocket(self, data, callback) {
    var out = JSON.stringify(data);
    var len = native_buffer.byteLength(out, 'utf8');
    var id = 0;

    if (self._isAlive) {
      if (_.isFunction(callback)) {
        var timer = null;
        var response = function(reply) {
          clearTimeout(timer);

          if (self._queue[id]) {
            delete self._queue[id];
          }

          if (!reply) {
            reply = { status: 408 };
          }

          callback.call(self, reply);
        };

        id = newEvent(self, response);
        timer = setTimeout(response, self._waitTime);
      }

      var buf = new native_buffer(len + 8);

      buf.writeUInt32LE(len >>> 0, 0);
      buf.writeUInt32LE(id >>> 0, 4);
      buf.write(out, 8, len, 'utf8');

      if (self._encoding !== 'buffer') {
        self.emit('data', buf.toString(self._encoding));
      } else {
        self.emit('data', buf);
      }
    } else {
      if (_.isFunction(callback)) {
        callback.call(self, { status: 503 });
      }
    }
  }
  
  function parsePacket(self, data, request, reply) {
    if (_.isObject(data) && _.isString(data.action)) {      
      switch (data.action) {
        case 'reply':
          if (_.isNumber(data.id) && _.isFunction(self._queue[data.id])) {            
            self._queue[data.id].call(self, data.reply);
            
            return reply({ status: 200 });
          }
          
          return reply({ status: 400 });
        case 'request':
          if (!_.isString(data.name)) {
            return reply({ status: 400 });
          }
          
          if (!_.isFunction(self._onRequest[data.name])) {
            return reply({ status: 404 });
          }

          var callback = self._onRequest[data.name];
          
          if (request) {
            var response = function() {
              return reply({ status: 200, response: _.toArray(arguments) });
            };
            
            if (_.isArray(data.args)) {
              data.args.push(response);
              callback.apply(self, data.args);
            } else {
              callback.call(self, response);
            }
          } else {
            if (_.isArray(data.args)) {
              callback.apply(self, data.args);
            } else {
              callback.call(self, null);
            }
            
            return reply({ status: 200 });
          }
          
          break;
        case 'session':
          if (!_.isString(data.name) || !_.isNumber(data.remote)) {
            return reply({ status: 400 });
          }
          
          if (!_.isFunction(self._onSession[data.name])) {
            return reply({ status: 404 });
          }

          var local = newEvent(self);
          var session = new Session(self, local, data.remote);
          var callback = self._onSession[data.name];
          
          self._queue[local] = session;
          
          if (_.isArray(data.args)) {
            data.args.unshift(session);
            callback.apply(self, data.args);
          } else {
            callback.call(self, session);
          }

          return reply({ status: 200, remote: local });
        case 'stream':
          if (!_.isString(data.name) || !_.isNumber(data.remote)) {
            return reply({ status: 400 });
          }
          
          if (!_.isFunction(self._onStream[data.name])) {
            return reply({ status: 400 });
          }

          var local = newEvent(self);
          var stream = new Stream(self, local, data.remote);
          var callback = self._onStream[data.name];
          
          self._queue[local] = stream;
          
          if (_.isArray(data.args)) {
            data.args.unshift(stream);
            callback.apply(self, data.args);
          } else {
            callback.call(self, stream);
          }

          return reply({ status: 200, remote: local });        
        case 'emit':
          if (!_.isNumber(data.id) || !_.isString(data.event)) {
            return reply({ status: 400 });
          }
          
          var session = self._queue[data.id];

          if (_.isObject(session) && native_emitter.listenerCount(session, data.event)) {
            if (request) {
              var response = function() {
                return reply({ status: 200, response: _.toArray(arguments) });
              };

              if (_.isArray(data.args)) {
                data.args.unshift(data.event);
                data.args.push(response);
                
                session.emit.apply(session, data.args);
              } else {
                session.emit.call(session, data.event, response);
              }
            } else {
              if (_.isArray(data.args)) {
                data.args.unshift(data.event);
                session.emit.apply(session, data.args);
              } else {
                session.emit.call(session, data.event);
              }

              return reply({ status: 200 });
            }
          } else {
            return reply({ status: 404 });
          }
          
          break;
        case 'data':
          if (!_.isNumber(data.id) || !_.isObject(data.args)) {
            return reply({ status: 400 });
          }
          
          var stream = self._queue[data.id];

          if (_.isObject(stream)) {
            if (data.args.type == 'Buffer') {
              var buf = new native_buffer(data.args.data);
                   
              if (stream._encoding == 'buffer') {
                stream.emit('data', buf);
              } else {
                stream.emit('data', buf.toString(stream._encoding));
              }
                
              return reply({ status: 200 });
            }
            
            return reply({ status: 400 });
          }
          
          return reply({ status: 404 });
        case 'end':
          if (!_.isNumber(data.id)) {
            return reply({ status: 400 });
          }
          
          var queue = self._queue[data.id];

          if (_.isObject(queue)) {
            delete self._queue[data.id];
            
            if (_.isFunction(queue.end)) {
              queue.end();
            }
            
            return reply({ status: 200 });
          } else if (data.id === 0) {
            self._isAlive = false;
            self.end();
          } else {
            return reply({ status: 404 });
          }
        default:
          return reply({ status: 400 });
      }
    }
  }
  
  _.extend(requestStream.prototype, native_stream.prototype);

  if (!_.isFunction(requestStream.prototype.off)) {
    requestStream.prototype.off = requestStream.prototype.removeListener;
  }
  
  requestStream.prototype.write = function(packet, encoding, callback) {
    var self = this;
    var data = null;    
    
    if (_.isFunction(encoding)) {
      callback = encoding;
      encoding = 'utf8';
    }
    
    if (!native_buffer.isBuffer(packet)) {
      if (_.isString(packet)) {
        packet = new native_buffer(packet, encoding);
      } else if (_.isObject(packet) && packet.type === 'Buffer' && packet.data) {
        packet = new native_buffer(packet.data);
      } else if (packet instanceof ArrayBuffer) {
        packet = new native_buffer(new Uint8Array(packet));
      } else if (_.isArray(packet)) {
        packet = new native_buffer(packet);
      } else {
        return self.end();
      }
    }
    
    var len = 0;
    var id = 0;
    
    try {
      len = packet.readUInt32LE(0) + 8;
      id = packet.readUInt32LE(4);
    } catch (ignored) {
      return self.end();
    }
    
    if (!len || len > packet.length) {
      return self.end();
    }
    
    var buf = packet.slice(8, len);
    var total = (packet.length - len);

    try {
      data = JSON.parse(buf.toString('utf8')); 
    } catch(ignored) {
      return self.end();
    }
    
    parsePacket(self, data, id, function(reply) {
      if (id) {
        writeToSocket(self, {
          action: 'reply',
          reply: reply,
          id: id
        });
      }
      
      if (_.isFunction(callback)) {
        callback();
      }
    });

    if (total > 0) {
      return self.write(packet.slice(len));
    }
  };

  _.extend(Session.prototype, native_emitter.prototype);

  if (!_.isFunction(Session.prototype.off)) {
    Session.prototype.off = Session.prototype.removeListener;
  }

  Session.prototype.newRequest = function(event) {
    var self = this;
    var socket = self._socket;
    var local = self._local;
    var remote = self._remote;
    
    if (_.isString(event) && socket) {
      return parseCallback(arguments, 1, function(args, callback) {
        var onResponse = null;
        
        if (_.isFunction(callback)) {
          onResponse = function(reply) {
            if (_.isObject(reply) && _.isNumber(reply.status)) {
              if (reply.status === 200) {
                if (_.isArray(reply.response)) {
                  return callback.apply(self, reply.response);
                }
              }
              
              emitError(self, reply.status, 'Session: ' + event);
            }
            
            callback.call(self, null);
          };
        }
        
        writeToSocket(socket, {
          action: 'emit',
          id: remote,
          event: event,
          args: args
        }, onResponse);
      });
    }
  };

  Session.prototype.end = function(callback) {
    var self = this;
    var socket = self._socket;
    var local = self._local;
    var remote = self._remote;

    if (socket && socket._queue[local]) {
      writeToSocket(socket, {
        action: 'end',
        id: remote,
      }, function() {
        self.emit('end');
        self.emit('close');

        if (_.isFunction(callback)) {
          callback();
        }

        self.removeAllListeners();
      });

      delete socket._queue[local];
    } else {
      self.emit('end');
      self.emit('close');

      if (_.isFunction(callback)) {
        callback();
      }

      self.removeAllListeners();
    }
  };
  
  _.extend(Stream.prototype, native_stream.prototype);

  Stream.prototype.setEncoding = function(encoding) {
    if (_.isString(encoding)) {
      this._encoding = encoding;  
    }
  };
  
  Stream.prototype.write = function(msg, encoding, callback) {
    var self = this;
    var data = null;
    var socket = self._socket;
    var remote = self._remote;

    if (socket) {
      if (_.isFunction(encoding)) {
        callback = encoding;
      }

      if (native_buffer.isBuffer(msg)) {
        data = msg;
      } else {
        if (_.isString(msg)) {
          data = new native_buffer(msg);
        } else {
          data = new native_buffer(JSON.stringify(msg));
        }
      }

      writeToSocket(socket, {
        action: 'data',
        id: remote,
        args: data.toJSON()
      }, function(reply) {
        self.emit('drain');
        
        if (_.isFunction(callback)) {
          callback();
        }
        
        if (_.isObject(reply) && _.isNumber(reply.status) && reply.status !== 200) {
          emitError(self, reply.status, 'Stream: write()');
          self.end();
        }
      });
    } else {
      self.emit('error', new Error('Not Connected!'));
    }
  };
  
  Stream.prototype.end = function(msg, encoding, callback) {
    var self = this;
    var socket = self._socket;
    var local = self._local;
    var remote = self._remote;

    if (_.isFunction(encoding)) {
      callback = encoding;
      encoding = 'buffer';
    }  

    if (msg) {
      return self.write(msg, encoding, function() {
        self.end(null, null, callback);
      });
    }

    if (socket && socket._queue[local]) {
      writeToSocket(socket, {
        action: 'end',
        id: remote,
      }, function() {
        self.emit('finish');
        self.emit('end');
        self.emit('close');

        if (_.isFunction(callback)) {
          callback();
        }

        self.removeAllListeners();
      });

      delete socket._queue[local];
    } else {
      self.emit('finish');
      self.emit('end');
      self.emit('close');

      if (_.isFunction(callback)) {
        callback();
      }

      self.removeAllListeners();
    }
  };

  requestStream.prototype.setTimeout = function(wait) {
    if (_.isNumber(wait)) {
      this._waitTime = wait;
    }
  };

  requestStream.prototype.onRequest = function(event, callback) {
    if (_.isString(event) && _.isFunction(callback)) {
      this._onRequest[event] = callback;
    }
  };
  
  requestStream.prototype.offRequest = function(event) {
    if (_.isString(event) && this._onRequest[event]) {
      delete this._onRequest[event];
    }
  };

  requestStream.prototype.onSession = function(event, callback) {
    if (_.isString(event) && _.isFunction(callback)) {
      this._onSession[event] = callback;
    }
  };
  
  requestStream.prototype.offSession = function(event) {
    if (_.isString(event) && this._onSession[event]) {
      delete this._onSession[event];
    }
  };

  requestStream.prototype.onStream = function(event, callback) {
    if (_.isString(event) && _.isFunction(callback)) {
      this._onStream[event] = callback;
    }
  };

  requestStream.prototype.offStream = function(event) {
    if (_.isString(event) && this._onStream[event]) {
      delete this._onStream[event];
    }
  };

  requestStream.prototype.end = function() {
    var self = this;
    
    if (self._isAlive) {
      writeToSocket(self, {
        action: 'end',
        id: 0
      });
      
      self._isAlive = false;      
    }
    
    for (var id in this._queue) {
      var queue = this._queue[id];
      
      if (_.isFunction(queue)) {
        queue.call(self, null);
      } else if (_.isObject(queue)) {
        delete this._queue[id];
        queue.end();
      }
    }
    
    self.emit('finish');
    self.emit('end');
    self.emit('close');
    self.removeAllListeners();
  };

  requestStream.prototype.newRequest = function(event) {
    var self = this;

    if (_.isString(event)) {
      return parseCallback(arguments, 1, function(args, callback) {
        var onResponse = null;
        
        if (_.isFunction(callback)) {
          onResponse = function(reply) {
            if (_.isObject(reply) && _.isNumber(reply.status)) {
              if (reply.status === 200) {
                if (_.isArray(reply.response)) {
                  return callback.apply(self, reply.response);
                }
              }
              
              emitError(self, reply.status, 'Request: ' + event);
            }
            
            callback.call(self, null);
          };
        }
      
        writeToSocket(self, {
          action: 'request',
          name: event,
          args: args
        }, onResponse);
      });
    }
  };

  requestStream.prototype.newSession = function(event, callback) {
    var self = this;

    if (_.isString(event)) {
      return parseCallback(arguments, 1, function(args, callback) {
        if (_.isFunction(callback)) {
          var local = newEvent(self);

          writeToSocket(self, {
            action: 'session',
            name: event,
            remote: local,
            args: args
          }, function(reply) {
            if (!_.isObject(reply) || reply.status !== 200 || !_.isNumber(reply.remote)) {
              if (_.isObject(reply) && _.isNumber(reply.status)) {
                emitError(self, reply.status, 'Session: ' + event);
              }

              return callback.call(self, null);
            }

            self._queue[local] = new Session(self, local, reply.remote);        
            callback.call(self, self._queue[local]);
          });
        }
      });
    }
  };
  
  requestStream.prototype.newStream = function(event, callback) {
    var self = this;
    
    if (_.isString(event)) {
      return parseCallback(arguments, 1, function(args, callback) {
        if (_.isFunction(callback)) {
          var local = newEvent(self);

          writeToSocket(self, {
            action: 'stream',
            name: event,
            remote: local,
            args: args
          }, function(reply) {
            if (!_.isObject(reply) || reply.status !== 200 || !_.isNumber(reply.remote)) {
              if (_.isObject(reply) && _.isNumber(reply.status)) {
                emitError(self, reply.status, 'Stream: ' + event);
              }

              return callback.call(self, null);
            }

            self._queue[local] = new Stream(self, local, reply.remote);        
            callback.call(self, self._queue[local]);
          });
        }
      });
    }
  };
  
  requestStream.prototype.setEncoding = function(encoding) {
    var self = this;
    
    if (_.isString(encoding)) {
      if (native_buffer.isEncoding(encoding) || encoding == 'buffer') {
        self._encoding = encoding;
        
        return encoding;
      }
    }
    
    return false;
  };

  module.exports = requestStream;
})();