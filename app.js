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
		db.run("CREATE TABLE messages (name TEXT, room TEXT, message TEXT, timestamp TEXT)");
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

//var uRooms = {};
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
//var onlineUsers = [];

// define socket.io namespaces for different room types
var nsCommand = io.of('/'); //used for some functions, probably
var nsPublic = io.of('/public');
var nsPrivate = io.of('/private');

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
  
  socket.emit('id', socket.id);
  
  socket.on('register', function(data) {
	
	var userName = data.user;
	var pass = data.pass;
	
	if(!checkUserName(socket.id, userName)) return;
	
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
						userNameAvailable(socket.id, userName);
						//onlineUsers.push(userName);
						
						//uRooms[userName] = ["Main"];
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
			}else if(row.status == 2)
			{
				socket.emit('cli-error', "You have been banned and thus cannot log in!");
				return;
			}
			
			console.log("Inside db get");
			
			user = row.name;
			bcrypt.compare(pass, row.pass, function(err, res) {
				if(res) {
					console.log("Authenticated " + row.name);
					clients[user] = socket.id;
					//uRooms[user] = ["Main"];
					userType[user] = row.type;
					console.log(row.balance);
					loginComplete(socket.id, user, row.balance);
					//onlineUsers.push(user);
					
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
  
  socket.on('command', function(data){

  	socket.emit('cli-error', "This method has been removed. Please send messages that begin with '/' instead. ")
	
  });
  
  socket.on('addroom', function(data){
	if(data.name.indexOf(" ") != -1){
		io.sockets.sockets[socket.id].emit('cli-error', "Rooms cannot contain spaces!");
		return;
	}
	db.serialize(function(){
		db.get("SELECT * FROM rooms WHERE name = ? AND type = ?COLLATE NOCASE", data.name, data.type, function(err, row){
			if(row === undefined){
				db.run("INSERT INTO rooms VALUES (?, ?, ?, ?, ?, ?)", [data.name, clients[getKeyByVal(clients, socket.id)], "", data.type, "", ""]);
				rooms.push(data);
				if(data.type == 0)
					io.sockets.emit('newroom', data);
				socket.emit('joinroom', {"type":data.type,"room":data.name, "topic": ""});
				userJoined(getKeyByVal(clients, socket.id), data);
			}else{
				if(row.type == 0)
				{
					socket.emit('joinroom', {"room": row.name, "topic": row.topic});
					userJoined(getKeyByVal(clients, socket.id), row.name);
				}
			}
		});
	});
  });
  
  socket.on('buycolor', function(color){

  	if(!checkColorValid(socket, color)){
  		return;
  	}

	var user = getKeyByVal(clients, socket.id);
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
	tipUser(clients[getKeyByVal(clients, socket.id)], data.user, data.amount, socket, data.room, data.message);
  });
  
  socket.on('list', function(data){
	io.sockets.sockets[socket.id].emit('list', JSON.stringify(onlineUsers()));
  });
  
  socket.on('disconnect', function() {
	console.log("Disconnecting " + uName);
    var uName = getKeyByVal(clients, socket.id);
    delete clients[uName];
	
	io.sockets.emit('userLeft', uName);
	
    // relay this message to all the clients
 
    userLeft(uName);
  });
}); //end main namespace

nsPublic.on('connection', function(socket){
	socket.on('message', function(msg) {
		console.log(onlineUsers());
		if(msg.message === undefined){
			return;
		}
		
	    var srcUser = getKeyByVal(clients, socket.id);
		
		var curTime = new Date().getTime();
		
		db.serialize(function() {
			db.run("INSERT INTO messages VALUES (?, ?, ?, ?)", [srcUser, msg.target, msg.message, curTime])
		});
		
		if(curTime - userMsgTime[srcUser] < 500){ //check if the user is sending too many messages
			socket.emit('message',
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
		
		//broadcast
		nsPublic.emit('message',
		  {"source": srcUser,
		   "message": msg.message,
		   "target": msg.target,
		   "type": msg.type,
		   "tip": winnings
		   });
  });
}); //end nsPublic
 
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
    Object.values(clients).forEach(function(sId) {
	  console.log(uName);
      io.sockets.sockets[sId].emit('userJoined', { "name": uName, "room": room });
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
			io.sockets.sockets[sId].emit('welcome', { "userName" : uName, "currentUsers": JSON.stringify(onlineUsers()), message: "Username available! Registration complete.", "rooms": rooms, "colors": colors, "balance": 0 });
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
			io.sockets.sockets[sId].emit('welcome', { "userName" : uName, "currentUsers": JSON.stringify(onlineUsers()), message: "Login successful!", "rooms": rooms, "colors": colors, "balance": bal });
		});
	});
}
 
function userNameAlreadyInUse(sId, uName) {
  setTimeout(function() {
	console.log("Username already in use");
    io.sockets.sockets[sId].emit('cli-error', { "userNameInUse" : true });
  }, 500);
}

function checkUserName(sId, username){
	var regex = new RegExp("^([a-zA-Z0-9]|[-_]){3,15}$");

	if(username.length > 15){
		io.sockets.sockets[sId].emit('cli-error', "Your username is too long! (3-15 characters)");
		return false;
	}else if(username.length < 3){
		io.sockets.sockets[sId].emit('cli-error', "Your username is too short! (3-15 characters)");
		return false;
	}

	if(!regex.test(username)){
		io.sockets.sockets[sId].emit('cli-error', "Your username contains invalid characters!");
		return false;
	}
	return true;
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
	/*for(var i=0; i < onlineUsers().length; i++){
		if(typeof onlineUsers()[i] != 'undefined'){
			continue;
		}else{
			onlineUsers().splice(i, 1);
		}
	}*/
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

			var targetSocket = io.sockets.sockets[clients[words[1]]];
			db.serialize(function(){
				db.run("UPDATE users SET status = ? WHERE name = ?", [2, words[1]]);
			});

			if(targetSocket != undefined)
			{
				targetSocket.emit('cli-error', "You have been banned!");
				setTimeout(function(){
					targetSocket.disconnect();
				}, 2000);
			}else{
				sendInlineError(socket, "[WARN] USER NOT ONLINE", msg.target, msg.type);
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
			console.log(onlineUsers());
			console.log(clients);
			if(onlineUsers().indexOf("AHuman") != -1){
				io.sockets.sockets[clients["AHuman"]].emit('modalert', msg.target);
			}
			
			if(onlineUsers().indexOf("Ronoman") != -1){
				console.log("Callmod Ronoman");
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

function checkColorValid(socket, color)
{
	const colors = {"aliceblue":"f0f8ff","antiquewhite":"faebd7","aqua":"00ffff","aquamarine":"7fffd4","azure":"f0ffff",
	    "beige":"f5f5dc","bisque":"ffe4c4","black":"000000","blanchedalmond":"ffebcd","blue":"0000ff","blueviolet":"8a2be2","brown":"a52a2a","burlywood":"deb887",
	    "cadetblue":"5f9ea0","chartreuse":"7fff00","chocolate":"d2691e","coral":"ff7f50","cornflowerblue":"6495ed","cornsilk":"fff8dc","crimson":"dc143c","cyan":"00ffff",
	    "darkblue":"00008b","darkcyan":"008b8b","darkgoldenrod":"b8860b","darkgray":"a9a9a9","darkgreen":"006400","darkkhaki":"bdb76b","darkmagenta":"8b008b","darkolivegreen":"556b2f",
	    "darkorange":"ff8c00","darkorchid":"9932cc","darkred":"8b0000","darksalmon":"e9967a","darkseagreen":"8fbc8f","darkslateblue":"483d8b","darkslategray":"2f4f4f","darkturquoise":"00ced1",
	    "darkviolet":"9400d3","deeppink":"ff1493","deepskyblue":"00bfff","dimgray":"696969","dodgerblue":"1e90ff",
	    "firebrick":"b22222","floralwhite":"fffaf0","forestgreen":"228b22","fuchsia":"ff00ff",
	    "gainsboro":"dcdcdc","ghostwhite":"f8f8ff","gold":"ffd700","goldenrod":"daa520","gray":"808080","green":"008000","greenyellow":"adff2f",
	    "honeydew":"f0fff0","hotpink":"ff69b4",
	    "indianred ":"cd5c5c","indigo":"4b0082","ivory":"fffff0","khaki":"f0e68c",
	    "lavender":"e6e6fa","lavenderblush":"fff0f5","lawngreen":"7cfc00","lemonchiffon":"fffacd","lightblue":"add8e6","lightcoral":"f08080","lightcyan":"e0ffff","lightgoldenrodyellow":"fafad2",
	    "lightgrey":"d3d3d3","lightgreen":"90ee90","lightpink":"ffb6c1","lightsalmon":"ffa07a","lightseagreen":"20b2aa","lightskyblue":"87cefa","lightslategray":"778899","lightsteelblue":"b0c4de",
	    "lightyellow":"ffffe0","lime":"00ff00","limegreen":"32cd32","linen":"faf0e6",
	    "magenta":"ff00ff","maroon":"800000","mediumaquamarine":"66cdaa","mediumblue":"0000cd","mediumorchid":"ba55d3","mediumpurple":"9370d8","mediumseagreen":"3cb371","mediumslateblue":"7b68ee",
	    "mediumspringgreen":"00fa9a","mediumturquoise":"48d1cc","mediumvioletred":"c71585","midnightblue":"191970","mintcream":"f5fffa","mistyrose":"ffe4e1","moccasin":"ffe4b5",
	    "navajowhite":"ffdead","navy":"000080",
	    "oldlace":"fdf5e6","olive":"808000","olivedrab":"6b8e23","orange":"ffa500","orangered":"ff4500","orchid":"da70d6",
	    "palegoldenrod":"eee8aa","palegreen":"98fb98","paleturquoise":"afeeee","palevioletred":"d87093","papayawhip":"ffefd5","peachpuff":"ffdab9","peru":"cd853f","pink":"ffc0cb","plum":"dda0dd","powderblue":"b0e0e6","purple":"800080",
	    "rebeccapurple":"663399","red":"ff0000","rosybrown":"bc8f8f","royalblue":"4169e1",
	    "saddlebrown":"8b4513","salmon":"fa8072","sandybrown":"f4a460","seagreen":"2e8b57","seashell":"fff5ee","sienna":"a0522d","silver":"c0c0c0","skyblue":"87ceeb","slateblue":"6a5acd","slategray":"708090","snow":"fffafa","springgreen":"00ff7f","steelblue":"4682b4",
	    "tan":"d2b48c","teal":"008080","thistle":"d8bfd8","tomato":"ff6347","turquoise":"40e0d0",
	    "violet":"ee82ee",
	    "wheat":"f5deb3","white":"ffffff","whitesmoke":"f5f5f5",
	    "yellow":"ffff00","yellowgreen":"9acd32"};

	var result = false;
	var hexCheck = new RegExp("^([0-9a-f]{3}){1,2}$")

	color = color.toLowerCase();

	if(color == "rainbow")
		return true;

	result = hexCheck.test(color);
	if(!result){
		result = color in colors;
		console.log("found color name");
		if(result){
			console.log("hex: " + colors[color]);
			result = !checkColorTooBright(socket, colors[color]);
		}else{
			socket.emit("cli-error", "Invalid color!");
		}

	}else{
		result = !checkColorTooBright(socket, color);
	}

	return result;
}

function checkColorTooBright(socket, color){

	if(color.length == 3)
	{
		color = color[0] + color[0] + color[1] + color[1] +color[2] + color[2];
	}
	console.log("checking bright: " + color);
	var rgb = parseInt(color, 16);   // convert rrggbb to decimal
	var r = (rgb >> 16) & 0xff;  // extract red
	var g = (rgb >>  8) & 0xff;  // extract green
	var b = (rgb >>  0) & 0xff;  // extract blue

	var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709

	console.log("Luminance: " + lum);
	if (lum > 176) {
		socket.emit("cli-error", "Color too bright!");
	    return true;
	}
	return false;
}


function getKeyByVal(obj, key) {
	for( var prop in obj ) {
        if( obj.hasOwnProperty(prop)) {
            if(obj[prop] === key) {
			    console.log(prop);
                return prop;
			}
        }
    }
}

function onlineUsers() {
	users = []
	for (var key in clients) {
		if (clients.hasOwnProperty(key)) {
			users.push(key);
		}
	}
	return users;
}