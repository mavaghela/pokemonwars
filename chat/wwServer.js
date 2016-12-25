var WebSocketServer = require('ws').Server
   ,wss = new WebSocketServer({port: 10350});

var messages=[];
var socket;
var worlds = [];
flag = 1;

wss.on('close', function() {
    console.log('disconnected');
});

wss.broadcast = function(message){
	var i;
	for(i=0;i<this.clients.length;i++){	
		this.clients[i].send(message);
	}
}

wss.on('connection', function(ws) {
	ws.world = -1;
	ws.playerID = -1;
	ws.actor = -1;
	var i;
	for(i=0;i<messages.length;i++){
		ws.send(messages[i]);
	}
	ws.on('message', function(message) {
		json = JSON.parse(message)
		switch(json.wType){

			case 'new':
				console.log("\nin new");
				ws.world = -1;
				ws.playerID = -1;
				ws.actor = -1;
				ws.wName = -1;
				
				msg={wType:'new', wID:worlds.length, wName:json.wName};
				newWorld();

				msg = JSON.stringify(msg);

				for(i=0;i<wss.clients.length;i++){	
					if(wss.clients[i].world == -1){
						wss.clients[i].send(msg);
					}
				}

				messages.push(msg);

				break;

			case 'load':
				console.log("\nin load");
				stage = worlds[json.wID];

				if(stage.available.length == 0){
					msg = {wType:'error', err: "World full. Pick another world."};
					msg = JSON.stringify(msg);

					for(i=0;i<wss.clients.length;i++){	
						if(wss.clients[i].world == -1){
							wss.clients[i].send(msg);
						}
					}
				}

				else{

					ws.world = json.wID;
					stage.clients.push(ws);

					console.log("available before " + stage.available)
					console.log("players before " + stage.players)
					ws.playerID = stage.available[0];
					stage.available.splice(0, 1);

					ws.actor = stage.addPlayer(ws.playerID);
					console.log("available " + stage.available)
					console.log("players in world \n")
					for (var i = 0; i < stage.players.length; i++) {
						console.log(stage.players[i][2])
					};

					//repopulate Boxes
					boxes = getBoxes(ws.world);
					monsters = getMonsters(ws.world);
					

					msg={wType:'load', box:boxes, monster: monsters, walls:stage.walls, players: stage.players, pID:ws.playerID};
					

					msg = JSON.stringify(msg);
					
					for(i=0;i<wss.clients.length;i++){	
						if(wss.clients[i].world == ws.world){
							wss.clients[i].send(msg);
						}
					}
				}
				//wss.broadcast(msg);

				break;

			case 'exit':
				//remove actor
				console.log("player leaving " + ws.playerID)
				stage.removeActor(ws.actor);	

				// console.log("available " + stage.available)
				// console.log("players in world \n")
				// for (var i = 0; i < stage.players.length; i++) {
				// 	console.log(stage.players[i][2])
				// };

				index = stage.clients.indexOf(ws);
				if (index > -1) {
				    stage.clients.splice(index, 1);
				}

				ws.world = -1;
				ws.playerID = -1;
				ws.actor = -1;
				break;

			case 'step':
				console.log("in step")
				playerStep(ws.world, ws.playerID, json.direction);
				break;

			case 'message':
				msg = {wType: 'chat', chatVal: json.chat};
				msg = JSON.stringify(msg);
				console.log(msg)

				for(i=0;i<wss.clients.length;i++){	
					if(wss.clients[i].world == -1){
						wss.clients[i].send(msg);
					}
				}

				messages.push(json.chat)
				console.log(messages);
				break;	
		}
	});
});




// function keypress(id){
// 	worlds[id].Player.step(id);
// }
function step(){
	// for(i=0;i<worlds.length;i++){	
	// 	console.log("i is " + i);
	// 	console.log("length is"+worlds.length);
	// 	console.log(worlds[i].stageElementID);
	// 	worlds[i].step();
	// }
	for(i in worlds){
		//console.log(worlds[i].monsters)
		worlds[i].step();
	}
}

function playerStep(wID, pID, direction){
	stage = worlds[wID];
	for(i=0;i<stage.players.length;i++){	
		//if player id matches ID
		if (stage.players[i][2] == pID){
			x = stage.players[i][0];
			y = stage.players[i][1];
			actor = stage.getActor(x, y);
			actor.step(direction, i)

			return;
		}
	}
}

function getBoxes (wID) {
	stage = worlds[wID];
	boxes = [];

	for (var i = 0; i < stage.actors.length; i++) {
		actor = stage.actors[i];
		if(actor instanceof Box){
			boxes.push([actor.x, actor.y]);
		}
	};

	return boxes;

}

function newWorld(){
	id = worlds.length;

	stage = new Stage(20,20,id)
	worlds.push(stage);
	//socket.send($('#message').val());
	stage.initialize();
	if (flag) {
		stepInterval = setInterval(step, 500);
		flag = 0;
	}


	//window.onkeypress = keypress;
}

function getMonsters (wID) {
	stage = worlds[wID];
	monsters = [];

	for (var i = 0; i < stage.actors.length; i++) {
		actor = stage.actors[i];
		if(actor instanceof Monster){
			monsters.push([actor.x, actor.y]);
		}
	};

	return monsters;

}


/**********************************************************************************************/
/**********************************************************************************************/
/**********************************************************************************************/
/**********************************************************************************************/
/**********************************************************************************************/
/*
Author: Ryan Llewellin and Mansi Vaghela
Features:

	Exploding Monster:
		When an Exploding Monster is surrounded by boxes and dies,
		it explodes, turning adjacent squares into fire. If one of 
		the adjacent squares is a Wall (tree), it will cause a 
		ForestFire.
	Camoflouge Monster:
		When the Player gets close to this monster 
		(i.e in an adjacent square), the monster will turn
		into a Box until the Player leaves.
	Smart Monster:
		When this Monster can no longer move in its current
		direction, it will change directions.
	Fire:
		This is set when an exploding Monster dies. It sets the
		adjacent squares on fire. If anything touches fire, it 
		dies.
	ForestFire:
		When any Wall (tree) catches Fire, surrounding Walls will 
		also catch fire (similar to a forest fire!)
	Logout button:
		Logs user out, redirects to login page and unsets all
		session variables
*/

//Actor------------------------------------------------------------------------------------

function Actor(stage, x, y){
	this.stage = stage;
	this.x = x;
	this.y = y;
};

Actor.prototype.move=function(actor, dx, dy){

	oldx = actor.x;
	oldy = actor.y;
	type = "";

	actor.x += dx;
	actor.y += dy;

	if (actor instanceof Box) {
		type = "Box";
	}

	else if (actor instanceof Monster) {
		type = "Monster";
	}

	else{
		type = "Player";
		
	}


	coord = {wType: 'update', oldPos: [oldx, oldy], newPos: [actor.x, actor.y], pType:type, pID: actor.ID}


	coord = JSON.stringify(coord);

	for(i=0;i<wss.clients.length;i++){	
		if(wss.clients[i].world == actor.stage.stageElementID){
			wss.clients[i].send(coord);
		}
	}

	return;
};

Actor.prototype.step=function(){
	return;
};

//PLAYER------------------------------------------------------------------------------------
Player.prototype = new Actor();

function Player(stage, x, y, ID){
	Actor.call(this, stage, x, y);
	this.ID = ID;
}

Player.prototype.step=function(id, i){
// 	if (this.stage.Player == null) {
// 		return;
// 	};
// 	if(id instanceof KeyboardEvent){
// 		id = id.charCode.toString();
// 	}

	dx = null;
	dy = null;

	switch(id){
		case "119"://North
			dx = -1;
			dy = 0;
			break;
		case "101"://North East
			dx = -1;
			dy = 1;
			break;
		case "100"://East
			dx = 0;
			dy = 1;
			break;
		case "99"://South East
			dx = 1;
			dy = 1;
			break;
		case "120"://South
			dx = 1;
			dy = 0;
			break;
		case "122"://South West
			dx = 1;
			dy = -1;
			break;
		case "97"://West
			dx = 0;
			dy = -1;
			break;
		case "113"://North West
			dx = -1;
			dy = -1;
			break;
	}

	if ((dx != null) && (dy != null)){
		//if move, update coord
		if(this.move(dx, dy)){
			this.stage.players[i][0] += dx;
			this.stage.players[i][1] += dy;
		}
	}
};

Player.prototype.move=function(dx, dy){
	newX = this.x + dx;
	newY = this.y + dy;
	actor = this.stage.getActor(newX, newY);

	//If Monster, Player is dead
	if(actor instanceof Monster){
		coord = {wType: 'exit'}
		coord = JSON.stringify(coord);

		for(i=0;i<wss.clients.length;i++){	
			if(wss.clients[i].playerID == this.ID){
				wss.clients[i].send(coord);
			}
		}
	}

// 	//If Fire, Player is dead
// 	if (actor instanceof Fire) {
// 		this.stage.removeActor(this);
// 	};

	//if Player or Box, do nothing
	if (actor instanceof Player) {
		return false;
	};

	//If there is an actor at (dx, dy), ask them to move
	if (actor != null){
		if (!actor.move(dx, dy)) {
			return false;
		}
	}
	Actor.prototype.move(this, dx, dy);


	return true;
};

// Player.prototype.setIcon = function(src) {
// 	this.icon = src;
// };

//Wall----------------------------------------------------------------------------------------

Wall.prototype = new Actor();

function Wall(stage, x, y){
	Actor.call(this, stage, x, y);
};

Wall.prototype.move = function() {
	return false;
};

//Box--------------------------------------------------------------------------------------------

Box.prototype = new Actor();

function Box(stage, x, y){
	Actor.call(this, stage, x, y);
};

Box.prototype.move = function(dx, dy) {
	newX = this.x + dx;
	newY = this.y + dy;
	actor = this.stage.getActor(newX, newY);

// 	//If box touches fire, remove box
// 	if (actor instanceof Fire) {
// 		this.stage.removeActor(this);
// 		return true;
// 	};
	
	//can't push a player
	if (actor instanceof Player) {
		return false;
	};

	//If there is an actor at (dx, dy), ask them to move
	if (actor != null){
		if (!actor.move(dx, dy)) {
			return false;
		}
	}

	Actor.prototype.move(this, dx, dy);
	return true;
};

//Monster------------------------------------------------------------------------------------------

Monster.prototype = new Actor();

function Monster(stage, x, y){
	Actor.call(this, stage, x, y);

	this.dx = Math.round(Math.random()) * 2 - 1;
	this.dy = Math.round(Math.random()) * 2 - 1;
};

Monster.prototype.isDead = function() {
	for(x = this.x - 1; x <= this.x + 1;x++){
		for(y = this.y -1; y <= this.y + 1;y++){
			actor = this.stage.getActor(x, y);
			if ((actor == null) || (actor instanceof Player)){
				return false;
			}
		}
	}
	return true;
};

Monster.prototype.step = function(i) {
	this.move(this, this.dx, this.dy);

	if (this.isDead()) {
		this.stage.removeActor(this);
	};
	
	// if (this.isDead()) {
	// 	if (this instanceof ExplodeMonster) {
	// 		this.explode();
	// 	}
	// 	else{
	// 		this.stage.removeActor(this);
	// 	}
	// }

};

Monster.prototype.move = function(other, dx, dy) {
	//No one can push a monster! 
	if (other != this) {
		return false;
	};
	//Init
	newX = this.x + this.dx;
	newY = this.y + this.dy;
	actor = this.stage.getActor(newX, newY);

	//Kill Player
	if(actor instanceof Player){
		coord = {wType: 'exit'}
		coord = JSON.stringify(coord);

		for(i=0;i<wss.clients.length;i++){	
			if(wss.clients[i].playerID == actor.ID){
				wss.clients[i].send(coord);
			}
		}
	}

	//Kill Monster if Monster touches Fire
	// if (actor instanceof Fire) {
	// 	this.stage.removeActor(this);
	// 	return false;
	// };

	//Reflect off object
	if((actor != null) && !(actor instanceof Player)){
		this.dx = -this.dx;
		this.dy = -this.dy;
		return false;
	}

	Actor.prototype.move.call(this, this, dx, dy);
	return true;
};

//Fire----------------------------------------------------

Fire.prototype = new Actor();

function Fire(stage, x, y){
	Actor.call(this, stage, x, y);
}

Fire.prototype.move = function() {
	return false;
};

//ExplodeMonster--------------------------------------------

ExplodeMonster.prototype = new Monster();

function ExplodeMonster(stage, x, y){
	Monster.call(this, stage, x, y);
}

// ExplodeMonster.prototype.explode = function() {
// 	forestFire = false
// 	for(x = this.x - 1; x <= this.x + 1;x++){
// 		for(y = this.y -1; y <= this.y + 1;y++){
// 			actor = this.stage.getActor(x, y);
// 			if (actor instanceof Wall) {
// 				forestFire = true
// 			}
// 			if ((actor != null) && !(actor instanceof Fire))  {
// 				this.stage.removeActor(actor);
// 				this.stage.addActor(new Fire(this.stage.fireImageSrc, this.stage, x, y));
// 			}
// 		}
// 	}

// 	if (forestFire) {
// 		this.stage.forestFire();
// 	}
// }

//CamoMonster--------------------------------------------

CamoMonster.prototype = new Monster();

function CamoMonster(stage, x, y){
	Monster.call(this, stage, x, y);
}

// CamoMonster.prototype.camoflouge = function() {
// 	for(x = this.x - 1; x <= this.x + 1;x++){
// 		for(y = this.y -1; y <= this.y + 1;y++){
// 			actor = this.stage.getActor(x, y);
// 			if (actor instanceof Player) {
// 				this.icon=this.stage.boxImageSrc;
// 				this.stage.setImage(this.x, this.y, this.icon)
// 				return true
// 			}
// 		}
// 	}
// 	this.icon=this.stage.camoImageSrc;
// 	this.stage.setImage(this.x, this.y, this.icon)
// 	return false
// }

// CamoMonster.prototype.move = function() {
// 	if (this.camoflouge()){
// 		return false	
// 	}
// 	Monster.prototype.move.call(this, this, this.dx, this.dy)
// }

//SmartMonster--------------------------------------------

SmartMonster.prototype = new Monster();

function SmartMonster(stage, x, y){
	Monster.call(this, stage, x, y);
}

// SmartMonster.prototype.escape = function() {
// 	for(x = this.x - 1; x <= this.x + 1;x++){
// 		for(y = this.y -1; y <= this.y + 1;y++){
// 			actor = this.stage.getActor(x, y);
// 			if (actor == null) {
// 				this.dx = x - this.x;
// 				this.dy = y - this.y;
// 				return
// 			}
// 		}
// 	}
// }

// SmartMonster.prototype.move = function() {
// 	if (!(Monster.prototype.move.call(this, this, this.dx, this.dy))) {
// 		this.escape();
// 	}
// }

// Stage-------------------------------------------------------------------------------------

function Stage(width, height, stageElementID){
	this.actors=[]; // all actors on this stage (monsters, Player, boxes, ...)
	this.walls = [];
	//this.monsters = [];
	this.players = [];
	this.clients = [];
	this.available = [0,1,2,3,4,5,6,7,8];

	this.won = false; //set to true if the player wins
	this.lose = false; //set to true it the player loses

	// the logical width and height of the stage
	this.width=width;
	this.height=height;

	// Boxes and Monsters
	this.Boxes = this.height + this.width
	this.Monsters = 1;
	// the element containing the visual representation of the stage
	this.stageElementID=stageElementID;

	// take a look at the value of these to understand why we capture them this way
	// an alternative would be to use 'new Image()'
	// this.blankImageSrc=document.getElementById('blankImage').src;
	// this.explodingImageSrc=document.getElementById('explodingImage').src;
	// this.camoImageSrc=document.getElementById('camoImage').src;
	// this.smartImageSrc=document.getElementById('smartImage').src;
	// this.playerImageSrc=document.getElementById('playerImage').src;
	// this.playerUpSrc=document.getElementById('playerUp').src;
	// this.playerLeftSrc=document.getElementById('playerLeft').src;
	// this.playerRightSrc=document.getElementById('playerRight').src;
	// this.boxImageSrc=document.getElementById('boxImage').src;
	// this.wallImageSrc=document.getElementById('wallImage').src;
	// this.fireImageSrc=document.getElementById('fireImage').src;
}

// initialize an instance of the game
Stage.prototype.initialize=function(){
	// Create a table of blank images, give each image an ID so we can reference it later

	// Put it in the stageElementID (innerHTML)

	//CLIENT: set grid to table
	//document.getElementById(this.stageElementID).innerHTML = table;
	
	//CLIENT:Add the Player 
	

	// Add walls around the outside of the stage, so actors can't leave the stage
	this.populateWalls();
	// Add some Boxes to the stage
	this.populateBoxes();
	// Add in some Monsters
	this.populateMonsters();

}

Stage.prototype.addPlayer = function(id) {
	x = Math.floor((Math.random() * (this.width - 2)) + 1);
	y = Math.floor((Math.random() * (this.height - 2)) + 1);

	while (this.getActor(x,y) != null){
		x = Math.floor((Math.random() * (this.width - 2)) + 1);
		y = Math.floor((Math.random() * (this.height - 2)) + 1);
	}

	player = new Player(this, x,y, id);
	this.addActor(player);

	this.players.push([x,y, id]);
	return player;
}

Stage.prototype.populateBoxes = function() {
	var numBoxes = 0;
	while (numBoxes < this.Boxes){
		var x = Math.floor((Math.random() * (this.width - 2)) + 1);
		var y = Math.floor((Math.random() * (this.height - 2)) + 1);
		if (this.getActor(x,y) == null){
			this.addActor(new Box(this, x, y));
			numBoxes++;
		}
	}
}

Stage.prototype.populateWalls = function() {
	for (x = 0; x < this.width; x++){
		this.addActor(new Wall(this, x, 0));
		this.addActor(new Wall(this, x, (this.height - 1)));
		this.walls.push([x,0]);
		this.walls.push([x,(this.height - 1)]);
	}
	for (y = 0; y < this.height; y++){
		this.addActor(new Wall(this, 0, y));
		this.addActor(new Wall(this, (this.width - 1), y));
		this.walls.push([0,y]);
		this.walls.push([(this.width - 1), y]);
	}
}

Stage.prototype.populateMonsters = function() {
	numMonsters = 0;
	//Populate Monsters
	while(numMonsters < this.Monsters){
		var x = Math.floor((Math.random() * (this.width - 2)) + 1);
		var y = Math.floor((Math.random() * (this.height - 2)) + 1);
		if (this.getActor(x,y) == null){
			this.addActor(new ExplodeMonster(this, x, y));
			numMonsters++;
			//this.monsters.push([x,y])
		}
	}

	// numMonsters = 0;
	// //Populate CMonsters
	// while(numMonsters < this.CMonsters){
	// 	var x = Math.floor((Math.random() * (this.width - 2)) + 1);
	// 	var y = Math.floor((Math.random() * (this.height - 2)) + 1);
	// 	if (this.getActor(x,y) == null){
	// 		this.addActor(new CamoMonster(this, x, y));
	// 		numMonsters++;
	// 		this.cmonsters.push([x,y])
	// 	}
	// }

	// numMonsters = 0;
	// //Populate SMonsters
	// while(numMonsters < this.SMonsters){
	// 	var x = Math.floor((Math.random() * (this.width - 2)) + 1);
	// 	var y = Math.floor((Math.random() * (this.height - 2)) + 1);
	// 	if (this.getActor(x,y) == null){
	// 		this.addActor(new SmartMonster(this, x, y));
	// 		numMonsters++;
	// 		this.Smonsters.push([x,y])
	// 	}
	// }
};
// Return the ID of a particular image, useful so we don't have to continually reconstruct IDs
Stage.prototype.getStageId=function(x,y){ 
	return (x + ',' + y); 
}

Stage.prototype.addActor=function(actor){
	this.actors.push(actor);
}

Stage.prototype.removeActor=function(actor){
	// Lookup javascript array manipulation (indexOf and splice).
	index = this.actors.indexOf(actor);
	if (index > -1) {
	    this.actors.splice(index, 1);
	}

	if (actor instanceof Player) {
		this.available.push(actor.ID);
		this.available.sort();

		for (var i = 0; i < this.players.length; i++) {
			if (this.players[i][2] == actor.ID){
				this.players.splice(i, 1)
				break;
			}
		}
	}


	coord = {wType: 'remove', pos: [actor.x, actor.y]};

	if (actor instanceof Monster) {
		this.Monsters--;
		if (this.Monsters == 0) {
			console.log('WIN!');

			console.log("Printing messages before")
			console.log(messages)
			// gets rid of the html button
			for (i = 0 ; i < messages.length; i++) {
				blah = JSON.parse(messages[i])
				if(blah.wID == this.stageElementID){
					console.log("Removing " + messages[i]);
					messages.splice(i, 1);
				}
			}

			console.log("Printing messages after splice")
			console.log(messages)

			coord = {wType: 'win'};

			//delete stage
			
		}

	}

	coord = JSON.stringify(coord);

	for(i=0;i<wss.clients.length;i++){	
		if(wss.clients[i].world == this.stageElementID){
			wss.clients[i].send(coord);
		}
	}


}

// Stage.prototype.forestFire = function() {
// 	for (x = 0; x < this.width; x++){
// 		//If there is a wall here, remove it
// 		actor = this.getActor(x, 0);
// 		if(actor != null){
// 			this.removeActor(actor)
// 		}
// 		this.addActor(new Fire(this.fireImageSrc, this, x, 0));

// 		actor = this.getActor(x, (this.height - 1));
// 		if(actor != null){
// 			this.removeActor(actor)
// 		}
// 		this.addActor(new Fire(this.fireImageSrc, this, x, (this.height - 1)));

// 	}
// 	for (y = 0; y < this.height; y++){
// 		actor = this.getActor(0, y);
// 		if(actor != null){
// 			this.removeActor(actor)
// 		}
// 		this.addActor(new Fire(this.fireImageSrc, this, 0, y));

// 		actor = this.getActor((this.width - 1), y);
// 		if(actor != null){
// 			this.removeActor(actor)
// 		}
// 		this.addActor(new Fire(this.fireImageSrc, this, (this.width - 1), y));
// 	}
// };

// Set the src of the image at stage location (x,y) to src
// Stage.prototype.setImage=function(x, y, src){
// 	document.getElementById(this.getStageId(x, y)).src = src;
// }

// Take one step in the animation of the game.  
Stage.prototype.step=function(){
	for(var i=0;i<this.actors.length;i++){
		// each actor takes a single step in the game
		this.actors[i].step();
	}
}

// return the first actor at coordinates (x,y) return null if there is no such actor
// there should be only one actor at (x,y)!
Stage.prototype.getActor=function(x, y){
	for(var i=0;i<this.actors.length;i++){
		if((this.actors[i].x == x) && this.actors[i].y == y){
			return this.actors[i];
		}
	}
	return null;
}

// Stage.prototype.gameOver=function(){
// 	alert("Game Over!")
// 	this.lose = true;
// 	clearInterval(timeInterval)
// 	clearInterval(stepInterval)
// 	//document.forms["scoreForm"].submit();
// }

// Stage.prototype.win=function(){
// 	//do something
// 	alert("You win")
// 	this.won = true;
// 	clearInterval(timeInterval);
// 	clearInterval(stepInterval);
// 	//document.getElementById("score").value = time;
// 	//document.forms["scoreForm"].submit();
// }