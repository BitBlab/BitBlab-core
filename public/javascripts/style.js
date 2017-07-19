//For managing dynamic UI
/*
$(window).resize(fitScreen);
$(document).ready(fitScreen);

function fitScreen() {
	w = document.documentElement.clientWidth;
	h = document.documentElement.clientHeight;
	console.log("Has run");
	//document.getElementById("roomWindow").style.width = "192px";
	document.getElementById("msgWindow").style.width = (100 - (217/w)*100).toString() + "vw";
	document.getElementById("msg").style.width = (100 - (281/w)*100).toString() + "vw";
}
*/

if ( $.browser.webkit ) {
    $(".my-group-button").css("height","+=1px");
}