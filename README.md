requestStream
=============

Request / Response, Session, Stream events through regular NodeJS stream

# Prototype

``````````
var requestStream = require('request-stream');
var req = new requestStream([stream])
   
req.write(data, encoding, callback)
req.end(data, encoding, callback)
req.setTimeout(timeout)
req.setEncoding(encoding)

req.on('event', callback)
req.off('event', [callback])

req.onRequest('event', callback([arg1, [arg2, [arg3, [... [callback]]]]]]))
req.onSession('event', callback(session, [arg1, [arg2, [arg3, [...]]]]]))
req.onStream('event', callback(stream, [arg1, [arg2, [arg3, [...]]]]]))

req.newRequest('event', [arg1, [arg2, [arg3, [...]]]]], [callback([reply])])
req.newSession('event', [arg1, [arg2, [arg3, [...]]]]], callback(session))
req.newStream('event', [arg1, [arg2, [arg3, [...]]]]], callback(session))

req.offRequest('event')
req.offSession('event')
req.offStream('event')

``````````

# Events

``````````

'error', callback(error)
'close', callback()
'end',   callback()

``````````

# Session Prototype

``````````

session.on('event', callback([arg1, [arg2, [arg3, [... [callback]]]]]]))
session.off('event', [callback])

session.end()

session.newRequest('event', [arg1, [arg2, [arg3, [...]]]]], [callback([reply])])

``````````

# Stream Prototype

http://nodejs.org/api/stream.html

# Session.on || req.onRequest

response callback is last argument of callback function if client is waiting reply from request.

# License

MIT
