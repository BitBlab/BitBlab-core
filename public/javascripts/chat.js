var socket; //Holds all connections
var myUserName; //Holds username (set on login)

var isConnected = false; //Is set to true on good connect

var emoteCodes = [":happy:", ":sad:", ":mad:", ":cool:", ":XD:", ":gasp:", ":speechless:", ":tongue:", ":up:", ":down:", ":grin:"]; //Smilys
var emoteShorts = [":)", ":(", ":@", "8)", "XD", ":O", ":|", ":P", "(Y)", "(N)", ":D"]; //Smilys shorts

var roomList = []; //holds what rooms the user is listening to, along with all the rooms (in the form of ]"roomname": listening], where listening is a boolean)
var currentRoom = "Main"; //what room are we looking at right now?
var roomData = {}; //html data from the other rooms (ie: "SSI":"<span....>Message</span><br /><span....>Message2</span>
var userList = []; 

var chatData = []; //holds all received messages in a certain room

var sentMessages = [""]; //List to hold messages sent in this session
var sentIndex = 0; //Helps iterate through sentMessages

var quote = '"'; //used for creating <a> tags with certain javascript functions where 2 types of quotes are needed

var colors = []; //available user colors [unused right now]

var balance = 0; //Set on login

var clientID;

var easterEggSound = false; //Mejick

var chatlineId = 0;

//var pingSound = new Audio("/sounds/ping.mp3");

function enableMsgInput(enable) { //Enables messaging on login
  $('input#msg').prop('disabled', !enable);
}
 
function removeLoginForm() { //Removes the form to login on login
  $('#loginform').remove();
}

function enableNewInput(enable){ //Continues enabling input
	$('input#newinput').prop('disabled', !enable);
	$('input#newbutton').prop('disabled', !enable);
	$('select#color').prop('disabled', !enable);
	$('input#buycolor').prop('disabled', !enable);
	$('input#buycolorinput').prop('disabled', !enable);
}
 
function appendNewMessage(msg) { //Appends a new message to the chat box

  var w = $('#msgWindow').width()*0.95;
  var html;
  var strippedMsg = stripHTML(msg.message);
  sentIndex = sentMessages.length
  
  if(strippedMsg.indexOf(myUserName) != -1 && msg.source != myUserName){
	  
	  if(currentRoom.toLowerCase() != msg.target.toLowerCase() && roomList[msg.target]){
		$('#room-' + msg.target).addClass('btn-warning').removeClass('btn-default');
		pingSound();
	  }else if(currentRoom == msg.target){
		pingSound();
	  }
 
  }
  if (msg.type == "room" && roomList[msg.target]) {//if the type of message is room (ie. public) and the user is listening to that room
	html = "<tr id= \"cl-" + chatlineId + "\"width=\"" + w + "\"><td class='userSpan' width=\"" + Math.round(w*0.1) + "\">" + msg.source + "</td><td class='allMsg' width=\"" + Math.round(w*0.8) + "\">" + msg.message + "</td>";
	/*if(msg.tip > 0){
		html = html + "<td class='tipSpan' width=\"" + Math.round(w*0.05) + "\"><span class='label label-primary'>" + msg.tip + "</span></td>";
	}*/

	var date = new Date();

	var timeString = date.getHours() + ":" + date.getMinutes();

	html = html + "<td class='tipSpan' width=\"" + Math.round(w*0.05) + "\"><span class=\"timetipdisp\" class='label label-default'>" + timeString + "</span></td>";
	html = html + "</tr>";
	if(msg.target == currentRoom){
		$('#msgWindow').append(html);
		$('#cl-' + chatlineId).data("tip", msg.tip).data("time", timeString);
		$('#cl-' + chatlineId).hover(function(){
			var tip = $(this).data('tip');
			var timetipdisp = $(this).find(".timetipdisp");
			timetipdisp.removeClass("label-default");
			timetipdisp.addClass("label-primary");
			timetipdisp.html(tip);
		}, function(){
			var time = $(this).data('time');
			var timetipdisp = $(this).find(".timetipdisp");
			timetipdisp.removeClass("label-primary");
			timetipdisp.addClass("label-default");
			timetipdisp.html(time);
		});
		$('#msgWindow').scrollTop($('#msgWindow')[0].scrollHeight);
	}else{
		roomData[msg.target] = roomData[msg.target] + html;
	}

	chatlineId++;
    
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
 
function appendNewUser(data, notify) { //Called on new user join
  var user = data.userName;
  var room = data.room;
  //$('select#users').append($('<option></option>').val(uName).html(uName));
  if (notify){
	if(currentRoom == room){
	    console.log("User Joined");
		$('#msgWindow').append("<tr><td class='userSpan'>[System]</td><td class='sysMsg'>" + user + " just joined!</td></tr><br/>");
	}else{
		roomData[room] = roomData[room] + "<tr><td class='userSpan'>System</td><td class='sysMsg'>" + user + " just joined!</td></tr><br/>";
	}
  }
  
  userList.push(user);
    
}
 
function handleUserLeft(msg) { //FIX
    //$("select#users option[value='" + msg.userName + "']").remove();
	//this will do something soon
	return;
}
 

socket = io.connect("http://bitblab.net:3001"); //NEW NEW external release :P
//socket = io.connect("http://localhost:3001"); //internal testing on local machine

function setFeedback(fb) { //Feedback on login/register with bad info
  $('span#feedback').html(fb);
}

function setBalance(bal) { //Sets balance number at the top
  $('span#feedback').html("Balance: " + Math.round(bal*100)/100 + " mBTC");
}
 
function setUsername() { //Handles registering
    myUserName = $('input#userName').val();
	var pass = $('input#password').val();
	
	if(pass.length < 6){
		setFeedback("<span style='color: red'> Password must be at least 6 characters long!</span>");
	}
	
	pass = CryptoJS.AES.encrypt(pass, clientID).toString();
	
	myUserName=stripHTML(myUserName);
    socket.emit('register', {"user": myUserName, "pass": pass, "aes": true}, function(data) { console.log('emit set username', data); });
    console.log('Set user name as ' + myUserName);
	//roomList["Main"] = true;
	//currentRoom = "Main";
	//$('#roomWindow').append("<a href='javascript:void(0)' onclick='toggleRoom(" + quote + "Main" + quote + ");'>Main</a><br />"); //setup initial room data
}

function login(){ //Logs in
	myUserName = $('input#userName').val();
	var pass = $('input#password').val();
	
	if(myUserName == undefined || myUserName == ""){
		setFeedback("<span style='color: red'>Username is blank!</span>");
		return;
	}
	if(pass == undefined || pass == ""){
		setFeedback("<span style='color: red'>Password is blank!</span>");
		return;
	}
	
	pass = CryptoJS.AES.encrypt(pass, clientID).toString();
	
	socket.emit('login', {"user": myUserName, "pass": pass, "aes": true});
	console.log('Attempting to login');
	//currentRoom = "Main";
	//roomList["Main"] = true;
	//$('#roomWindow').append("<a href='javascript:void(0)' onclick='toggleRoom(" + quote + "Main" + quote + ");'>Main</a><br />"); //setup initial room data
}
 
function sendMessage() { //Send a message to the server
    //var trgt = $('select#users').val();
	var trgt = currentRoom;
	var type;
	var msg = $('input#msg').val();
	var color = $('select#color').val();
	if(color == "" || color === undefined){
		color = "#000000";
	}
	msg=stripHTML(msg);
	
	msg = replaceEmotes(msg);
	
	if(msg.length < 2){
		alert("Messages must be at least 2 characters long!");
		return;
	}
	
	//BIT-5 - removed for simplicity's sake
	/*if(checkCommand(msg)){
		$('input#msg').val("");
	    return;
	}*/
	
	if(msg == "Ding dong, the psycho's gone."){
		easterEggSound = !easterEggSound;
	}
	
	/*if(trgt.charAt(1) == ":"){
		type = "room";
		trgt = trgt.substring(2);
	}else{
		type = "priv";
	}*/
	
	sentMessages.push(msg);
	sentIndex = -1;
	
	if(trgt.substring(0, 3) == "PM:"){
		pmUser(trgt.substring(3), msg);
	}else{
		socket.emit('message',
                {
                  "message": msg,
				  "color": color,
                  "target": trgt,
				  "type": "room"
                });
	}

    $('input#msg').val("");
}
 
function setCurrentUsers(usersStr) {
    //$('select#users >option').remove();
    //appendNewUser('All', false);
    JSON.parse(usersStr).forEach(function(name) {
        appendNewUser(name, false);
    });
    //$('select#users').val('All').attr('selected', true);
}
 
function setRooms(rooms){
	console.log(rooms);
	//$('#roomWindow >a').remove();
	for(var i=0; i < rooms.length; i++){
		roomList[rooms[i]] = false;
		//$('#roomWindow').append("<a href='javascript:void(0)' onclick='toggleRoom(" + quote + rooms[i] + quote + ");'>" + rooms[i] + "</a><br />");
	}
	$('#roomWindow').append("<a id='room-Main' class='btn btn-success' href='javascript:void(0)' onclick='toggleRoom(" + quote + "Main" + quote + ");'>Main</a><br />"); //setup initial room data
	roomList["Main"] = true;
}

function setColors(colors){ //Add usable colors to the color dropdown
	for(var i=0; i<colors.length; i++){
		$('select#color').append($('<option></option>').val(colors[i]).html("<span style='color:" + colors[i] + "'>" + colors[i] + "</span>"));
	}

}

function toggleRoom(room, topic){ //Clicking on a room button
    console.log(topic + "()");
	if(room == currentRoom){
		return;
	}
	if(!roomList[room]){
		roomList[room] = true;
		$('#roomWindow').append("<a id='room-" + room + "' class='btn btn-success' href='javascript:void(0)' onclick='toggleRoom(" + quote + room + quote + ");'>" + room + "</a><br />");
	}
	
	$('#room-' + room).addClass('btn-success').removeClass('btn-default').removeClass('btn-warning').removeClass('btn-danger');
	$('#room-' + currentRoom).addClass('btn-default').removeClass('btn-success');
	
	roomData[currentRoom] = $('#msgWindow').html();
	
	currentRoom = room;
	
	$('#msgWindow').empty(); //remove all the old text
	
	if(currentRoom == room){
		$('#msgWindow').append("<tr><td class='userSpan'>[System]</td><td class='sysMsg'>Topic: " + topic + "</td></tr><br/>");
	}else{
		roomData[room] = roomData[room] + "<tr><td class='userSpan'>System</td><td class='sysMsg'>Topic: " + topic + "</td></tr><br/>";
	}
	
	if(roomData[currentRoom] != undefined && roomData[currentRoom] != ""){
		$('#msgWindow').html(roomData[currentRoom]);
	}
}
//BIT-5 - removed for simplicity's sake
/*function checkCommand(msg){ //Checks if a command was typed in
	if(msg.split("")[0] == "/"){
	    params = msg.split(" ");
		console.log(params);
		socket.emit('command', {type: 'say', params: params, target: currentRoom});
	}
	return false;
}*/

function newRoom(roomname){
	if(!roomList[roomname]){
		roomList[roomname] = false;
	}
	//$('#roomWindow').append("<a href='javascript:void(0)' onclick='toggleRoom(" + quote + roomname + quote + ");'>" + roomname + "</a><br />");
}

function pmUser(user, msg){ //NEEDS FIXING
	var color = $('select#color').val();
	if(color == "" || color === undefined){
		color = "#000000";
	}
	socket.emit('message',
                {
                  "message": msg,
				  "color": color,
                  "target": user,
				  "type": "priv"
                });
	var room = "PM:" + user;
	$('#roomWindow').append("<a id='room-" + room + "' class='btn btn-success' href='javascript:void(0)' onclick='toggleRoom(" + quote + room + quote + ");'>" + room + "</a><br />");
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
	if(easterEggSound){
		document.getElementById('dingdongSound').play();
	}else{
		document.getElementById('pingSound').play();
	}
}

function addRoom(room){
	if(roomList[room]){
		toggleRoom(room);
		return;
	}
	socket.emit('addroom', room);
}

function setComponentHeights(){ //right now will only set the chatbox height
	//setInterval(function(){
		var h = $('#adWindow').height();
		//h = h*1.05;
		$('#msgWindow').height(h);
		$('#roomWindow').height(h);
		$('#roomWindow').width($('#roomWindow').width());
		$('#msgWindow').width($('#msgWindow').width());
		//$('#rwrow').height(h);
	//}, 5000); //verify the size every 5 seconds
}

//BIT-3
//cookie code found at https://stackoverflow.com/questions/14573223/set-cookie-and-get-cookie-with-javascript
function createCookie(name,value,days) {
    if (days) {
        var date = new Date();
        date.setTime(date.getTime()+(days*24*60*60*1000));
        var expires = "; expires="+date.toGMTString();
    }
    else var expires = "";
    document.cookie = name+"="+value+expires+"; path=/";
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

//BIT-3
function logOut(){
	createCookie("SESSIONID", "");
	createCookie("uname", "");
	location.reload(true);
}
function colourNameToHex(colour)
{
    var colours = {"aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
    "beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
    "cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
    "darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
    "darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
    "darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
    "firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
    "gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f",
    "honeydew":"#f0fff0","hotpink":"#ff69b4",
    "indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
    "lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
    "lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
    "lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
    "magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
    "mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
    "navajowhite":"#ffdead","navy":"#000080",
    "oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
    "palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
    "red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
    "saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
    "tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
    "violet":"#ee82ee",
    "wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5",
    "yellow":"#ffff00","yellowgreen":"#9acd32"};

    if (typeof colours[colour.toLowerCase()] != 'undefined'){
        return colours[colour.toLowerCase()];
    }
    return colour;
}

function preventEyeCancer(color){
	var c = color.substring(1);      // strip #
	var rgb = parseInt(c, 16);   // convert rrggbb to decimal
	var r = (rgb >> 16) & 0xff;  // extract red
	var g = (rgb >>  8) & 0xff;  // extract green
	var b = (rgb >>  0) & 0xff;  // extract blue

	var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709

	console.log(lum);
	if (lum > 176) {
	    return true;
	}
	return false;
}

$(function() {

	//BIT-3
	var ssession = readCookie("SESSIONID");
	if(ssession != null && ssession != ""){
		socket.emit("sessionLogin", ssession);
	}

	/*setTimeout(function(){ //BIT-4 Potential fix FAILED
		setComponentHeights();
	}, 250);*/
	
	
  enableMsgInput(false);
  
  setTimeout(function(){
  	console.log("timeout");
	if(!isConnected){
		console.log("not connected");
	    $('#statusAlert').html("<span style='color: red'>Server is down!</span>");
	}
  }, 5000); //after 5 seconds do something

	
	myUserName = readCookie("uname");
 
  socket.on('connect', function(){
	isConnected = true;
  });
 
  socket.on('id', function(id){
	clientID = id;
  });
  socket.on('userJoined', function(msg) {
    appendNewUser(msg, true);
  });
   
  socket.on('userLeft', function(msg) {
    handleUserLeft(msg);
  });
 
  socket.on('message', function(msg) {
    appendNewMessage(msg);
  });
  
  socket.on("notice", function(msg) {
    alert(msg);
  });
  //BIT-3
  socket.on('sessionLogin', function(data){
  	if(data.success == true){
  		myUserName = data.userName;
  	}else{
  		alert("Session login failed! Please login again.");
  	}
  });

  socket.on('welcome', function(msg) {
	createCookie("SESSIONID", msg.sessionID);
	createCookie("uname", msg.userName);
	addRoom("Main");
    setFeedback("<span style='color: green'> " + msg.message + "</span>");
    setCurrentUsers(msg.currentUsers);
	setRooms(msg.rooms);
	setColors(msg.colors);
    enableMsgInput(true);
    removeLoginForm();
	enableNewInput(true);
	
	balance = msg.balance;
	setBalance(balance);
	$('#usernameDisplay').html("Welcome " + myUserName + "!");
	$('#logOutBtn').html("Log Out");
	setComponentHeights();
  });
 

  //BIT-8 - the 'error' event is no longer used. 'notice' is used instead
  /*socket.on('error', function(msg) {
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
		console.log(msg);
	  }
  });*/
  
  socket.on('newroom', function(roomname){
	newRoom(roomname);
  });
  
  socket.on('addcolor', function(color){
	console.log("Added Color to avaliable colors: " + color);
	$('select#color').append($('<option></option>').val(color).html("<span style='color:" + color + "'>" + color + "</span>"));
  });
  
  socket.on('balance', function(bal){
	balance = bal;
	setBalance(balance);
  });
   
  socket.on('tip', function(data){
	var amount = data.amount;
	balance = balance + amount;
	setBalance(balance);
  });
  
  socket.on('disconnect', function(){
	isConnected = false;
	if(window.location.href.indexOf("client" > -1)) return; //edit this to match the site config (for example, change it to indexOf("bitblab.net"))
	location.reload(true);
  });
  
  socket.on('joinroom', function(data){
	toggleRoom(data.room, data.topic);
	console.log(data.topic);
  });
  
  socket.on('modalert', function(data){
	$('#room-' + data).addClass('btn-danger').removeClass('btn-default').removeClass('btn-warning');
	pingSound();
	alert("Mod requested in " + data);
  });
  
  $('input#register').click(function(e){
	setUsername();
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
		if(sentIndex > -1) {
			sentIndex --;
			$('input#msg').val(sentMessages[sentIndex]);
		}
	  }else if(e.keyCode == 9){
		e.stopPropagation();
		e.stopped=true;
		e.preventDefault();
		var input = $('input#msg').val();
		var inputWords = input.split(" ");
		var lastWord = inputWords[inputWords.length-1].toLowerCase();
		console.log(userList);
		for(var l=0; l < userList.length; l++){
			if(userList[l] === undefined) continue;
			if(userList[l].toLowerCase().indexOf(lastWord) == 0){
				inputWords[inputWords.length-1] = userList[l]; //set the current word to the username

				//Rebuild the message string
				var finalMsg = "";
				for(var m=0; m < inputWords.length; m++){
					if(m == 0){
						finalMsg = inputWords[m];
					}else{
						finalMsg = finalMsg + " " + inputWords[m];
					}
				}
				$('input#msg').val(finalMsg); //set the message input box's text to the newly built string
				break;
			}else{
				continue;
			}
		}
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
		var regex = /^[-A-Za-z]*$/;
		if(!regex.test(room)){
			alert("Only letters and hyphens are allowed!");
			return;
		}
		socket.emit('addroom', room);
		//toggleRoom(room);
		//$('#roomWindow').append("<a href='javascript:void(0)' onclick='toggleRoom(" + quote + room + quote + ");'>" + room + "</a><br />");
	}
  });
  
  $('input#buycolorinput').keypress(function(e){
	if(e.keyCode == 13){
		e.stopPropagation();
		e.stopped=true;
		e.preventDefault();
		color = $('input#buycolorinput').val();

		var newcolor = colourNameToHex(color);

		if(newcolor != color && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(newcolor)){
			if(preventEyeCancer(newcolor)){
				alert("The color you selected has been deemed too bright (eye-cancerous) for use in chat. Please pick another one. If you believe this is in error, please contact a mod.");
				return;
			}
		    socket.emit("buycolor", color);
		    $('input#buycolorinput').val("");
		}else if(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)){
			if(preventEyeCancer(newcolor)){
				alert("The color you selected has been deemed too bright (eye-cancerous) for use in chat. Please pick another one. If you believe this is in error, please contact a mod.");
				return;
			}
			socket.emit("buycolor", color);
		    $('input#buycolorinput').val("");
		}else{
			alert("Invalid color!")
		}
	}
  });
  
  $('input#newbutton').click(function(e){
	var room = $('input#newinput').val();
	$('input#newinput').val("");
	room = stripHTML(room);
	if(roomList[room]){
		toggleRoom(room);
		return;
	}
	var regex = /^[-A-Za-z]*$/;
	if(!regex.test(room)){
		alert("Only letters and hyphens are allowed in room names!");
		return;
	}
	socket.emit('addroom', room);
	//toggleRoom(room);
	//$('#roomWindow').append("<a href='javascript:void(0)' onclick='toggleRoom(" + quote + room + quote + ");'>" + room + "</a><br />");
  });
  
  $('input#buycolor').click(function(e){

		color = $('input#buycolorinput').val();

		var newcolor = colourNameToHex(color);

		if(newcolor != color && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(newcolor)){
			if(preventEyeCancer(newcolor)){
				alert("The color you selected has been deemed too bright (eye-cancerous) for use in chat. Please pick another one. If you believe this is in error, please contact a mod.");
				return;
			}
		    socket.emit("buycolor", color);
		    $('input#buycolorinput').val("");
		}else if(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)){
			if(preventEyeCancer(newcolor)){
				alert("The color you selected has been deemed too bright (eye-cancerous) for use in chat. Please pick another one. If you believe this is in error, please contact a mod.");
				return;
			}
			socket.emit("buycolor", color);
		    $('input#buycolorinput').val("");
		}else{
			alert("Invalid color!");
		}
  });
});