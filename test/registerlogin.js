var io = require('socket.io-client');

var TIMEOUT = 30000;
var MINITIMEOUT = 10000;
var USER = "Test";
var PASS = "P@SSW0rD"
var EMAIL = "test@test.test";

var eStatus = 1;

socket = io.connect('http://localhost:3000');

setTimeout(function(){
	socket.disconnect();
	console.log("Reg/Login test: " + eStatus);
	process.exit(eStatus);
}, TIMEOUT);

socket.on('connect', function(){
	console.log("Connection Successful\nSetting up welcome listener");
	socket.on('welcome', function(msg) {
		console.log(msg);
		eStatus = 0;
	});

	console.log("Trying register");
	socket.emit("register", {"user": USER, "pass": PASS, "email":EMAIL});

	setTimeout(function(){
		if(eStatus == 0)
		{
			console.log("Trying login");
			eStatus = 2;
			socket.emit("login", {"user": USER, "pass": PASS, "aes":true});
		}else{
			console.log("Register Failed");
		}
	}, MINITIMEOUT);
});