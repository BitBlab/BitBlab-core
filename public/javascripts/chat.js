/*

	Copyright 2014-2017 BitBlab

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

var commandSocket;
var publicSocket;

var myUserName;

var emoteCodes = [":happy:", ":sad:", ":mad:", ":cool:", ":XD:", ":gasp:", ":speechless:", ":tongue:", ":up:", ":down:", ":grin:"];
var emoteShorts = [":)", ":(", ":@", "8)", "XD", ":O", ":|", ":P", "(Y)", "(N)", ":D"];

var roomList = []; //holds what rooms the user is listening to, along with all the rooms (in the form of ]"roomname": listening], where listening is a boolean)
var currentRoom = "Main"; //what room are we looking at right now?
var roomData = {}; //html data from the other rooms (ie: "SSI":"<span....>Message</span><br /><span....>Message2</span>
var userList = [];

var chatData = []; //holds all received messages in a certain room

var sentMessages = [];
var sentIndex = -1;

var quote = '"'; //used for creating <a> tags with certain javascript functions where 2 types of quotes are needed

var colors = []; //available user colors [unused right now]

var balance = 0;
var currentExchange = {};

var clientID;

var easterEggSound = false;

var host = window.location.hostname.split(":")[0]

function enableMsgInput(enable) {
  $('input#msg').prop('disabled', !enable);
}

function enableNewInput(enable){
	$('input#newinput').prop('disabled', !enable);
	$('input#newbutton').prop('disabled', !enable);
	$('select#color').prop('disabled', !enable);
	$('input#buycolor').prop('disabled', !enable);
	$('input#buycolorinput').prop('disabled', !enable);
}
 
function appendNewMessage(msg) {
  var html;
  
  var currentDate = new Date();
  
  if(msg.message.indexOf(myUserName) != -1 && msg.source != myUserName) {
	  
	  if(currentRoom != msg.target && roomList[msg.target]) {
		$('#room-' + msg.target).addClass('btn-warning').removeClass('btn-default');
		pingSound();
	  }else if(currentRoom == msg.target){
		pingSound();
	  }
 
  }
  if (msg.type == "room" && roomList[msg.target]) {//if the type of message is room (ie. public) and the user is listening to that room
	html = "<tr><td class='userSpan'>" + msg.source + "</td><td class='allMsg'>" + msg.message + "</td>";
	if(msg.tip > 0){
		html = html + "<td class='tipSpan'><span class='label label-primary'>" + msg.tip + "</span></td>";
	}
	//html = html + "<td align='right'>" + currentDate.getHours() + ":" + currentDate.getMinutes() + "</td>";
	html = html + "</tr><br/>";
	if(msg.target == currentRoom){
		$('#msgWindow').append(html);
		$('#msgWindow').scrollTop($('#msgWindow')[0].scrollHeight);
	}else{
		roomData[msg.target] = roomData[msg.target] + html;
	}
    
  } else if(msg.type == "priv" && msg.target == myUserName){//if the type of message is private
    html = "<span class='privTag'>[" + msg.source + "&rarr;" + myUserName + "]</span> <span class='privMsg'>" + msg.message + "</span><br/>"
	
	if("PM:" + msg.target == currentRoom){
		$('#msgWindow').append(html);
		$('#msgWindow').scrollTop($('#msgWindow')[0].scrollHeight);
	}else{
		roomData["PM:" + msg.target] = roomData["PM:" + msg.target] + html;
	}
	
  }
}
 
function appendNewUser(data, notify) {
  var user = data.name;
  var room = data.room;
  if (notify){
	if(currentRoom == room){
		$('#msgWindow').append("<tr><td class='userSpan'>[System]</td><td class='sysMsg'>" + user + " just joined!</td></tr><br/>");
	}else{
		roomData[room] = roomData[room] + "<tr><td class='userSpan'>System</td><td class='sysMsg'>" + user + " just joined!</td></tr><br/>";
	}
  }
  
  userList.push(user);
    
}
 
function handleUserLeft(msg) {
	//this will do something soon
	console.log(msg);
	return;
}
 

commandSocket = io.connect("http://" + host + ":3000");
publicSocket = io.connect("http://" + host + ":3000/public");

function setFeedback(fb) {
  $('span#feedback').html(fb);
}

function setBalance(bal) {
  bal = Math.round(100*bal)/100; 
  $('span#feedback').html("Balance: " + bal + " mBTC");
}
 
function setUsername() {
	console.log('setUsername');
    myUserName = $('input#registerUsername').val();
	pass = $('input#registerPassword').val();
	email = $('input#registerEmail').val();
	
	if(pass.length < 6){
		setFeedback("<span style='color: red'> Password must be at least 6 characters long!</span>");
	}
	
	myUserName=stripHTML(myUserName);
    commandSocket.emit('register', {"user": myUserName, "pass": pass, "email":email}, function(data) { console.log('emit set username', data); });
    console.log('Set user name as ' + myUserName);
}

function login(){
	myUserName = $('input#userName').val();
	var pass = $('input#password').val();
	
	commandSocket.emit('login', {"user": myUserName, "pass": pass, "aes": true});
	console.log('Attempting to login');
}
 
function sendMessage() {
	var trgt = currentRoom;
	var type;
	var msg = $('input#msg').val();
	var color = $('select#color').val();
	if(color == "" || color === undefined){
		color = "#000000";
	}
	
	msg = replaceEmotes(msg);
	
	if(stripHTML(msg).length < 2){
		alert("Messages must be at least 2 characters long!");
		return;
	}
	
	/*if(msg == "Ding dong, the psycho's gone."){
		easterEggSound = !easterEggSound;
	}*/
	
	sentMessages.push(msg);
	sentIndex = -1;
	
	if(trgt.indexOf("PM:") == 0){
		pmUser(trgt.substring(3), msg);
		return;
	}else{
		publicSocket.emit('message',
                {
                  "message": msg,
				  "color": color,
                  "target": trgt,
				  "type": "room"
                });
	}

    $('input#msg').val("");
}
 
function setCurrentUsers(users) {
	JSON.parse(users).forEach(function(name) {
		appendNewUser({'name':name, 'room':'Main'}, false);
	});
}
 
function setRooms(rooms){
	//$('#roomWindow >a').remove();
	for(var i=0; i < rooms.length; i++){
		roomList[rooms[i]] = false;
	}
	$('#roomWindow').append("<div class='input-group'><span class='input-group-btn'><button id='room-Main' class='btn btn-success round-left mono' onclick='toggleRoom(" + quote + "Main" + quote + ");'>Main</button><button id='close-Main' class='btn btn-success round-right mono' onclick='leaveRoom(\"Main\");'>x</button></span><br /></div>"); //setup initial room data
	roomList["Main"] = true;
}

function setColors(colors){
	for(var i=0; i<colors.length; i++){
		$('select#color').append($('<option></option>').val(colors[i]).html("<span style='color:" + colors[i] + "'>" + colors[i] + "</span>"));
	}

}

function toggleRoom(room, topic){
	if(room == currentRoom){
		return;
	}
	
	if(typeof roomList[room] == 'undefined'){
		roomList[room] = true;
		$('#roomWindow').append("<div class='input-group'><span class='input-group-btn'><button id='room-" + room + "' class='btn btn-success round-left mono' href='javascript:void(0)' onclick='toggleRoom(" + quote + room + quote + ");'>" + room + "</button><button id='close-" + room + "' class='btn btn-success round-right mono' onclick='leaveRoom(\"" + room + "\");'>x</button></span><br /></div>");
	}
	
	if(!roomList[room]){
		roomList[room] = true;
		$('#roomWindow').append("<div class='input-group'><span class='input-group-btn'><button id='room-" + room + "' class='btn btn-success round-left mono' href='javascript:void(0)' onclick='toggleRoom(" + quote + room + quote + ");'>" + room + "</button><button id='close-" + room + "' class='btn btn-success round-right mono' onclick='leaveRoom(\"" + room + "\");'>x</button></span><br /></div>");
	}
	
	$('#room-' + room).addClass('btn-success').removeClass('btn-default').removeClass('btn-warning').removeClass('btn-danger');
	$('#close-' + room).addClass('btn-success').removeClass('btn-default').removeClass('btn-warning').removeClass('btn-danger');
	$('#room-' + currentRoom).addClass('btn-default').removeClass('btn-success');
	$('#close-' + currentRoom).addClass('btn-default').removeClass('btn-success');
	
	roomData[currentRoom] = $('#msgWindow').html();
	
	currentRoom = room;
	
	$('#msgWindow').empty(); //remove all the old text
	
	if(currentRoom == room){
		if(topic != "") {
			$('#msgWindow').append("<tr><td class='userSpan'>[System]</td><td class='sysMsg'>Topic: " + topic + "</td></tr><br/>");
		}
	}else{
		if(topic != "") {
			roomData[room] = roomData[room] + "<tr><td class='userSpan'>System</td><td class='sysMsg'>Topic: " + topic + "</td></tr><br/>";
		}
	}
	
	if(roomData[currentRoom] != undefined && roomData[currentRoom] != ""){
		$('#msgWindow').html(roomData[currentRoom]);
	}
}

function newRoom(roomname){
	if(!roomList[roomname]){
		roomList[roomname] = false;
	}
}

function pmUser(user, msg){
	var color = $('select#color').val();
	if(color == "" || color === undefined){
		color = "#000000";
	}
	publicSocket.emit('message',
                {
                  "message": msg,
				  "color": color,
                  "target": user,
				  "type": "priv"
                });
	var room = "PM:" + user;
	if(typeof roomList[room] == "undefined" || roomList[room] == false){
		roomList[room] = true;
		$('#roomWindow').append("<a id='room-" + room + "' class='btn btn-success' href='javascript:void(0)' onclick='toggleRoom(" + quote + room + quote + ");'>" + room + "</a><br />");
	}
	
}

function stripHTML(str){
	str=str.replace(/<br>/gi, "\n");
	str=str.replace(/<p.*>/gi, "\n");
	str=str.replace(/<a.*href="(.*?)".*>(.*?)<\/a>/gi, "");
	str=str.replace(/<(?:.|\s)*?>/g, "");
	return str;
}

function replaceEmotes(str){
	for(var i=0; i < emoteShorts.length; i++){
		var iof = str.indexOf(emoteShorts[i]);
		if(iof != -1){
			var left = str.substring(0, iof);
			var right = str.substring(iof);
			str = left + emoteCodes[i] + right.substring(emoteShorts[i].length);
		}
	}
	return str;
}

function pingSound(){
	//if(easterEggSound){
	//	document.getElementById('dingdongSound').play();
	//}else{
		document.getElementById('pingSound').play();
	//}
}

function addRoom(room){ //public rooms ONLY
	commandSocket.emit('addroom', {"name":room, "type":0});
}
function updateExchangeRate() {
	$.getJSON("http://api.coindesk.com/v1/bpi/currentprice.json", function(result) {
		currentExchange = result;
	});
}
setInterval(updateExchangeRate, 60000);

function getExchangeRate(currency, BtoC, input) {
	if(BtoC) { //If its going Bitcoin to the Currency
		return parseFloat(currentExchange["bpi"][currency]["rate"].replace(",", ""))*input;
	} else { //Its going Currency to the Bitcoin
		return parseFloat(currentExchange["bpi"][currency]["rate"].replace(",", ""))/input;
	}
}

function leaveRoom(room) {
	node = document.getElementById("close-" + room);
	node.parentNode.parentNode.remove(node);
	commandSocket.emit("leaveroom", {"name": room});
	roomList[room] = false;
}

$(function() {
  enableMsgInput(false);
 
 
  commandSocket.on('id', function(id){
	clientID = id;
	console.log(id);
  });
  commandSocket.on('userJoined', function(msg) {
    appendNewUser(msg, true);
  });
   
  commandSocket.on('userLeft', function(msg) {
    handleUserLeft(msg);
  });
 
  publicSocket.on('message', function(msg) {
    appendNewMessage(msg);
  });
 
  commandSocket.on('welcome', function(msg) {
    setFeedback("<span style='color: green'> " + msg.message + "</span>");
    setCurrentUsers(msg.currentUsers);
	setRooms(msg.rooms);
	setColors(msg.colors);
    enableMsgInput(true);
	enableNewInput(true);
	addRoom("Main");
	balance = msg.balance;
	setBalance(balance);
	updateExchangeRate()
	
	document.getElementById("loginformdiv").remove();
	document.getElementById("settingsmenu").style.display = "unset";
	
  });
 
  commandSocket.on('cli-error', function(msg) {
      if (msg.userNameInUse) {
          setFeedback("<span style='color: red'> Username already in use. Try another name.</span>");
      }else if(msg.userNameTooLong){
		  setFeedback("<span style='color: red'> Username is too long! Max length is 15 characters</span>");
	  }else if(msg.invalidLogin){
		  setFeedback("<span style='color: red'> Invalid login information! Check your username and password.</span>");
	  }else if(msg === "colErr"){
	      alert("You already have that color!");
	  }else{
		setFeedback("<span style='color: red'>" + msg + "</span>");
	  }
  });
  
  commandSocket.on('newroom', function(roomname){
	newRoom(roomname);
  });
  
  commandSocket.on('addcolor', function(color){
	console.log("addcolor: " + color);
	$('select#color').append($('<option></option>').val(color).html("<span style='color:" + color + "'>" + color + "</span>"));
  });
  
  commandSocket.on('balance', function(bal){
	balance = bal;
	setBalance(balance);
  });
   
  commandSocket.on('tip', function(data){
	var amount = data.amount;
	balance = balance + amount;
	setBalance(balance);
  });
  
  commandSocket.on('disconnect', function(){
	location.reload(true);
  });
  
  commandSocket.on('joinroom', function(data){
	console.log("Joining room " + data.room)
	toggleRoom(data.room, data.topic);
  });
  
  commandSocket.on('modalert', function(data){
	console.log('modalert');
	$('#room-' + data).addClass('btn-danger').removeClass('btn-default').removeClass('btn-warning');
	pingSound();
	alert("Mod requested in " + data);
  });
  
  $('input#register').click(function(e){
		document.getElementById("registerUsername").value = document.getElementById("userName").value;
		document.getElementById("registerPassword").value = document.getElementById("password").value;
	    $('#registerModal').modal('toggle');
  });
  
  $('#formRegister').on('submit', function(e) {
	e.preventDefault();
	console.log("Registering!");
    setUsername();
	$('#registerModal').modal('toggle');
    return false;
  });
  
  $('#openSettings').click(function(e) {
	e.preventDefault();
	console.log("Settings");
	$('#settings').modal('toggle');
  });
  
  $('input#login').click(function(e){
	login();
  });
  
  $('input#password').bind('keypress', function(e) {
	if(e.keyCode==13){
		login();
	}
  });
   
  $('input#msg').keydown(function(e) {
      if (e.keyCode == 13) {
          sendMessage();
          e.stopPropagation();
          e.stopped = true;
          e.preventDefault();
      }else if(e.keyCode == 40){
		e.stopPropagation();
		e.stopped=true;
		e.preventDefault();
		if(sentIndex < sentMessages.length){
			sentIndex ++;
			$('input#msg').val(sentMessages[sentIndex]);
		}
	  }else if(e.keyCode == 38){
		e.stopPropagation();
		e.stopped=true;
		e.preventDefault();
		if(sentIndex > 0){
			sentIndex --;
			$('input#msg').val(sentMessages[sentIndex]);
		}
	  }else if(e.keyCode == 9){
		e.stopPropagation();
		e.stopped=true;
		e.preventDefault();
		var input = $('input#msg').val();
		var words = input.split(" ");
		var recent = words[words.length - 1].toLowerCase();
		words.pop()
		for(var l=0; l < userList.length; l++){
			if(typeof userList[l] != 'undefined'){
				if(userList[l].toLowerCase().indexOf(recent) == 0){
					recent = userList[l];
					break;
				}else{
					continue;
				}
			}
			
		}
		$('input#msg').val(words.join(" ") + " " + recent);
		return false;
	  }
  });
  
  $('input#newinput').keypress(function(e){
	if(e.keyCode == 13){
		e.stopPropagation();
		e.stopped=true;
		e.preventDefault();
		var room = $('input#newinput').val();
		$('input#newinput').val("");
		room = stripHTML(room);
		if(room != "") {
			room = stripHTML(room);
			addRoom(room);
		}
	}
  });
  
  $('input#buycolorinput').keypress(function(e){
	if(e.keyCode == 13){
		e.stopPropagation();
		e.stopped=true;
		e.preventDefault();
		if ($('input#buycolorinput').val() != "") {
			commandSocket.emit("buycolor", $('input#buycolorinput').val());
		}
		$('input#buycolorinput').val("");
	}
  });
  
  $('input#buycolor').click(function(e){
	if ($('input#buycolorinput').val() != "") {
		commandSocket.emit("buycolor", $('input#buycolorinput').val());
	}
	$('input#buycolorinput').val("");
  });
  
  $('input#newbutton').click(function(e){
	var room = $('input#newinput').val();
	$('input#newinput').val("");
	if(room != "") {
		room = stripHTML(room);
		addRoom(room);
	}
  });

  $('#sendmsg').click(function(e){
  	sendMessage();
	e.stopPropagation();
	e.stopped = true;
	e.preventDefault();
  });
  
  $('#toggleDark').click(function(e) {
	  
  });
});
