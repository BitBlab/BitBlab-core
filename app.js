/*

	Copyright 2014 BitBlab

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
   
*/


/**
 * Module dependencies.
 */

var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var serveStatic = require('serve-static');
var errorHandler = require('errorhandler');

//var routes = require('./routes');
//var user = require('./routes/user');
//var chat = require('./routes/chat');
var socketio = require('socket.io');
var http = require('http');
var path = require('path');

var njscrypto = require('node-cryptojs-aes');
var CryptoJS = njscrypto.CryptoJS;

var bcrypt = require('bcrypt');

var app = express();

//database stuff
var fs = require('fs');
var file = 'db.sqlite';
var dbexists = fs.existsSync(file);
var sqlite = require('sqlite3').verbose();
var db = new sqlite.Database(file);

db.serialize(function(){
	if(!dbexists){
		db.run("CREATE TABLE users (name TEXT, pass TEXT, type INTGER, status INTEGER, balance REAL)");
		db.run("CREATE TABLE rooms (name TEXT, owner TEXT, mods TEXT, private BOOL, messages TEXT, topic TEXT)");
		db.run("CREATE TABLE colors (name TEXT, colors TEXT, nameColors TEXT)");
		db.run("CREATE TABLE transactions (hash TEXT, value INTEGER, input_address TEXT)");
	}
});

var rooms = [];

db.serialize(function(){
	db.each("SELECT name FROM rooms", function(err, row){
		if(row != undefined){
			rooms.push(row.name);
		}
	});

});

var uRooms = {};
var userType = {};
var userColors = {};
var userMsgTime = {};

var adNum = 0;
var advertisements = ["Your ad here! Email admin[at]bitblab.net"];

var emoteCodes = [":happy:", ":sad:", ":mad:", ":cool:", ":XD:", ":gasp:", ":speechless:", ":tongue:", ":up:", ":down:", ":cthulhu:", ":devil:", ":grin:", ":btc:"];
var emoteFiles = ["smiling.png", "frowning.png", "angry.png", "cool.png", "tongue_out_laughing.png", "gasping.png", "speechless.png", "tongue_out.png", "thumbs_up.png", "thumbs_down.png", "cthulhu.png", "devil.png", "grinning.png", "btc.png"];

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(methodOverride());

app.use(serveStatic(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(errorHandler());
}

//app.get('/', chat.main);
//app.get('/', routes.index);
//app.get('/chat', chat.main);

var server = app.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});


var io = socketio.listen(server);
var clients = {};
var socketsOfClients = {};
var onlineUsers = [];

setInterval(function(){
	io.sockets.emit('advert', advertisements[adNum]);
	adNum++;
	if(adNum > advertisements.length){
		adNum = 0;
	}
	
	fixOnlineList();
	
}, 600000);

io.sockets.on('connection', function(socket) {
  console.log("CONNECTION");
  
  io.sockets.sockets[socket.id].emit('id', socket.id);
  
  socket.on('register', function(data) {
	
	var userName = data.user;
	var pass = data.pass;
	var key = data.key;
	
	if(userName.length > 15){
		userNameTooLong(socket.id);
		return;
	}
	
	var unameExists = true;
	
	db.serialize(function(){
		db.get("SELECT rowid AS id FROM users WHERE name = ? COLLATE NOCASE", userName, function(err, row){
			console.log(row);
			if(row != undefined){
				unameExists = true;
			}else{
				unameExists = false;
			}
			
			if (!unameExists) {
				
				userColors[userName] = "black";
				
				bcrypt.genSalt(10, function(err, salt) {
					bcrypt.hash(pass, salt, function(err, hash) {
						console.log(hash);
						db.run("INSERT INTO users VALUES (?, ?, ?, ?, ?)", [userName, hash, 1, 0, 0]);
						
						clients[userName] = socket.id;
						socketsOfClients[socket.id] = userName;
						userNameAvailable(socket.id, userName);
						
						uRooms[userName] == ["Main"];
						userType = 0;
					});
				});
			} else if (clients[userName] === socket.id) {
				// Its a bot! maybe
			} else {
				userNameAlreadyInUse(socket.id, userName);
			}
			
		});
	});
  });
  
  socket.on('login', function(data){
	var user = data.user;
	var pass = data.pass;
		
	db.serialize(function() {
		db.get("SELECT * FROM users WHERE name = ? COLLATE NOCASE", user, function(err, row) {
			if(row === undefined) {
				console.log("User not found in db");
				invalidLogin(socket.id);
				return;
			}
			
			console.log("Inside db get");
			
			user = row.name;
			bcrypt.compare(pass, row.pass, function(err, res) {
				console.log(row.pass)
				console.log("Inside bcrypt compare");
				console.log(res);
				if(res) {
					console.log("Authenticated " + row.name);
					clients[user] == socket.id;
					socketsOfClients[socket.id] = user;
					uRooms[user] = ["Main"];
					userType[user] = row.type;
					loginComplete(socket.id, user, row.balance);
					
					console.log("Right before db get 2");
					
					db.get("SELECT colors FROM colors WHERE name = ?", user, function(err, row) {
						console.log("Inside second db get");
						if(row != undefined) {
							userColors[user] = row.colors;
						} else {
							userColors[user] = "black";
						}
					});
				} else {
					invalidLogin(socket.id);
				}
			});
		});
	});
  });
  
  socket.on('message', function(msg) {
	if(msg.message === undefined){
		return;
	}
    var srcUser = socketsOfClients[socket.id];
	
	var curTime = new Date().getTime();
	
	if(curTime - userMsgTime[srcUser] < 500){ //check if the user is sending too many messages
		io.sockets.sockets[socket.id].emit('message',
				{"source": "[System]",
				"message": "<span class='label label-danger'>You are sending too many messages too fast! Please no more than 2 per second!</span>",
				"target": msg.target,
				"type": msg.type,
				"tip": 0
				});
		userMsgTime[srcUser] = curTime;
		return;
	} else{
		userMsgTime[srcUser] = curTime;
	}
	
	var words = msg.message.split(" ");

	if(msg.message.startsWith("/"))
	{
		runCommand(socket, msg, words, srcUser);
		return;
	}

	/*var keepHtml = false;
	
	if(!keepHtml){
		msg.message = stripHTML(msg.message);
	}*/

	var winnings = checkReward(msg.message, userType[srcUser]);
	if(winnings > 0){
		db.serialize(function(){
			db.get("SELECT balance FROM users WHERE name = ?", srcUser, function(err, row){
				var bal = row.balance;
				bal = bal + winnings;
				db.run("UPDATE users SET balance = ? WHERE name = ?", [bal, srcUser]);
				io.sockets.sockets[socket.id].emit('tip', {"amount": winnings, "type": "auto"});
			});
		});
		//msg.message = msg.message + "<span class = 'label label-primary' style='float:right'>+" + winnings + "</span>";
	}

	/*var iof = msg.message.indexOf("#");
	if(iof != -1){
		var left = msg.message.substring(0, iof);
		var right = msg.message.substring(iof);
		var rightwords = right.split(" ");
		var quote = '"';
		left = left + "<a href='javascript:void(0)' onclick='addRoom(" + quote + rightwords[0].substring(1) + quote + ");'>";
		right = right.slice(0, rightwords[0].length) + "</a>" + right.slice(rightwords[0].length);
		msg.message = left + right;
	}*/
	
	msg.message = addEmotes(msg.message);
	
	for(var i = 0; i < words.length; i++) {
        if(words[i].indexOf("http://", 0) == 0 || words[i].indexOf("https://", 0) == 0){
		    if(userType[srcUser] >= 1){
		        console.log("Link detected");
                var url = words[i];
                words[i] = "<a href=\"" + url + "\" target = _blank>" + url + "</a>";
			}else{
			    words[i] = "[Warning: links may contain malware]" + words[i];
			}
        }else if(words[i].indexOf("#", 0) == 0){
			words[i] = "<a href='javascript:void(0)' onclick='addRoom(\"" + words[i].substring(1) + "\");'>" + words[i] + "</a>";
		}
    }
	
	msg.message = words.join(" ");
	
	if(typeof msg.color != "undefined"){
		var owned = userColors[srcUser].split(",");
		var authed = false;
		
		for(var i=0; i < owned.length; i++){
			if(owned[i] == msg.color){
				authed = true;
				break;
			}
		}
		if(authed){
			if(msg.color == "rainbow"){
				msg.message = rainbow(msg.message);
			}else{
				msg.message = "<span style='color:" + msg.color + "'>" + msg.message + "</span>";
			}
		}
	}
	
    if (msg.type == "room") {
      // broadcast
	io.sockets.emit('message',
	  {"source": srcUser,
	   "message": msg.message,
	   "target": msg.target,
	   "type": msg.type,
	   "tip": winnings
	   });
    } else if(msg.type == "priv"){
	if(msg.target.indexOf("PM:") == -1){
		msg.target = "PM:" + msg.target;
	}
	io.sockets.sockets[socket.id].emit('joinroom', {"room": msg.target, "topic":"Private Message"});
	io.sockets.sockets[clients[msg.target.substring(3)]].emit('joinroom', {"room": msg.target, "topic":"Private Message"});
      // Look up the socket id
	io.sockets.sockets[clients[msg.target.substring(3)]].emit('message',
	  {"source": srcUser,
	   "message": msg.message,
	   "target": msg.target,
	   "type": msg.type,
	   "tip": winnings
	   });
    }
  })
  
  socket.on('command', function(data){

  	socket.emit('cli-error', "This method has been removed. Please send messages that begin with '/' instead. ")
	
  });
  
  socket.on('addroom', function(data){
	if(data.indexOf(" ") != -1){
		io.sockets.sockets[socket.id].emit('cli-error', "Rooms cannot contain spaces!");
		return;
	}
	db.serialize(function(){
		db.get("SELECT * FROM rooms WHERE name = ? COLLATE NOCASE", data, function(err, row){
			if(row === undefined){
				db.run("INSERT INTO rooms VALUES (?, ?, ?, ?, ?, ?)", [data, socketsOfClients[socket.id], "", false, "", ""]);
				rooms.push(data);
				io.sockets.emit('newroom', data);
				io.sockets.sockets[socket.id].emit('joinroom', {"room":data, "topic": ""});
				userJoined(socketsOfClients[socket.id], data);
			}else{
				io.sockets.sockets[socket.id].emit('joinroom', {"room": row.name, "topic": row.topic});
				userJoined(socketsOfClients[socket.id], row.name);
			}
		});
	});
  });
  
  socket.on('buycolor', function(color){
	var user = socketsOfClients[socket.id];
	console.log(user + " trying to buy color " + color);
	db.serialize(function(){
		db.get("SELECT balance FROM users WHERE name = ?", user, function(err, row){
			if(row != undefined){
				var userBal = row.balance;
				console.log("user bal: " + row.balance);
				if(color == "rainbow"){
					if(row.balance >= 10){
						db.get("SELECT colors FROM colors WHERE name = ?", user, function(err, row){
							if(row != undefined){
								var colors = row.colors;
								console.log(colors);
								if(colors === undefined || colors === null){
									colors = ["black"];
								}else{
									colors = colors.split(",");
								}
								var inArr = false;
								for (var i=0; i < colors.length;i++){
									console.log(i + "/" + colors.length);
									if(color === colors[i]){
										io.sockets.sockets[socket.id].emit('cli-error', 'colErr');
										inArr = true;
										break;
									}
									else{
										continue;
									}
								}
								if(!inArr){
									db.run("UPDATE users SET balance = ? WHERE name = ?", [userBal-10, user]);
									colors.push(color);
									console.log(colors);
									db.run("UPDATE colors SET colors = ? WHERE name = ?", [colors.toString(), user]);
									io.sockets.sockets[socket.id].emit('addcolor', color);
									io.sockets.sockets[socket.id].emit('balance', userBal-1);
									userColors[user] = userColors[user] + "," + color;
								}
							}else{
								db.run("UPDATE users SET balance = ? WHERE name = ?", [userBal-1, user]);
								db.run("INSERT INTO colors VALUES (?, ?, ?)", [user, ["black", color,].toString(), ["black"].toString()]);
								io.sockets.sockets[socket.id].emit('addcolor', color);
								io.sockets.sockets[socket.id].emit('balance', userBal-1);
								userColors[user] = userColors[user] + "," + color;
							}
						});
					}
				}else{
					if(row.balance >= 1){
						db.get("SELECT colors FROM colors WHERE name = ?", user, function(err, row){
							if(row != undefined){
								var colors = row.colors;
								console.log(colors);
								if(colors === undefined || colors === null){
									colors = ["black"];
								}else{
									colors = colors.split(",");
								}
								var inArr = false;
								for (var i=0; i < colors.length;i++){
									console.log(i + "/" + colors.length);
									if(color === colors[i]){
										io.sockets.sockets[socket.id].emit('cli-error', 'colErr');
										inArr = true;
										break;
									}
									else{
										continue;
									}
								}
								if(!inArr){
									db.run("UPDATE users SET balance = ? WHERE name = ?", [userBal-1, user]);
									colors.push(color);
									console.log(colors);
									db.run("UPDATE colors SET colors = ? WHERE name = ?", [colors.toString(), user]);
									io.sockets.sockets[socket.id].emit('addcolor', color);
									io.sockets.sockets[socket.id].emit('balance', userBal-1);
									userColors[user] = userColors[user] + "," + color;
								}
							}else{
								db.run("UPDATE users SET balance = ? WHERE name = ?", [userBal-1, user]);
								db.run("INSERT INTO colors VALUES (?, ?, ?)", [user, ["black", color,].toString(), ["black"].toString()]);
								io.sockets.sockets[socket.id].emit('addcolor', color);
								io.sockets.sockets[socket.id].emit('balance', userBal-1);
								userColors[user] = userColors[user] + "," + color;
							}
						});
					}
				}
				
			}else{
				console.log("user not found");
			}
		});
	});
  });
  
  socket.on('tip', function(data){
	tipUser(socketsOfClients[socket.id], data.user, data.amount, socket, data.room, data.message);
  });
  
  socket.on('list', function(data){
	io.sockets.sockets[socket.id].emit('list', JSON.stringify(onlineUsers));
  });
  
  socket.on('disconnect', function() {
    var uName = socketsOfClients[socket.id];
    delete socketsOfClients[socket.id];
    delete clients[uName];
	onlineUsers.splice(onlineUsers.indexOf(uName), 1);
	
	io.sockets.emit('userLeft', uName);
	
    // relay this message to all the clients
 
    userLeft(uName);
  })
})
 
function tipUser(user, target, amount, socket, room, message){

	if(user.toLowerCase() == target.toLowerCase())
	{
		sendInlineError(socket, "You cannot tip yourself!", room, "room");
		return;
	}

	if(amount <= 0 && userType[user] < 3){
		socket.emit('notice', "Invalid tip amount!");
		return;
	}
	db.serialize(function(){
		db.get("SELECT balance FROM users WHERE name = ? COLLATE NOCASE", user, function(err, row){
			if(row != undefined){
				if(row.balance >= amount){
					db.get("SELECT balance FROM users WHERE name = ? COLLATE NOCASE", target, function(err2, row2){
						if(row2 === undefined){
							socket.emit('notice', "User does not exist! Check your spelling.");
							return;
						}
						db.run("UPDATE users SET balance = ? WHERE name = ? COLLATE NOCASE", [row.balance - amount, user]);
						db.run("UPDATE users SET balance = ? WHERE name = ? COLLATE NOCASE", [row2.balance + amount, target]);
						if(io.sockets.sockets[clients[target]] != undefined){
							if(message != undefined && message != ""){
								io.sockets.sockets[clients[target]].emit('tip', {"amount": amount, "type": "user", "source": user, "message": message});
							}else{
								io.sockets.sockets[clients[target]].emit('tip', {"amount": amount, "type": "user", "source": user});
							}
							
						}
						socket.emit('balance', row.balance - amount);
						if(message != undefined && message != ""){
							io.sockets.emit('message',
								{"source": "[System]",
								"message": '<span class="label label-success">' + user + ' tipped ' + target + ' ' + amount + ' mBTC! (' + message +')</span>',
								"target": room,
								"type": "room",
								});
						}else{
							io.sockets.emit('message',
								{"source": "[System]",
								"message": '<span class="label label-success">' + user + ' tipped ' + target + ' ' + amount + ' mBTC!</span>',
								"target": room,
								"type": "room",
								});
						}
					});
				}
			}
		});
	});
} 

function userJoined(uName, room) {
    Object.keys(socketsOfClients).forEach(function(sId) {
      io.sockets.sockets[sId].emit('userJoined', { "userName": uName, "room": room });
    })
}
 
function userLeft(uName) {
    io.sockets.emit('userLeft', { "userName": uName });
}
 
function userNameAvailable(sId, uName) {
	var colors;
	db.serialize(function(){
		db.get("SELECT colors FROM colors WHERE name = ?", uName, function(err, row){
			if(row != undefined){
				colors = row.colors.split(",");
			}else{
				colors = ["black"];
			}
			
			console.log('Sending welcome msg to ' + uName + ' at ' + sId);
			//io.sockets.sockets[sId].emit('welcome', { "userName" : uName, "currentUsers": JSON.stringify(Object.keys(clients)), message: "Username available! Registration complete.", "rooms": rooms, "colors": colors, "balance": 0 });
			io.sockets.sockets[sId].emit('welcome', { "userName" : uName, "currentUsers": JSON.stringify(onlineUsers), message: "Username available! Registration complete.", "rooms": rooms, "colors": colors, "balance": 0 });
		});
	});
}

function loginComplete(sId, uName, bal){
	var colors;
	db.serialize(function(){
		db.get("SELECT colors FROM colors WHERE name = ?", uName, function(err, row){
			if(row != undefined){
				colors = row.colors.split(",");
			}else{
				colors = ["black"];
			}
			
			console.log('Sending welcome msg to ' + uName + ' at ' + sId);
			//io.sockets.sockets[sId].emit('welcome', { "userName" : uName, "currentUsers": JSON.stringify(Object.keys(clients)), message: "Login successful!", "rooms": rooms, "colors": colors, "balance": bal });
			io.sockets.sockets[sId].emit('welcome', { "userName" : uName, "currentUsers": JSON.stringify(onlineUsers), message: "Login successful!", "rooms": rooms, "colors": colors, "balance": bal });
		});
	});
}
 
function userNameAlreadyInUse(sId, uName) {
  setTimeout(function() {
	console.log("Username already in use");
    io.sockets.sockets[sId].emit('cli-error', { "userNameInUse" : true });
  }, 500);
}

function userNameTooLong(sId){
	setTimeout(function() {
    io.sockets.sockets[sId].emit('cli-error', { "userNameTooLong" : true});
  }, 500);
}

function invalidLogin(sId){
	console.log("Invalid login");
	setTimeout(function() {
    io.sockets.sockets[sId].emit('cli-error', { "invalidLogin" : true});
  }, 500);
}

function addEmotes(msg){
	
	for(var i=0; i<emoteCodes.length; i++){
		var iof = msg.indexOf(emoteCodes[i]);
		if(iof != -1){
			var left = msg.substring(0, iof);
			var right = msg.substring(iof);
			msg = left + '<img src="/images/emote/' + emoteFiles[i] + '" />' + right.substring(emoteCodes[i].length);
		}
	}
	
	return msg;
}

function checkReward(msg, level){//determines whether the message wins mBTC or not
	console.log(level);
	var multiplier;
	if(msg.length <= 10){
		return 0;//message too short to be rewarded
	}else if(msg.length > 10 && msg.length <= 35){
		multiplier = 1;
	}else if(msg.length > 35 && msg.length <= 60){
		multiplier = 1.25;
	}else if(msg.length >60 && msg.length <= 125){
		multiplier = 1.50;
	}else if(msg.length > 125){
		multiplier = 2;
	}
	
	console.log(multiplier);
	
	switch(level){
		case 0:
				var result = Math.floor((Math.random()*1500)+1);
				console.log(result);
				if(result < 25*multiplier){
					var winnings = Math.round(Math.random()*0.2*100)/100;
					return winnings;
				}else{
					return 0;
				}
				break;
		case 1:
				var result = Math.floor((Math.random()*1000)+1); 
				console.log(result);
				if(result < 25*multiplier){
					var winnings = Math.round(Math.random()*0.5*100)/100;
					return winnings;
				}else{
					return 0;
				}
				break;
		case 2:
				var result = Math.floor((Math.random()*500)+1); 
				console.log(result);
				if(result < 25*multiplier){
					var winnings = Math.round(Math.random()*100)/100;
					return winnings;
				}else{
					return 0;
				}
				break;
		case 3:
				var result = Math.floor((Math.random()*400)+1); 
				console.log(result);
				if(result < 25*multiplier){
					var winnings = Math.round(Math.random()*100)/100;
					return winnings;
				}else{
					return 0;
				}
				break;
		case 4:
				var result = Math.floor((Math.random()*400)+1); 
				console.log(result);
				if(result < 25*multiplier){
					var winnings = Math.round(Math.random()*100)/100;
					return winnings;
				}else{
					return 0;
				}
				break;
		//note that bots cannot win message tips
	}
	return 0;
}

function color_from_hue(hue)
{
  var h = hue/60;
  var c = 255;
  var x = (1 - Math.abs(h%2 - 1))*255;
  var color;
 
  var i = Math.floor(h);
  if (i == 0) color = rgb_to_hex(c, x, 0);
  else if (i == 1) color = rgb_to_hex(x, c, 0);
  else if (i == 2) color = rgb_to_hex(0, c, x);
  else if (i == 3) color = rgb_to_hex(0, x, c);
  else if (i == 4) color = rgb_to_hex(x, 0, c);
  else color = rgb_to_hex(c, 0, x);
 
  return color;
}
 
function rgb_to_hex(red, green, blue)
{
  var h = ((red << 16) | (green << 8) | (blue)).toString(16);
  // add the beginning zeros
  while (h.length < 6) h = '0' + h;
  return '#' + h;
}

function rainbow(text){
	var rainbowtext = '';
	var hue=0;
	var step=0;

	// hue is 360 degrees
	if (text.length > 0)
		step = 360 / (text.length);

	// iterate the whole 360 degrees
	for (var i = 0; i < text.length; i++)
	{
		rainbowtext = rainbowtext + '<span style="color:' + color_from_hue(hue) + '">' + text.charAt(i) + '</span>';
		hue += step;
	}

	return rainbowtext;
}

function stripHTML(str){
	str=str.replace(/<br>/gi, "\n");
	str=str.replace(/<p.*>/gi, "\n");
	str=str.replace(/<a.*href="(.*?)".*>(.*?)<\/a>/gi, "");
	str=str.replace(/<(?:.|\s)*?>/g, "");
	return str;
}

function fixOnlineList(){
	for(var i=0; i < onlineUsers.length; i++){
		if(typeof onlineUsers[i] != 'undefined'){
			continue;
		}else{
			onlineUsers.splice(i, 1);
		}
	}
}

function runCommand(socket, msg, words, srcUser)
{
	words[0] = words[0].substr(1);

	switch(words[0])
	{
		case 'tip':

			if(words.length < 3)
			{
				sendInlineError(socket, "Missing parameters! Usage: /tip [user] [mBtc] (message)", msg.target, msg.type);
				return;
			}

			tipUser(srcUser, words[1], parseFloat(words[2]), socket, msg.target, msg.message.substring(words[0].length + words[1].length + words[2].length + 3));
			break;

		case 'urgent':
			if(userType[srcUser])
			{
				io.sockets.emit('message',
								{"source": srcUser,
									"message": "<span class='label label-danger'>" + msg.message.substring(words[0].length+2) + "</span>",
									"target": msg.target,
									"type": msg.type,
									"tip": 0
								});
			}
			break;

		case 'balance':
			if(userType[srcUser] < 3)
				break;

			var targetUser = words[1];
			var action = words[2];
			var amount = words[3];
			
			if(action == "add"){
				db.serialize(function(){
					db.get("SELECT balance FROM users WHERE name = ?", targetUser, function(err, row){
						if(row != undefined){
							var newbal = row.balance + amount;
							db.run("UPDATE users SET balance = ? WHERE name = ?", [newbal, targetUser]);
							io.sockets.sockets[socket.id].emit('balance', newbal);
						}
					});
				});
			}
			
			else if(action == "remove"){
				db.serialize(function(){
					db.get("SELECT balance FROM users WHERE name = ?", targetUser, function(err, row){
						if(row != undefined){
							var newbal = row.balance - amount;
							db.run("UPDATE users SET balance = ? WHERE name = ?", [newbal, targetUser]);
							io.sockets.sockets[socket.id].emit('balance', newbal);
						}
					});
				});
			}
			
			else if(action == "set"){
				db.serialize(function(){
					db.run("UPDATE users SET balance = ? WHERE name = ?", [amount, targetUser]);
					io.sockets.sockets[socket.id].emit('balance', amount);
				});
			}

			break;
		
		case 'ban':
			if(userType[srcUser] < 3)
				break;

			if(words.length < 2)
			{
				sendInlineError(socket, "Missing parameters! Usage: /ban [user]", msg.target, msg.type);
				return;
			}

			var targetSocket = socketsOfClients[words[1]];
			db.serialize(function(){
				db.run("UPDATE users SET status = ? WHERE name = ?", [2, words[1]]);
			});

			if(targetSocket != undefined)
			{
				targetSocket.emit('notice', "You have been banned!");
				setTimeout(function(){
					io.sockets.sockets[targetSocket].disconnect();
				}, 2000);
			}
			
			break;
		case 'userlevel':
			if(userType[srcUser] < 3)
				break;

			if(words.length < 3)
			{
				sendInlineError(socket, "Missing parameters! Usage: /userlevel [user] [level]");
				return;
			}

			var trgt = words[1];
			var level = parseInt(words[2]);
			userLevel[trgt] = level;
			db.serialize(function(){
			    console.log("User " + trgt + " level set to " + level);
				db.run("UPDATE users SET type = ? WHERE name = ?", [level, trgt]);
			});
				
			break;
		case 'pm':
			msg.type = "priv";
			msg.target = words[1];
			msg.message.substring(4 + words[1].length);
			break;
		
		case 'topic':
			var targetRoom = msg.target;
			var uLvl = userType[srcUser];
			var topic = msg.message.substring(7);
			
			db.serialize(function(){
				db.get("SELECT owner FROM rooms WHERE name = ?", targetRoom, function(err, row){
					if(row != undefined){
						if(row.owner == srcUser || uLvl >= 3){
							db.run("UPDATE rooms SET topic = ? WHERE name = ?", [topic, targetRoom]);
							io.sockets.sockets[socket.id].emit('message',
															{"source": "[System]",
															"message": "<span class='label label-success'>Topic set!</span>",
															"target": msg.target,
															"type": msg.type,
															"tip": 0
															});
						}else{
							io.sockets.sockets[socket.id].emit('message',
															{"source": "[System]",
															"message": "<span class='label label-danger'>You don't have permission to do that!</span>",
															"target": msg.target,
															"type": msg.type,
															"tip": 0
															});
						}
					}
				});
			
			});
			break;
		
		case 'html':
			sendInlineError(socket, "This command has been removed!", msg.target, msg.type);
			break;
		
		case 'callmod':
			if(clients["AHuman"] != undefined){
				io.sockets.sockets[clients["AHuman"]].emit('modalert', msg.target);
			}
			
			if(clients["Ronoman"] != undefined){
				io.sockets.sockets[clients["Ronoman"]].emit('modalert', msg.target);
			}
			
			io.sockets.emit('message',
			{"source": "[System]",
			"message": "<span class='label label-warning'>A moderator has been requested by " + srcUser + "</span>",
			"target": msg.target,
			"type": msg.type,
			"tip": 0
			});
			break;
		
		case 'say':
			sendInlineError(socket, "This command is currently unavailable!", msg.target, msg.type);
			//TODO
			break;
		
		default:
			sendInlineError(socket, "Invalid command: " + words[0], msg.target, msg.type);
			break;
	}

}

function sendInlineError(socket, message, target, type)
{
	socket.emit('message',
				{"source": "[System]",
				"message": "<span class='label label-danger'>" + message + "</span>",
				"target": target,
				"type": type,
				"tip": 0
				});
}