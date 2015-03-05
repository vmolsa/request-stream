REST Stream
===========

Request / Response, Session, Stream events through regular NodeJS stream

# Prototype

``````````
var restStream = require('rest-stream');
var rest = new restStream([stream])
   
rest.write(data, encoding, callback)
rest.end(data, encoding, callback)
rest.setTimeout(timeout)
rest.setEncoding(encoding)

rest.on('event', callback)
rest.off('event', [callback])

rest.onRequest('event', callback([arg1, [arg2, [arg3, [... [callback]]]]]]))
rest.onSession('event', callback(session, [arg1, [arg2, [arg3, [...]]]]]))
rest.onStream('event', callback(stream, [arg1, [arg2, [arg3, [...]]]]]))

rest.newRequest('event', [arg1, [arg2, [arg3, [...]]]]], [callback([reply])])
rest.newSession('event', [arg1, [arg2, [arg3, [...]]]]], callback(session))
rest.newStream('event', [arg1, [arg2, [arg3, [...]]]]], callback(session))

rest.offRequest('event')
rest.offSession('event')
rest.offStream('event')

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

# rest.onRequest || Session.on

response callback is last argument of callback function if client is waiting reply from request.

# License

MIT
