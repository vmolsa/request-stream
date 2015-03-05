var dgram = require('dgram');
var socket = dgram.createSocket('udp4');
var requestStream = require('../../index.js');

var req = new requestStream(socket);

req.on('data', function(message) {
  socket.send(message, 0, message.length, 1338, 'localhost', function(error) {
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

socket.bind(1337);

req.newRequest('concat', 'Hello', 'World', 12345, function(reply) {
  console.log(reply);
  
  req.newRequest('exit', function(message) {
    console.log(message);
    req.end();
  });  
});