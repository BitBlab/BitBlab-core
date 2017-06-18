var io = require('socket.io-client');

var eStatus = 1;

socket = io.connect('http://localhost:3000');

setTimeout(function(){
	socket.disconnect();
	console.log("Connection test: " + eStatus);
	process.exit(eStatus);
}, 10000);

socket.on('connect', function(){
	console.log("Connection Successful");
	eStatus = 0;
});