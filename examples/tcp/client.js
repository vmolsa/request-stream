var net = require('net');
var restStream = require('../../index.js');

var socket = net.connect({ host: 'localhost', port: 1337 }, function() {
  var rest = new restStream(socket);
  
  rest.newStream('readPasswd', function(stream) {
    if (stream) {
      stream.pipe(process.stdout);
      
      stream.on('end', function() {
        console.log('/etc/passwd: readed');
      });
      
      stream.on('error', function(error) {
        console.log(error.toString());
      });
    }
  });
  
  rest.newRequest('ping', '!!!THIS IS PAYLOAD!!!', function(reply) {
    console.log(reply);
  });
  
  rest.newSession('db', function(session) {
    if (!session) {
      return;
    }
    
    session.on('end', function() {
      console.log('Session ended...');
      rest.end();
    });
    
    session.newRequest('getUsers', function(users) {
      if (users) {
        console.log('Db users:', users);
      } else {
        console.log('Timeout');
      }
    });
    
    session.newRequest('addUser', 'michael', function(saved) {
      if (saved) {
        console.log('Db: saved');
      } else {
        console.log('Timeout');
      }
      
      session.newRequest('logOut');
    });
    
    session.on('error', function(error) {
      console.log(error.toString());
    });
  });
  
  rest.on('error', function(error) {
    console.log(error.toString());
  });
});

socket.on('close', function() {
  console.log('Disconnected...');
});
