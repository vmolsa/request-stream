var fs = require('fs');
var net = require('net');
var requestStream = require('../../index.js');

var server = net.createServer(function(socket) {
  var req = new requestStream(socket);

  req.on('end', function() {
    console.log('requests ended...');
  });
  
  req.onStream('readPasswd', function(stream) {
    fs.createReadStream('/etc/passwd').pipe(stream);
    
    stream.on('end', function() {
      console.log('/etc/passwd: readed');
    });
     
    stream.on('error', function(error) {
      console.log(error.toString());
    });
  });
  
  req.onRequest('ping', function(payload, callback) {
    console.log(payload);
    
    callback(payload);
  });
  
  req.onSession('db', function(session) {
    session.on('getUsers', function(callback) {
      setTimeout(function() {
        callback([ 'alice', 'bob', 'nobody' ]);
      }, 2000);
    });
    
    session.on('addUser', function(user, callback) {
      console.log('Adding user to db:', user);
      
      setTimeout(function() {
        callback(true);
      }, 1500);
    });
    
    session.on('logOut', function(callback) {
      setTimeout(function() {
        if (callback) {
          callback('Bye');
        }
        
        session.end();
      }, 500);
    });
    
    session.on('error', function(error) {
      console.log(error.toString());
    });
  });
  
  req.on('error', function(error) {
    console.log(error.toString());
  });
});

server.listen({
  host: 'localhost',
  port: 1337,
});
