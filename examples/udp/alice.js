var dgram = require('dgram');
var socket = dgram.createSocket('udp4');
var requestStream = require('../../index.js');

var req = new requestStream(socket);

req.on('data', function(message) {
  socket.send(message, 0, message.length, 1337, 'localhost', function(error) {
    if (error) {
      req.end();
    }
  });
});

req.on('end', function() {
  socket.close();
});

socket.on('message', function(message, rinfo) {
  req.write(message);
});

socket.bind(1338);

req.onRequest('exit', function(callback) {
  callback('Bye');
  
  setTimeout(function() {
    console.log('Closing...');
    req.end();
  }, 100);
});

req.onRequest('concat', function(arg1, arg2, arg3, callback) {
  var res = arg1 + arg2 + arg3;
  
  console.log('Concat:', res);
  callback(res);
});