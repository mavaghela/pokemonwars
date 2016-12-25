//Author: Ryan Llewellin and Mansi Vaghela

var WebSocketServer = require('ws').Server
   ,wss = new WebSocketServer({port: 8000});

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
		//Game Engine
		switch(json.wType){

			//create a new world
			case 'new':
				ws.world = -1;
				ws.playerID = -1;
				ws.actor = -1;
				ws.wName = -1;
				
				msg={wType:'new', wID:worlds.length, wName:json.wName};
				newWorld();
				msg = JSON.stringify(msg);

				//send to clients in main menu
				for(i=0;i<wss.clients.length;i++){	
					if(wss.clients[i].world == -1){
						wss.clients[i].send(msg);
					}
				}

				messages.push(msg);
				break;

			//load existing world
			case 'load':
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
					ws.playerID = stage.available[0];
					stage.available.splice(0, 1);
					ws.actor = stage.addPlayer(ws.playerID);

					//repopulate Boxes and monsters
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
				break;

			//exit the world
			case 'exit':
				stage.removeActor(ws.actor);	
				index = stage.clients.indexOf(ws);

				if (index > -1) {
				    stage.clients.splice(index, 1);
				}

				ws.world = -1;
				ws.playerID = -1;
				ws.actor = -1;
				break;

			//player takes a step
			case 'step':
				playerStep(ws.world, ws.playerID, json.direction);
				break;
		}
	});
});

//calls step on stage
function step(){
	for(i in worlds){
		worlds[i].step();
	}
}

//player takes a step
function playerStep(wID, pID, direction){
	stage = worlds[wID];

	for(i=0;i<stage.players.length;i++){	
		if (stage.players[i][2] == pID){
			x = stage.players[i][0];
			y = stage.players[i][1];
			actor = stage.getActor(x, y);
			actor.step(direction, i)

			return;
		}
	}
}

//get box locations to repopulate
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

//create a new world
function newWorld(){
	id = worlds.length;

	stage = new Stage(20,20,id)
	worlds.push(stage);
	stage.initialize();

	if (flag) {
		stepInterval = setInterval(step, 1000);
		flag = 0;
	}
}

//get monster locations to repopulate
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
/********************************************STAGE*********************************************/
/**********************************************************************************************/

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

	//if Player, do nothing
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

	//Reflect off object
	if((actor != null) && !(actor instanceof Player)){
		this.dx = -this.dx;
		this.dy = -this.dy;
		return false;
	}

	Actor.prototype.move.call(this, this, dx, dy);
	return true;
};

// Stage-------------------------------------------------------------------------------------

function Stage(width, height, stageElementID){
	this.actors=[]; // all actors on this stage (monsters, Player, boxes, ...)
	this.walls = [];
	this.players = [];
	this.clients = [];
	this.available = [0,1,2,3,4,5,6,7,8];

	// the logical width and height of the stage
	this.width=width;
	this.height=height;

	// Boxes and Monsters
	this.Boxes = this.height + this.width
	this.Monsters = 5;
	// the element containing the visual representation of the stage
	this.stageElementID=stageElementID;
}

// initialize an instance of the game
Stage.prototype.initialize=function(){
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
			this.addActor(new Monster(this, x, y));
			numMonsters++;
		}
	}
};

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
			// gets rid of the html button
			for (i = 0 ; i < messages.length; i++) {
				button = JSON.parse(messages[i])
				if(button.wID == this.stageElementID){
					messages.splice(i, 1);
				}
			}
			coord = {wType: 'win'};
		}
	}

	coord = JSON.stringify(coord);

	for(i=0;i<wss.clients.length;i++){	
		if(wss.clients[i].world == this.stageElementID){
			wss.clients[i].send(coord);
		}
	}
}

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