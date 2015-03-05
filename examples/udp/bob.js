var dgram = require('dgram');
var socket = dgram.createSocket('udp4');
var restStream = require('../../index.js');

var rest = new restStream(socket);

rest.on('data', function(message) {
  socket.send(message, 0, message.length, 1338, 'localhost', function(error) {
    if (error) {
      rest.end();
    }
  });
});

rest.on('end', function() {
  socket.close();
});

socket.on('message', function(message, rinfo) {
  rest.write(message);
});

socket.bind(1337);

rest.newRequest('concat', 'Hello', 'World', 12345, function(reply) {
  console.log(reply);
  
  rest.newRequest('exit', function(message) {
    console.log(message);
    rest.end();
  });  
});