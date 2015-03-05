var cluster = require('cluster');
var requestStream = require('../../index.js');

if (cluster.isMaster) {
  cluster.fork();
  
  cluster.on('online', function(worker) {
    var req = new requestStream();
    
    req.setEncoding('hex');
    
    req.on('end', function() {
      worker.kill();
    });
    
    req.on('data', function(message) {
      worker.send(message);
    });
    
    worker.on('message', function(message) {
      req.write(message, 'hex');
    });
    
    req.on('error', function(error) {
      console.log(error);
    });
    
    req.newRequest('runScript', './runSuccess.js', function(error) {
      if (error) {
        console.log('runScript Error:', error);
      }
    });
    
    req.newRequest('runScript', './runFailure.js', function(error) {
      if (error) {
        console.log('runScript Error:', error);
      }
    });
    
    req.newSession('convertImage', function(session) {
      if (!session) {
        return false;
      }
      
      console.log('Transforming Image');
      
      session.on('end', function() {
        req.end();
      });
      
      session.newRequest('newTask', function(id) {
        if (!id) {
          return session.end();
        }
        
        req.newStream('imageUpload', id, function(stream) {
          console.log('Uploading image');
          
          stream.end('... image data ....');
        });
        
        session.on('uploadDone', function() {
          console.log('Converting...');
          
          session.newRequest('convert');
        });
      });
      
      session.on('progress', function(status) {
        console.log(status);
      });
      
      session.on('done', function() {
        console.log('Image is now ready');
        session.end();
      });
    });
  });
} else {
  var req = new requestStream();
  
  req.setEncoding('hex');
  
  process.on('message', function(message) {
    req.write(message, 'hex');
  });

  req.on('data', function(message) {
    process.send(message);
  });
  
  req.on('error', function(error) {
    console.log(error);
  });
  
  req.onRequest('runScript', function(filename, callback) {
    var script = null;
    
    try {
      script = require(filename);  
    } catch (error) {
      return callback(error.toString());
    }
    
    callback();
  });
  
  var tasks = {};
  
  function newTask() {
    var id = Math.floor((Math.random() * 1000));
    
    if (tasks[id]) {
      return newTask();
    }
    
    tasks[id] = {
      imageData: '',
      notify: null
    };
    
    return id;
  }  
  
  function getTask(id) {
    return tasks[id];
  }
  
  function removeTask(id) {
    if (tasks[id]) {
      delete tasks[id];
    }
  }
  
  function setTaskNotify(id, callback) {
    if (id && tasks[id]) {
      tasks[id].notify = callback;
    }
  }
  
  req.onStream('imageUpload', function(stream, id) {
    var task = getTask(id);
    
    if (!task) {
      return stream.end();
    }
    
    stream.setEncoding('hex');
    
    stream.on('data', function(data) {
      task.imageData += data;
    });
    
    stream.on('error', function(error) {
      task.error = error;
    });
    
    stream.on('end', function() {
      if (task.notify) {
        task.notify();
      }
    });
  });

  req.onSession('convertImage', function(session) {
    var id = newTask();
    
    setTaskNotify(id, function() {
      session.newRequest('uploadDone');
    });
    
    session.on('newTask', function(callback) {
      callback(id);
    });
    
    session.on('end', function() {
      removeTask(id);
    });
    
    session.on('convert', function() {
      setTimeout(function() {
        session.newRequest('progress', 'grayscale');
      }, 1000);
      
      setTimeout(function() {
        session.newRequest('progress', 'Gaussian');
      }, 4000);
      
      setTimeout(function() {
        session.newRequest('progress', 'sharping');        
      }, 8000);
      
      setTimeout(function() {
        session.newRequest('done');        
      }, 10000);
    });
  });
}