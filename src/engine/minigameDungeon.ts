/**
 * minigameDungeon.ts — The Factory Dungeon minigame.
 *
 * Ported from the CC2 legacy (public/legacy/dungeons.js + DungeonGen.js).
 * A turn-based dungeon crawler: send a hero into procedurally generated
 * maps, fight monsters, collect cookies, and reach the exit.
 *
 * CC3 minigame contract (matching building.minigame):
 *   launch / init / save / load / reset / logic / draw
 */

import type { Building, Game as EngineGame } from "./types";
import { Beautify } from "./utils/format";

/* ====================================================================== *
 *  HELPERS                                                                *
 * ====================================================================== */

let g: EngineGame;

function l(id: string): HTMLElement {
	return document.getElementById(id) as HTMLElement;
}

function choose<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

// CC3 (Tier 3): combat sound effects. Throttled so auto-play doesn't
// machine-gun the audio buffer, and gated on the player's cookie-sound pref
// (matching how the rest of the engine guards PlaySound calls).
let lastDungeonSfx = 0;
function playDungeonSfx(url: string, vol: number) {
	const prefs = (g as any).prefs;
	if (prefs && prefs.cookiesound === false) return;
	const now = Date.now();
	if (now - lastDungeonSfx < 90) return;
	lastDungeonSfx = now;
	PlaySound(url, vol);
}

/* ====================================================================== *
 *  NAME GENERATOR                                                         *
 * ====================================================================== */

function getWord(type: string): string {
	if (type === "secret") return choose(["hidden", "secret", "mysterious", "forgotten", "forbidden", "lost", "sunk", "buried", "concealed", "shrouded", "invisible", "elder"]);
	if (type === "ruined") return choose(["ancient", "old", "ruined", "ravaged", "destroyed", "collapsed", "demolished", "burnt", "torn-down", "shattered", "dilapidated", "abandoned", "crumbling", "derelict", "decaying"]);
	if (type === "magical") return choose(["arcane", "magical", "mystical", "sacred", "honed", "banished", "unholy", "holy", "demonic", "enchanted", "necromantic", "bewitched", "haunted", "occult", "astral"]);
	return "";
}

/* ====================================================================== *
 *  DUNGEON GEN — procedural map generation                                *
 * ====================================================================== */

const TILE_EMPTY = 0;
const TILE_LIMIT = -100;
const TILE_FLOOR_EDGE = 100;
const TILE_FLOOR_CENTER = 110;
const TILE_DOOR = 200;
const TILE_PILLAR = 300;
const TILE_WATER = 400;
const TILE_WALL = 500;
const TILE_WALL_CORNER = 510;
const TILE_ENTRANCE = 250;
const TILE_EXIT = 260;

function rand(a: number, b: number): number {
	return Math.floor(Math.random() * (b - a + 1) + a);
}

interface RoomData {
	id: number;
	w: number;
	h: number;
	x: number;
	y: number;
	tiles: { x: number; y: number; type: number; score: number }[];
	freeTiles: number;
	parent: RoomData | number;
	children: RoomData[];
	gen: number;
	door: [number, number] | number;
	corridor: boolean;
	hidden: boolean;
}

interface DungeonGenMap {
	w: number; h: number;
	rooms: RoomData[];
	freeWalls: [number, number][];
	freeTiles: [number, number][];
	doors: [number, number, RoomData][];
	tiles: number; tilesDug: number; digs: number; stuck: number;
	data: number[][][];
	entrance: [number, number];
	exit: [number, number];
	seed: number;
	roomSize: number; corridorSize: number; fillRatio: number;
	corridorRatio: number; pillarRatio: number; waterRatio: number;
	branching: number; sizeVariance: number;
	roomsAreHidden: boolean;
	str: string;
	getType: (x: number, y: number) => number;
	getRoom: (x: number, y: number) => RoomData | number;
	getTile: (x: number, y: number) => any;
	isWall: (x: number, y: number) => number;
	isFloor: (x: number, y: number) => number;
	removeFreeTile: (x: number, y: number) => void;
	fill: (what: any) => void;
	fillZone: (X: number, Y: number, W: number, H: number, what: number) => void;
	getRoomTile: (room: RoomData, x: number, y: number) => number;
	getFloorTileInRoom: (room: RoomData) => any;
	canPlaceRoom: (rx: number, ry: number, rw: number, rh: number) => boolean;
	setRoomTile: (room: RoomData, x: number, y: number, tile: number) => boolean;
	expandRoom: (room: RoomData, rx: number, ry: number, rw: number, rh: number) => void;
	newRoom: (x: number, y: number, w: number, h: number, parent?: RoomData) => RoomData;
	planRoom: (room: RoomData) => void;
	carve: (room: RoomData) => void;
	newRandomRoom: (params?: Record<string, any>) => RoomData | number;
	getRandomSpotInRoom: (room: RoomData) => any;
	getBestSpotInRoom: (room: RoomData) => any;
	getEarliestRoom: () => RoomData;
	getDeepestRoom: () => RoomData;
	dig: () => number;
	finish: () => void;
	isObstacle: (x: number, y: number) => number;
	getPic: (x: number, y: number) => [number, number];
	assignTiles: (room: RoomData, tiles: Record<string, string>) => void;
	draw: (size?: number) => string;
	drawDetailed: () => string;
	getStr: () => string;
}

const Patterns: { name: string; func: (x: number, y: number, room: RoomData) => number }[] = [];
Patterns.push({ name: "Pillars", func: (x, y, room) => ((x + room.x) % 2 === 0 && (y + room.y) % 2 === 0 && Math.random() < 0.8) ? TILE_PILLAR : 0 });
Patterns.push({ name: "Large pillars", func: (x, y, room) => ((x + room.x) % 3 < 2 && (y + room.y) % 3 < 2 && Math.random() < 0.8) ? TILE_PILLAR : 0 });
Patterns.push({ name: "Sparse pillars", func: (x, y, room) => ((x + room.x) % 3 === 0 && (y + room.y) % 3 === 0 && Math.random() < 0.8) ? TILE_PILLAR : 0 });
Patterns.push({ name: "Lines", func: (x, y, room) => {
	if (room.x % 2 === 0) { if ((x + room.x) % 2 === 0 && Math.random() < 0.98) return TILE_PILLAR; }
	if (room.x % 2 === 1) { if ((y + room.y) % 2 === 0 && Math.random() < 0.98) return TILE_PILLAR; }
	return 0;
}});

const Tiles: any[] = [];
const TilesByName: Record<string, any> = {};

function makeTile(name: string, pic: [number, number], joinType: string) {
	const id = Tiles.length;
	const tile = { name, pic, joinType, id };
	Tiles[id] = tile;
	TilesByName[name] = tile;
}
makeTile("void", [0, 0], "none");

function loadTiles(arr: [string, [number, number], string?][]) {
	for (const [name, pic, joinType] of arr) makeTile(name, pic, joinType || "none");
}
loadTiles([
	["wall", [1, 0], "join"], ["wall corner", [1, 0]], ["floor", [1, 1], "random3"],
	["tiled floor", [1, 2], "join"], ["round pillar", [1, 4]], ["square pillar", [2, 4]],
	["potted plant", [3, 4]], ["bookshelf", [4, 5], "join"], ["door", [1, 3], "join"],
	["alt wall", [4, 0], "join"], ["alt wall corner", [4, 0]], ["alt floor", [4, 1], "random3"],
	["alt tiled floor", [4, 2], "join"], ["alt round pillar", [4, 4]], ["alt square pillar", [5, 4]],
	["alt potted plant", [6, 4]], ["alt bookshelf", [4, 6], "join"], ["alt door", [4, 3], "join"],
	["water", [1, 5]], ["green water", [2, 5]], ["dark water", [3, 5]],
	["wooden wall", [1, 7], "join"], ["wooden floor", [1, 6], "random3"],
	["conveyor belt", [4, 7], "join"], ["entrance", [0, 1]], ["alt entrance", [0, 3]],
	["exit", [0, 2]], ["alt exit", [0, 4]],
]);

function joinTile(map: DungeonGenMap, x: number, y: number, joinWith: number[]): number {
	const x1 = map.data[x - 1]?.[y]?.[0] ?? 0;
	const x2 = map.data[x + 1]?.[y]?.[0] ?? 0;
	const y1 = map.data[x]?.[y - 1]?.[0] ?? 0;
	const y2 = map.data[x]?.[y + 1]?.[0] ?? 0;
	const jw = [...joinWith, map.data[x][y][0]];
	let joinsX = 0, joinsY = 0;
	for (const v of jw) { if (x1 === v) joinsX++; if (x2 === v) joinsX++; }
	for (const v of jw) { if (y1 === v) joinsY++; if (y2 === v) joinsY++; }
	if (joinsX === 2 && joinsY === 2) return 1;
	if (joinsX === 2) return 2;
	if (joinsY === 2) return 3;
	return 1;
}

function makeMap(w: number, h: number, _seed: number, params: Record<string, any>): DungeonGenMap {
	const map: DungeonGenMap = {
		w, h, rooms: [], freeWalls: [], freeTiles: [], doors: [],
		tiles: 0, tilesDug: 0, digs: 0, stuck: 0,
		data: [],
		entrance: [0, 0], exit: [0, 0],
		seed: _seed, roomSize: 10, corridorSize: 5, fillRatio: 1 / 3,
		corridorRatio: 0.2, pillarRatio: 0.2, waterRatio: 0,
		branching: 4, sizeVariance: 0.2, roomsAreHidden: false, str: "",

		getType: function (x, y) { return this.data[x][y][0]; },
		getRoom: function (x, y) { return this.data[x][y][1] !== -1 ? this.rooms[this.data[x][y][1]] : -1; },
		getTile: function (x, y) { return this.rooms[this.data[x][y][2]]; },
		isWall: function (x, y) { let n = 0; for (const i of this.freeWalls) { if (i[0] === x && i[1] === y) return n; n++; } return -1; },
		isFloor: function (x, y) { let n = 0; for (const i of this.freeTiles) { if (i[0] === x && i[1] === y) return n; n++; } return -1; },
		removeFreeTile: function (x, y) { const idx = this.isFloor(x, y); if (idx !== -1) this.freeTiles.splice(idx, 1); },
		fill: function (what) { const func = typeof what === "function"; for (let x = 0; x < this.w; x++) for (let y = 0; y < this.h; y++) this.data[x][y] = func ? [what(this, x, y), -1, 0] : [what, -1, 0]; this.rooms = []; },
		fillZone: function (X, Y, W, H, what) { for (let x = X; x < X + W; x++) for (let y = Y; y < Y + H; y++) this.data[x][y][0] = what; },
		getRoomTile: function (room, x, y) { let n = 0; for (const t of room.tiles) { if (t.x === x && t.y === y) return n; n++; } return -1; },
		getFloorTileInRoom: function (room) { const tiles = []; for (const t of room.tiles) if (t.type === TILE_FLOOR_EDGE || t.type === TILE_FLOOR_CENTER) tiles.push(t); return choose(tiles); },
		canPlaceRoom: function (rx, ry, rw, rh) {
			if (rx < 2 || ry < 2 || rx + rw >= this.w - 1 || ry + rh >= this.h - 1) return false;
			for (let x = rx; x < rx + rw; x++) for (let y = ry; y < ry + rh; y++) if (this.getType(x, y) === TILE_LIMIT || this.getRoom(x, y) !== -1) return false;
			return true;
		},
		setRoomTile: function (room, x, y, tile) {
			const oldTile = this.getRoomTile(room, x, y);
			const oldTileType = oldTile !== -1 ? room.tiles[oldTile].type : -1;
			if (oldTile !== -1 && ((tile === TILE_WALL || tile === TILE_WALL_CORNER) || (tile === TILE_FLOOR_EDGE && oldTileType === TILE_FLOOR_CENTER))) return false;
			if (oldTile !== -1) room.tiles.splice(oldTile, 1);
			room.tiles.push({ x, y, type: tile, score: 0 });
			if ((tile === TILE_FLOOR_EDGE || tile === TILE_FLOOR_CENTER) && (oldTileType !== TILE_FLOOR_EDGE && oldTileType !== TILE_FLOOR_CENTER)) room.freeTiles++;
			else if (tile !== TILE_FLOOR_EDGE && tile !== TILE_FLOOR_CENTER && (oldTileType === TILE_FLOOR_EDGE || oldTileType === TILE_FLOOR_CENTER)) room.freeTiles--;
			return true;
		},
		expandRoom: function (room, rx, ry, rw, rh) {
			for (let x = rx; x < rx + rw; x++) for (let y = ry; y < ry + rh; y++) this.setRoomTile(room, x, y, TILE_FLOOR_EDGE);
			for (let x = rx + 1; x < rx + rw - 1; x++) for (let y = ry + 1; y < ry + rh - 1; y++) this.setRoomTile(room, x, y, TILE_FLOOR_CENTER);
			let y = ry - 1; for (let x = rx; x < rx + rw; x++) this.setRoomTile(room, x, y, TILE_WALL);
			y = ry + rh; for (let x = rx; x < rx + rw; x++) this.setRoomTile(room, x, y, TILE_WALL);
			let x = rx - 1; for (y = ry; y < ry + rh; y++) this.setRoomTile(room, x, y, TILE_WALL);
			x = rx + rw; for (y = ry; y < ry + rh; y++) this.setRoomTile(room, x, y, TILE_WALL);
			this.setRoomTile(room, rx - 1, ry - 1, TILE_WALL_CORNER);
			this.setRoomTile(room, rx + rw, ry - 1, TILE_WALL_CORNER);
			this.setRoomTile(room, rx - 1, ry + rh, TILE_WALL_CORNER);
			this.setRoomTile(room, rx + rw, ry + rh, TILE_WALL_CORNER);
			const water = Math.random() < this.waterRatio ? 1 : 0;
			const pattern = Math.random() < this.pillarRatio ? choose(Patterns) : null;
			for (let xx = rx; xx < rx + rw; xx++) for (let yy = ry; yy < ry + rh; yy++) {
				const rt = this.getRoomTile(room, xx, yy);
				if (room.tiles[rt].type === TILE_FLOOR_CENTER) {
					let tile = 0;
					if (water) tile = TILE_WATER;
					if (pattern) tile = pattern.func(xx, yy, room) || tile;
					if (tile) this.setRoomTile(room, xx, yy, tile);
				}
			}
		},
		newRoom: function (x, y, w, h, parent) {
			return { id: this.rooms.length, w: w || rand(2, this.roomSize), h: h || rand(2, this.roomSize), x: x || rand(1, this.w - w - 1), y: y || rand(1, this.h - h - 1), tiles: [], freeTiles: 0, parent: parent ? parent : -1, children: [], gen: 0, door: 0, corridor: Math.random() < this.corridorRatio, hidden: this.roomsAreHidden };
		},
		planRoom: function (room) {
			const branches = this.branching + 1;
			const forcedExpansions: number[] = [];
			let w = room.w, h = room.h;
			while (w > 0 && h > 0) { if (w > 0) { forcedExpansions.push(1, 3); w--; } if (h > 0) { forcedExpansions.push(2, 4); h--; } }
			for (let i = 0; i < branches; i++) {
				const expansions: number[] = [];
				let steps = 0;
				if (!room.corridor) { expansions.push(1, 2, 3, 4); steps = this.roomSize; }
				else { expansions.push(...choose([[1, 3], [2, 4]])); steps = this.corridorSize; }
				steps = Math.max(room.w + room.h, Math.ceil(steps * (1 - Math.random() * this.sizeVariance)));
				let rx, ry, rw, rh;
				if (room.tiles.length === 0) { rx = room.x; ry = room.y; rw = 1; rh = 1; }
				else { const randomTile = this.getFloorTileInRoom(room); rx = randomTile.x; ry = randomTile.y; rw = 1; rh = 1; }
				for (let ii = 0; ii < steps; ii++) {
					if (expansions.length === 0) break;
					let xd = 0, yd = 0, wd = 0, hd = 0;
					let side = choose(expansions);
					if (forcedExpansions.length > 0) side = forcedExpansions[0];
					if (side === 1) { xd = -1; wd = 1; } else if (side === 2) { yd = -1; hd = 1; } else if (side === 3) { wd = 1; } else if (side === 4) { hd = 1; }
					if (this.canPlaceRoom(rx + xd, ry + yd, rw + wd, rh + hd)) { rx += xd; ry += yd; rw += wd; rh += hd; }
					else expansions.splice(expansions.indexOf(side), 1);
					if (forcedExpansions.length > 0) forcedExpansions.splice(0, 1);
				}
				if (rw > 1 || rh > 1) this.expandRoom(room, rx, ry, rw, rh);
			}
		},
		carve: function (room) {
			for (const t of room.tiles) {
				const x = t.x, y = t.y, type = t.type;
				if ((type === TILE_WALL || type === TILE_WALL_CORNER) && this.isWall(x, y) !== -1) this.freeWalls.splice(this.isWall(x, y), 1);
				if (this.data[x][y][1] !== -1 && (type === TILE_WALL || type === TILE_WALL_CORNER)) { }
				else {
					if (this.data[x][y][1] === -1) this.tilesDug++;
					this.data[x][y] = [t.type, room.id, 0];
					if (x > 1 && y > 1 && x < this.w - 2 && y < this.h - 2 && type === TILE_WALL) this.freeWalls.push([x, y]);
					if (type === TILE_FLOOR_EDGE || type === TILE_FLOOR_CENTER) this.freeTiles.push([x, y]);
				}
			}
			this.rooms[room.id] = room;
		},
		newRandomRoom: function (params) {
			params = params || {};
			const door = choose(this.freeWalls);
			if (!door) return 0;
			const parentRoom = this.getRoom(door[0], door[1]) as RoomData;
			const sides: [number, number][] = [];
			if (this.getType(door[0] - 1, door[1]) === TILE_EMPTY) sides.push([-1, 0]);
			if (this.getType(door[0] + 1, door[1]) === TILE_EMPTY) sides.push([1, 0]);
			if (this.getType(door[0], door[1] - 1) === TILE_EMPTY) sides.push([0, -1]);
			if (this.getType(door[0], door[1] + 1) === TILE_EMPTY) sides.push([0, 1]);
			const side = choose(sides);
			if (!side) { this.freeWalls.splice(this.isWall(door[0], door[1]), 1); return 0; }
			const room = this.newRoom(door[0] + side[0], door[1] + side[1], 0, 0, parentRoom);
			for (const k in params) (room as any)[k] = params[k];
			this.planRoom(room);
			if (room.tiles.length > 0 && room.freeTiles > 0) {
				this.carve(room);
				this.data[door[0]][door[1]][0] = TILE_DOOR;
				room.door = [door[0], door[1]];
				this.data[door[0]][door[1]][1] = room.id;
				this.freeWalls.splice(this.isWall(door[0], door[1]), 1);
				this.doors.push([door[0], door[1], room]);
				if (this.isFloor(door[0] + side[0], door[1] + side[1]) !== -1) this.removeFreeTile(door[0] + side[0], door[1] + side[1]);
				if (this.isFloor(door[0] - side[0], door[1] - side[1]) !== -1) this.removeFreeTile(door[0] - side[0], door[1] - side[1]);
				room.parent = parentRoom;
				parentRoom.children.push(room);
				room.gen = parentRoom.gen + 1;
				return room;
			} else { this.freeWalls.splice(this.isWall(door[0], door[1]), 1); return 0; }
		},
		getRandomSpotInRoom: function (room) { const list = []; for (const t of room.tiles) if ((t.type === TILE_FLOOR_EDGE || t.type === TILE_FLOOR_CENTER) && this.isFloor(t.x, t.y) !== -1) list.push(t); return list.length === 0 ? -1 : choose(list); },
		getBestSpotInRoom: function (room) { let highest = -1; const list = []; for (const t of room.tiles) { if ((t.type === TILE_FLOOR_EDGE || t.type === TILE_FLOOR_CENTER) && this.isFloor(t.x, t.y) !== -1) { if (t.score > highest) { list.length = 0; highest = t.score; list.push(t); } else if (t.score === highest) list.push(t); } } return list.length === 0 ? -1 : choose(list); },
		getEarliestRoom: function () { return this.rooms[0]; },
		getDeepestRoom: function () { let deepest = 0, deepestRoom = this.rooms[0]; for (const r of this.rooms) { const d = r.gen + Math.sqrt(r.freeTiles) * 0.05; if (d >= deepest && !r.corridor && r.freeTiles > 4) { deepest = d; deepestRoom = r; } } return deepestRoom; },
		dig: function () {
			let badDig = 0;
			if (this.digs === 0) {
				const w = rand(3, 7), h = rand(3, 7);
				const room = this.newRoom(Math.floor(this.w / 2 - w / 2), Math.floor(this.h / 2 - h / 2), w, h);
				room.corridor = false;
				this.planRoom(room); this.carve(room);
			} else { if (this.newRandomRoom() === 0) badDig++; }
			if (badDig > 0) this.stuck++;
			this.digs++;
			if (this.tilesDug >= this.tiles * this.fillRatio) return 1;
			if (this.stuck > 100) return 1;
			return badDig > 0 ? -1 : 0;
		},
		finish: function () {
			for (const room of this.rooms) {
				for (const t of room.tiles) {
					const x = t.x, y = t.y, me = this.data[x][y][0];
					const x1 = this.data[x - 1]?.[y]?.[0] ?? 0, x2 = this.data[x + 1]?.[y]?.[0] ?? 0;
					const y1 = this.data[x]?.[y - 1]?.[0] ?? 0, y2 = this.data[x]?.[y + 1]?.[0] ?? 0;
					const xy1 = this.data[x - 1]?.[y - 1]?.[0] ?? 0, xy2 = this.data[x + 1]?.[y - 1]?.[0] ?? 0;
					const xy3 = this.data[x - 1]?.[y + 1]?.[0] ?? 0, xy4 = this.data[x + 1]?.[y + 1]?.[0] ?? 0;
					let walls = 0, floors = 0;
					for (const v of [x1, y1, x2, y2, xy1, xy2, xy3, xy4]) { if (v === TILE_WALL || v === TILE_WALL_CORNER) walls++; if (v === TILE_FLOOR_CENTER || v === TILE_FLOOR_EDGE) floors++; }
					const complete = (walls + floors === 8) ? 1 : 0;
					let angle = 0;
					let top = 0, left = 0, right = 0, bottom = 0;
					if (complete) {
						const w = (v: number) => v === TILE_WALL || v === TILE_WALL_CORNER;
						const f = (v: number) => v === TILE_FLOOR_CENTER || v === TILE_FLOOR_EDGE;
						if (w(xy1) && w(y1) && w(xy2)) top = 1; else if (f(xy1) && f(y1) && f(xy2)) top = -1;
						if (w(xy2) && w(x2) && w(xy4)) right = 1; else if (f(xy2) && f(x2) && f(xy4)) right = -1;
						if (w(xy1) && w(x1) && w(xy3)) left = 1; else if (f(xy1) && f(x1) && f(xy3)) left = -1;
						if (w(xy3) && w(y2) && w(xy4)) bottom = 1; else if (f(xy3) && f(y2) && f(xy4)) bottom = -1;
						if ((top === 1 && bottom === -1) || (top === -1 && bottom === 1) || (left === 1 && right === -1) || (left === -1 && right === 1)) angle = 1;
					}
					if (Math.random() < this.pillarRatio && (angle === 1 || (complete && walls === 7)) && me === TILE_FLOOR_EDGE && x1 !== TILE_DOOR && x2 !== TILE_DOOR && y1 !== TILE_DOOR && y2 !== TILE_DOOR) {
						this.data[x][y][0] = TILE_PILLAR; this.removeFreeTile(x, y); room.freeTiles--;
					}
					if (top === 1 || bottom === 1 || left === 1 || right === 1) t.score += 2;
					if (walls > 5 || floors > 5) t.score += 1;
					if (walls === 7 || floors === 8) t.score += 5;
					if ((me !== TILE_FLOOR_CENTER && me !== TILE_FLOOR_EDGE) || x1 === TILE_DOOR || x2 === TILE_DOOR || y1 === TILE_DOOR || y2 === TILE_DOOR) t.score = -1;
				}
			}
			const entrance = this.getBestSpotInRoom(this.getEarliestRoom());
			if (entrance !== -1) { this.data[entrance.x][entrance.y][0] = TILE_ENTRANCE; this.entrance = [entrance.x, entrance.y]; this.removeFreeTile(entrance.x, entrance.y); }
			const exit = this.getBestSpotInRoom(this.getDeepestRoom());
			if (exit !== -1) { this.data[exit.x][exit.y][0] = TILE_EXIT; this.exit = [exit.x, exit.y]; this.removeFreeTile(exit.x, exit.y); }
		},
		isObstacle: function (x, y) { const free = [TILE_FLOOR_EDGE, TILE_FLOOR_CENTER, TILE_DOOR, TILE_ENTRANCE, TILE_EXIT]; for (const f of free) if (this.data[x]?.[y]?.[0] === f) return 0; return 1; },
		getPic: function (x, y) {
			const tileData = Tiles[this.data[x][y][2]];
			if (!tileData) return [0, 0];
			if (tileData.joinType === "join") {
				const joinWith: number[] = [];
				if (this.data[x][y][0] === TILE_WALL) joinWith.push(TILE_WALL_CORNER);
				else if (this.data[x][y][0] === TILE_DOOR) joinWith.push(TILE_WALL, TILE_WALL_CORNER);
				return [tileData.pic[0] + joinTile(this, x, y, joinWith) - 1, tileData.pic[1]];
			} else if (tileData.joinType === "random3") {
				return [tileData.pic[0] + Math.floor(Math.random() * 3), tileData.pic[1]];
			}
			return tileData.pic;
		},
		assignTiles: function (room, tiles) {
			for (const t of room.tiles) {
				let type = Tiles[0];
				const tile = this.data[t.x][t.y][0];
				const ct = (v: number, n: string) => { if (tile === v && tiles[n]) return TilesByName[tiles[n]]; return 0; };
				type = ct(tile, "wall corner") || type;
				type = ct(tile, "wall") || type;
				type = ct(tile, "floor edges") || type;
				type = ct(tile, "floor") || type;
				type = ct(tile, "pillar") || type;
				type = ct(tile, "door") || type;
				type = ct(tile, "water") || type;
				type = ct(tile, "entrance") || type;
				type = ct(tile, "exit") || type;
				this.data[t.x][t.y][2] = type ? type.id : 0;
			}
		},
		drawDetailed: function () {
			const size = 16; let str = "";
			for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
				const room = this.getRoom(x, y);
				let opacity = 1, title = "void";
				if (room !== -1) {
					opacity = Math.max(0.1, 1 - (room as RoomData).gen / 5);
					if (this.data[x][y][0] === TILE_ENTRANCE || this.data[x][y][0] === TILE_EXIT) opacity = 1;
					title = `${(room as RoomData).corridor ? "corridor" : "room"} ${(room as RoomData).id} | depth : ${(room as RoomData).gen} | children : ${(room as RoomData).children.length}`;
				}
				const pic = this.getPic(x, y);
				str += `<div style="opacity:${opacity};width:${size}px;height:${size}px;position:absolute;left:${x * size}px;top:${y * size}px;display:block;padding:0px;margin:0px;background:#000 url(img/dungeonTiles.webp) ${-pic[0] * 16}px ${-pic[1] * 16}px;color:#999;" title="${title}"></div>`;
			}
			return `<div style="box-shadow:0px 0px 12px 6px #00061b;position:relative;width:${this.w * size}px;height:${this.h * size}px;background:#00061b;font-family:Courier;font-size:${size}px;float:left;margin:10px;">${str}</div>`;
		},
		getStr: function () {
			const size = 16; let str = "";
			for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
				const room = this.getRoom(x, y);
				let pic = this.getPic(x, y);
				if (room !== -1 && (room as RoomData).hidden) pic = [0, 0];
				str += `<div style="opacity:1;width:${size}px;height:${size}px;position:absolute;left:${x * size}px;top:${y * size}px;display:block;padding:0px;margin:0px;background:#000 url(img/dungeonTiles.webp) ${-pic[0] * 16}px ${-pic[1] * 16}px;color:#999;"></div>`;
			}
			return str;
		},
		draw: function (size) {
			const s = size || 10; let str = "";
			for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
				const room = this.getRoom(x, y);
				const opacity = Math.max(0.1, 1 - (room !== -1 ? (room as RoomData).gen / 10 : 0));
				str += `<div style="opacity:${opacity};width:${s}px;height:${s}px;position:absolute;left:${x * s}px;top:${y * s}px;display:block;padding:0px;margin:0px;background:#000;color:#999;" title="${room !== -1 ? (room as RoomData).freeTiles : 0}"></div>`;
			}
			return `<div style="position:relative;width:${this.w * s}px;height:${this.h * s}px;background:#000;font-family:Courier;font-size:${s}px;float:left;margin:10px;">${str}</div>`;
		},
	};

	map.tiles = map.w * map.h;
	for (let x = 0; x < map.w; x++) {
		map.data[x] = [];
		for (let y = 0; y < map.h; y++) {
			map.data[x][y] = [TILE_EMPTY, -1, 0];
			if (x === 0 || y === 0 || x === map.w - 1 || y === map.h - 1) map.data[x][y] = [TILE_LIMIT, -1, 0];
		}
	}
	map.fillRatio = 0.1 + Math.random() * 0.4;
	map.roomSize = Math.ceil(rand(5, 15) * map.fillRatio * 2);
	map.corridorSize = Math.ceil(rand(1, 7) * map.fillRatio * 2);
	map.corridorRatio = Math.random() * 0.8 + 0.1;
	map.pillarRatio = Math.random() * 0.5 + 0.5;
	map.waterRatio = Math.pow(Math.random(), 2);
	map.branching = Math.floor(Math.random() * 6);
	map.sizeVariance = Math.random();
	if (params) for (const k in params) (map as any)[k] = params[k];
	return map;
}

/* ====================================================================== *
 *  TYPES                                                                  *
 * ====================================================================== */

interface DungeonStats {
	hp: number; hpm: number; might: number; guard: number; speed: number; dodge: number; luck: number;
}

interface MonsterDef {
	name: string; pic: string; icon: [number, number]; level: number;
	stats: DungeonStats & { rarity: number };
	loot: Record<string, { min?: number; max?: number; prob?: number }>;
	boss: number; AI: string; quotes: Record<string, string>; onKill: (() => void) | null;
}

interface Entity {
	type: string; subtype: string; dungeon: any; pic: [number, number];
	stats: DungeonStats; x: number; y: number; obstacle: number; zIndex: number;
	fighting: number; stuck: number; AI: string; value: number | string; life: number;
	targets: [number, number][];
	onKill: (() => void) | null;
	Say: (what: string) => void; Draw: () => string;
	Wander: () => void; GoTo: (x: number, y: number) => void; Flee: (x: number, y: number) => void;
	Move: () => number; HitBy: (by: Entity) => void; Turn: () => void; Destroy: () => void; GetInitiative: () => number;
}

interface HeroRuntime {
	id: number; name: string; pic: string; portrait: string; icon: [number, number];
	stats: DungeonStats; dialogue: Record<string, string>; gear: { armor: number; weapon: number };
	inDungeon: number; completedDungeons: number; x: number; y: number;
	EnterDungeon: (dungeon: any, x: number, y: number) => void;
	Move: (x: number, y: number) => void;
	Say: (what: string) => void;
	save: () => string; load: (data: string) => void;
}

/* ====================================================================== *
 *  MONSTERS                                                               *
 * ====================================================================== */

const Monsters: Record<string, MonsterDef> = {};
const BossMonsters: MonsterDef[] = [];

function defineMonster(name: string, pic: string, icon: [number, number], level: number, stats: Record<string, number>, loot: Record<string, any>): MonsterDef {
	const m: MonsterDef = {
		name, pic, icon, level,
		stats: { hp: stats.hp, hpm: stats.hp, might: stats.might, guard: stats.guard, speed: stats.speed, dodge: stats.dodge, luck: 0, rarity: stats.rarity || 1 },
		loot: loot || {}, boss: 0, AI: "normal", quotes: {}, onKill: null,
	};
	Monsters[name] = m;
	return m;
}

// CC3 (Tier 2): the deepest a single delve can progress. Beyond this the floor
// keeps generating at peak difficulty and relic payouts plateau, so the loop
// stays winnable and the save never stores a runaway level number.
const DUNGEON_MAX_LEVEL = 100;

const basicLoot = { cookies: { min: 1, max: 5, prob: 0.5 } };
const goodLoot = { cookies: { min: 3, max: 8, prob: 1 }, gear: { prob: 0.05 } };
const bossLoot = { cookies: { min: 10, max: 50, prob: 1 }, gear: { prob: 0.2 } };

defineMonster("Doughling", "doughling", [0, 0], 1, { hp: 5, might: 2, guard: 2, speed: 6, dodge: 6, rarity: 0.7 }, basicLoot);
defineMonster("Elder doughling", "elderDoughling", [1, 0], 7, { hp: 20, might: 7, guard: 7, speed: 4, dodge: 4, rarity: 0.7 }, goodLoot);
defineMonster("Angry sentient cookie", "angrySentientCookie", [5, 0], 5, { hp: 16, might: 8, guard: 4, speed: 5, dodge: 5, rarity: 1 }, basicLoot);
defineMonster("Baby sentient cookie", "babySentientCookie", [4, 0], 1, { hp: 3, might: 1, guard: 1, speed: 7, dodge: 7, rarity: 1 }, basicLoot);
defineMonster("Burnt sentient cookie", "burntSentientCookie", [6, 0], 5, { hp: 16, might: 12, guard: 2, speed: 3, dodge: 2, rarity: 0.2 }, basicLoot);
defineMonster("Raw sentient cookie", "rawSentientCookie", [5, 0], 5, { hp: 16, might: 6, guard: 4, speed: 7, dodge: 7, rarity: 0.2 }, basicLoot);
const sugarBunny = defineMonster("Sugar bunny", "sugarBunny", [8, 0], 5, { hp: 10, might: 3, guard: 8, speed: 12, dodge: 9, rarity: 0.001 }, { cookies: { min: 1000, max: 10000 } });
sugarBunny.onKill = () => { g.Win("Follow the white rabbit"); };
sugarBunny.AI = "flee";

defineMonster("Crazed kneader", "crazedKneader", [0, 2], 6, { hp: 18, might: 6, guard: 8, speed: 3, dodge: 2, rarity: 0.5 }, goodLoot);
defineMonster("Crazed chip-spurter", "crazedDoughSpurter", [0, 2], 6, { hp: 15, might: 6, guard: 8, speed: 5, dodge: 3, rarity: 0.5 }, goodLoot);
defineMonster("Alarm bot", "alarmTurret", [3, 2], 2, { hp: 6, might: 3, guard: 5, speed: 8, dodge: 8, rarity: 0.5 }, basicLoot);
const chirpy = defineMonster("Chirpy", "chirpy", [4, 2], 3, { hp: 7, might: 4, guard: 6, speed: 9, dodge: 9, rarity: 0.01 }, { cookies: { min: 500, max: 5000 } });
chirpy.onKill = () => { g.Win("Chirped out"); };
chirpy.quotes = { fight: "oh, hello <3" };
defineMonster("Disgruntled worker", "disgruntledWorker", [1, 2], 4, { hp: 14, might: 5, guard: 5, speed: 6, dodge: 4, rarity: 0.6 }, basicLoot);
defineMonster("Disgruntled overseer", "disgruntledOverseer", [1, 2], 7, { hp: 22, might: 7, guard: 5, speed: 6, dodge: 4, rarity: 0.5 }, basicLoot);
defineMonster("Disgruntled cleaning lady", "disgruntledCleaningLady", [2, 2], 4, { hp: 13, might: 4, guard: 5, speed: 7, dodge: 6, rarity: 0.3 }, basicLoot);
const sf = defineMonster("Sentient Furnace", "sentientFurnace", [0, 3], 0, { hp: 60, might: 14, guard: 12, speed: 4, dodge: 0, rarity: 1 }, bossLoot);
sf.onKill = () => { g.Win("Getting even with the oven"); };
sf.AI = "static"; sf.boss = 1;
sf.quotes = { fight: "YOU ARE NOT READY!", defeat: "OH... BURN." };
const abp = defineMonster("Ascended Baking Pod", "ascendedBakingPod", [1, 3], 0, { hp: 60, might: 12, guard: 14, speed: 4, dodge: 0, rarity: 0.7 }, bossLoot);
abp.onKill = () => { g.Win("Now this is pod-smashing"); };
abp.AI = "static"; abp.boss = 1;
abp.quotes = { fight: "rrrrrrrise.", defeat: "blrglblg." };
for (const k in Monsters) if (Monsters[k].boss) BossMonsters.push(Monsters[k]);

/* ====================================================================== *
 *  ENTITY SYSTEM                                                          *
 * ====================================================================== */

const monsterIconY = 10;

function createEntity(type: string, subtype: string, dungeon: any, value?: any): Entity {
	const baseStats: DungeonStats = { hp: 5, hpm: 5, might: 3, guard: 3, speed: 5, dodge: 5, luck: 5 };
	const e: any = {
		type, subtype, dungeon,
		pic: [0, 0], stats: { ...baseStats }, x: -1, y: -1, obstacle: 0, zIndex: 1,
		fighting: 0, stuck: 0, AI: "normal", value: 0, life: 3, onKill: null, targets: [],
	};
	e.Say = function (what: string) {
		if (this.type === "monster") { const m = Monsters[this.subtype]; if (m && m.quotes[what]) this.dungeon.Log(`${this.subtype} : "<span style="color:#f96;">${choose(m.quotes[what].split("|"))}</span>"`); }
	};
	e.Draw = function () {
		if (this.type === "item" && this.subtype === "cookies" && typeof this.value === "number" && this.value > 0) {
			if (this.value < 2) this.pic = [0, 5]; else if (this.value < 4) this.pic = [2, 5]; else if (this.value < 6) this.pic = [3, 5]; else if (this.value < 10) this.pic = [4, 5]; else if (this.value < 20) this.pic = [5, 5]; else if (this.value < 30) this.pic = [7, 5]; else if (this.value < 70) this.pic = [6, 5]; else if (this.value < 200) this.pic = [8, 5]; else this.pic = [6, 6];
		}
		return `<div class="thing" title="${this.subtype}" style="z-index:${200 + this.zIndex};left:${this.x * 16}px;top:${this.y * 16}px;background-position:${-this.pic[0] * 16}px ${-this.pic[1] * 16}px;"></div>`;
	};
	e.Wander = function () { this.targets = [[-1, 0], [1, 0], [0, -1], [0, 1]]; (this as any).Move(); };
	e.GoTo = function (x: number, y: number) {
		this.targets = [];
		if (this.x < x) this.targets.push([1, 0]); if (this.x > x) this.targets.push([-1, 0]);
		if (this.y < y) this.targets.push([0, 1]); if (this.y > y) this.targets.push([0, -1]);
		if (!(this as any).Move()) { this.targets = []; if (this.x === x) this.targets.push([1, 0], [-1, 0]); if (this.y === y) this.targets.push([0, 1], [0, -1]); (this as any).Move(); }
	};
	e.Flee = function (x: number, y: number) {
		this.targets = [];
		if (this.x > x) this.targets.push([1, 0]); if (this.x < x) this.targets.push([-1, 0]);
		if (this.y > y) this.targets.push([0, 1]); if (this.y < y) this.targets.push([0, -1]);
		if (!(this as any).Move()) { this.targets = []; if (this.x === x) this.targets.push([1, 0], [-1, 0]); if (this.y === y) this.targets.push([0, 1], [0, -1]); (this as any).Move(); }
	};
	e.Move = function () {
		if (this.targets.length > 0) {
			const goodTargets: [number, number][] = [];
			for (const t of this.targets) {
				const chk = this.dungeon.map.isObstacle(this.x + t[0], this.y + t[1]);
				if (this.type === "hero" || chk === 0) goodTargets.push([t[0], t[1]]);
			}
			if (goodTargets.length > 0) {
				const target = choose(goodTargets);
				const obstacle = this.dungeon.CheckObstacle(this.x + target[0], this.y + target[1]);
				if (obstacle === 0 && this.AI !== "static") { this.x += target[0]; this.y += target[1]; }
				else this.stuck += 2;
				if (obstacle !== 0 && obstacle !== -1) (obstacle as Entity).HitBy(this as Entity);
				if (obstacle === -1) return 0;
			} else { this.stuck += 2; return 0; }
			if (this.AI === "static") this.stuck = 0;
			return 1;
		}
		return 0;
	};
	e.HitBy = function (by: Entity) {
		if (this.type === "destructible" && by.type === "hero") {
			by.stuck = 0; this.life--;
			if (this.life <= 0) { if (this.onKill) this.onKill(); this.Destroy(); }
			else this.pic = [this.pic[0], this.pic[1] + 1];
		} else if (this.type === "special" && this.subtype === "upgrade") {
			// CC3 (Tier 2): a scavenged dungeon schematic grants a free stack of the
			// named relic upgrade (wired through the minigame so it feeds Factory CpS
			// exactly like a relic purchase). Consumed on pickup.
			this.obstacle = 0;
			const mg = g.Objects[this.dungeon.type].minigame as any;
			if (mg && mg.grantUpgrade && mg.grantUpgrade(this.value)) {
				this.dungeon.Log(`<span style="color:#ffd;">Found a dungeon schematic: <b>${this.value}</b>!</span>`);
				PlaySound('snd/chime.mp3', 0.7); // CC3 (Tier 3): schematic-found chime
			}
			this.Destroy();
		} else if ((this.type === "monster" && by.type === "hero") || (this.type === "hero" && by.type === "monster")) {
			if (this.stats.hp <= 0) return;
			by.stuck = 0;
			const monster = this.type === "hero" ? by : this;
			this.dungeon.currentOpponent = monster;
			if (monster.fighting === 0) { (this as any).Say("fight"); }
			if (this.fighting === 0) { this.fighting = 1; by.fighting = 1; }
			const attackerName = by.type === "hero" ? by.subtype : (Monsters[by.subtype]?.name || by.subtype);
			const defenderName = this.type === "hero" ? this.subtype : (Monsters[this.subtype]?.name || this.subtype);
			let attackStr = `${attackerName} swings at ${defenderName}!`;
			const damage = Math.round(Math.max(1, Math.min(by.stats.might, Math.pow(((by.stats.might + 2.5) / Math.max(1, this.stats.guard)), 2))) * (0.8 + Math.random() * 0.4 + Math.pow(Math.random() * 0.8, 6)));
			const dodge = Math.random() > (by.stats.speed / Math.max(1, this.stats.dodge + 2.5));
			if (dodge) attackStr += ` ${defenderName} dodged the attack.`;
			else {
				if (by.type === "hero") playDungeonSfx('snd/thud.mp3', 0.35); // hero strikes
				else playDungeonSfx('snd/snarl.mp3', 0.4); // monster strikes the hero
				if (by.stats.luck && by.type === "hero" && Math.random() < by.stats.luck * 0.01) { this.stats.hp -= damage * 2; attackStr += ` <b>It's a critical!</b> <b>${damage * 2}</b> damage!`; }
				else { this.stats.hp -= damage; this.stats.hp = Math.max(this.stats.hp, 0); attackStr += ` <b>${damage}</b> damage!`; }
			}
			this.dungeon.Log(attackStr);
			if (this.stats.hp <= 0) {
				this.dungeon.Log(`${attackerName} crushed ${defenderName}!`);
				if (this.type === "hero") {
					this.dungeon.Log(`<span style="color:#f66;">${defenderName} has been defeated.</span>`);
					this.dungeon.FailLevel();
				}
				if (this.type === "monster" && by.type === "hero") {
					this.dungeon.monstersKilledThisRun++;
					playDungeonSfx('snd/squish1.mp3', 0.5); // monster defeated
					const m = Monsters[this.subtype];
					if (m && m.loot && m.loot.cookies && (!m.loot.cookies.prob || Math.random() < m.loot.cookies.prob)) {
						const entity = this.dungeon.AddEntity("item", "cookies", this.x, this.y);
						entity.value = Math.round((m.loot.cookies.min ?? 1) + Math.random() * ((m.loot.cookies.max ?? 1) - (m.loot.cookies.min ?? 1)));
					}
					if (this.onKill) this.onKill();
					this.Destroy();
				}
			}
		}
	};
	e.Turn = function () {
		if (this.type === "monster") {
			const howManyTurns = Math.max(1, Math.floor((this.stats.speed / 5) * (1 / Math.max(1, (this.dungeon.heroEntity?.stats.speed ?? 5) / 5))));
			for (let i = 0; i < howManyTurns; i++) {
				if (this.AI === "flee") { if (this.dungeon.heroEntity) (this as any).Flee(this.dungeon.heroEntity.x, this.dungeon.heroEntity.y); }
				else { if (this.dungeon.heroEntity) { (this as any).GoTo(this.dungeon.heroEntity.x, this.dungeon.heroEntity.y); if (this.stuck || this.targets.length === 0) (this as any).Wander(); } }
			}
		}
		if (this.type === "monster" || this.type === "hero") { if (this.stuck > 0) this.stuck--; this.stuck = Math.min(10, this.stuck); this.targets = []; }
		if ((this.type === "hero" || this.type === "monster") && this.fighting === 0 && this.stats.hp < this.stats.hpm) this.stats.hp++;
		if (this.type === "hero") {
			const entities = this.dungeon.GetEntities(this.x, this.y);
			for (const ent of entities) {
				if (ent.type === "item" && ent.subtype === "cookies" && typeof ent.value === "number") {
					// CC3 (Tier 1): scale cookie finds to the Factory's actual CpS
					// rather than its building count, so a stronger factory yields
					// proportionally more cookies per pickup. Falls back to the old
					// count*50 formula before the first gain recalculation.
					const rawCps = g.Objects[this.dungeon.type].storedCps;
					const cps = (typeof rawCps === "number" ? rawCps : 0) || g.Objects[this.dungeon.type].amount * 50;
					const value = Math.ceil(ent.value * Math.max(1, cps) * (1 + Math.random() * (this.stats.luck / 20)));
					if (value > 0) { this.dungeon.Log(`<span style="color:#9f9;">Found <b>${Beautify(value)}</b> cookie${value === 1 ? "" : "s"}!</span>`); this.dungeon.cookiesMadeThisRun += value; g.Earn(value); }
					ent.Destroy();
				}
			}
		}
		if (this.type === "hero") this.fighting = 0;
	};
	e.Destroy = function () { const idx = this.dungeon.entities.indexOf(this); if (idx !== -1) this.dungeon.entities.splice(idx, 1); };
	e.GetInitiative = function () { return 1; };

	if (type === "monster") {
		e.obstacle = 1; const m = Monsters[subtype];
		if (m) { e.pic = [m.icon[0], m.icon[1] + monsterIconY]; e.AI = m.AI; e.onKill = m.onKill; for (const k in m.stats) (e.stats as any)[k] = (m.stats as any)[k]; }
		// CC3 (Tier 2): scale monster stats with dungeon depth (capped) so the
		// climb stays a challenge instead of trivial once the Factory is large.
		const lvlScale = 1 + Math.min(dungeon.level, DUNGEON_MAX_LEVEL) * 0.03;
		e.stats.hp = Math.round(e.stats.hp * lvlScale); e.stats.hpm = e.stats.hp;
		e.stats.might = Math.round(e.stats.might * lvlScale);
		e.stats.guard = Math.round(e.stats.guard * lvlScale);
		e.zIndex = 10; e.fighting = 0;
	} else if (type === "hero") {
		e.obstacle = 1;
		for (const k in DungeonHeroes[0].stats) (e.stats as any)[k] = (DungeonHeroes[0].stats as any)[k];
		e.zIndex = 100; e.fighting = 0;
		const mult = Math.max(0, (g.Objects[dungeon.type].amount / 20 - 1));
		e.stats.hpm += Math.ceil(mult * 2); e.stats.hp = e.stats.hpm; e.stats.might += mult; e.stats.guard += mult; e.stats.speed += mult; e.stats.dodge += mult;
	} else if (type === "destructible") {
		e.zIndex = 15; e.life = 3; e.pic = subtype === "door" ? [0, 7] : [Math.floor(Math.random() * 4 + 2), 7];
		e.onKill = function () { if (this.subtype === "random") { const value = Math.round(Math.pow(Math.random(), 6) * (10 + this.dungeon.level)); if (value > 0) { const entity = this.dungeon.AddEntity("item", "cookies", this.x, this.y); entity.value = value; } } };
	} else if (type === "special") { e.zIndex = 5; e.value = value || ""; e.obstacle = 1; }
	return e as Entity;
}

/* ====================================================================== *
 *  HEROES                                                                 *
 * ====================================================================== */

const DungeonHeroes: HeroRuntime[] = [];

function defineHero(name: string, pic: string, portrait: string, icon: [number, number]): HeroRuntime {
	const hr: HeroRuntime = {
		id: DungeonHeroes.length, name, pic, portrait, icon,
		stats: { hp: 25, hpm: 25, might: 5, guard: 5, speed: 5, dodge: 5, luck: 5 },
		dialogue: { greeting: "Oh hey.|Sup.", entrance: "Here we go.|So exciting.", completion: "That was easy.|All done here.", defeat: "Welp.|Better luck next time." },
		gear: { armor: -1, weapon: -1 }, inDungeon: -1, completedDungeons: 0, x: 0, y: 0,
		EnterDungeon: function (dungeon, x, y) {
			this.inDungeon = dungeon.id; dungeon.hero = this as any; this.x = x; this.y = y;
			const room = dungeon.map.getRoom(x, y);
			if (room !== -1 && (room as any).hidden) { (room as any).hidden = false; dungeon.RedrawMap(); }
			dungeon.heroEntity = dungeon.AddEntity("hero", this.name, x, y);
			dungeon.Refresh();
			dungeon.Log("--------------------");
			if (dungeon.level === 0) this.Say("greeting");
			this.Say("entrance");
		},
		Move: function (x, y) {
			const dungeon = (window as any).DungeonList?.[this.inDungeon];
			if (!dungeon || !dungeon.heroEntity) return;
			dungeon.heroEntity.targets = [[x, y] as [number, number]];
			if (dungeon.heroEntity.Move()) { this.x = dungeon.heroEntity.x; this.y = dungeon.heroEntity.y; dungeon.Turn(); }
		},
		Say: function (what) {
			const dungeon = (window as any).DungeonList?.[this.inDungeon];
			if (!dungeon) return;
			if (this.dialogue[what]) dungeon.Log(`${this.name} : "<span style="color:#99f;">${choose(this.dialogue[what].split("|"))}</span>"`);
		},
		save: function () { return `${this.inDungeon},${this.completedDungeons},${this.gear.armor},${this.gear.weapon}`; },
		load: function (data) { const p = data.split(","); this.inDungeon = parseInt(p[0]); this.completedDungeons = parseInt(p[1]); this.gear.armor = parseInt(p[2]); this.gear.weapon = parseInt(p[3]); },
	};
	DungeonHeroes.push(hr);
	return hr;
}

defineHero("Chip", "girlscoutChip", "portraitChip", [1, 0]);
DungeonHeroes[0].dialogue = {
	intro: "I'm Chip! I just really like exploring stuff. Let's go have an adventure!",
	greeting: "Hello there!|I'm ready!|Where are we going today?|Adventure!",
	win: "Take that!|Hah!|That's right.",
	entrance: "Chipping in!|Welp, here goes nothing!|I wonder what I'll find!|Hey, this place is new!|This place seems familiar.|Let's make it happen.",
	completion: "I'm one smart cookie.|Oh yeah!|Let's explore some more!|That was easy!|That sure was fun!|I'm not lost, am I?|More exploring? Sure, why not!",
	defeat: "B-better luck next time.|That really hurt!|I yield! I yield!|That went badly.|No half-baked excuses next time.|I think I scraped my knee!|Owie.|Woopsie!",
	"win against Sentient Furnace": "The irony, it burns! (...it's funny because it was burning. And made of iron. ...Moving on.)",
	"win against Ascended Baking Pod": "Where is your pod now?|That was disturbing.",
};
DungeonHeroes[0].stats = { hp: 30, hpm: 30, might: 5, guard: 5, speed: 5, dodge: 5, luck: 5 };

defineHero("Crumb", "girlscoutCrumb", "portraitCrumb", [2, 0]);
DungeonHeroes[1].dialogue = {
	intro: "I'm Crumb. I look like this because of a baking accident when I was little. Big deal. At least now I don't get hurt as easily as others, I guess.",
	greeting: "Hi there.|Ready for adventure, I guess.|Reporting for duty.",
	win: "Oh sorry, did that hurt?|Should have moved out of the way.|Oops. My bad.",
	entrance: "Let's do this, I guess.|Well, let's go...|I gotta go in there?|Are we really doing this?|I hope I won't get lost like last time.|Let's get this over with.",
	completion: "I... I did it...|I'm glad that's over.|What, there's more?|In I go, I guess.|It doesn't end, does it?|But it's dark in there.",
	defeat: "I, uh, ouch.|Why does that always happen to me?|I'm just no good, am I?|Oh no.|I'm... I'm not crying.|Well that wasn't fun at all.|I'm sorry I failed you.|Please... make them go away...",
	"meet Ascended Baking Pod": "That thing shouldn't even be alive.|Is that where they all came from?",
	"win against Ascended Baking Pod": "Hm. Fascinating.",
};
DungeonHeroes[1].stats = { hp: 25, hpm: 25, might: 5, guard: 7, speed: 4, dodge: 4, luck: 5 };

defineHero("Doe", "girlscoutDoe", "portraitDoe", [3, 0]);
DungeonHeroes[2].dialogue = {
	intro: "H-hey. Name's Doe. I'm pretty fast. I uh, I promise I'll do my best.",
	greeting: "H-hey.|Oh, uh, h-hi there.|C-can I join?",
	win: "Th-that looks like it hurt... awesome...|D-did I do that?|N-neat... there's pieces everywhere.",
	entrance: "Alright, let's do this!|I-if I really have to.|I-in there? By myself?|...won't you come with me this time?|H-here I go!",
	completion: "Oh... oh my.|That's... I uh, I'm glad.|Y-yeah that was real easy. Piece of pie!|T-too easy, right?|S-so many cookies...|Ooh? F-fascinating.",
	defeat: "I-if you can't beat them... join them.|I-it's because I stutter, isn't it?|W-well that's just no good at all.|I, uh, I meant for that to happen.|H-how embarrassing.",
	"meet Ascended Baking Pod": "W-whoah... it's... magnificent...",
	"win against Ascended Baking Pod": "I'm sorry, buddy.|I... I think I hurt it...|Oh no... I-I think I broke it...",
};
DungeonHeroes[2].stats = { hp: 25, hpm: 25, might: 4, guard: 4, speed: 7, dodge: 5, luck: 5 };

defineHero("Lucky", "girlscoutLucky", "portraitLucky", [4, 0]);
DungeonHeroes[3].dialogue = {
	intro: "Oh joy! My name's Lucky. Guess what I'm good at?",
	greeting: "I'm feeling lucky!|It's a bright day today!|Let's do great things together.",
	win: "Ooh lucky shot!|Pow! One more.|Damn straight!",
	entrance: "Glad to be of service!|Oooh this one'll be interesting.|This will be a good one, I can feel it!|Here I come!",
	completion: "Over already?|Let's explore some more!|That was lucky!|That was no luck, I'm just that good.|Alright, let's move on!|I'm just getting warmed up!",
	defeat: "I can't believe it!|...This is a joke, right?|Hey! No fair!|B-but...|I'm gonna need a bandaid. And some hot chocolate.|I'll, uh, try again later.|Bad luck! Bad luck!",
	"win against Ascended Baking Pod": "Golly, that was peculiar.",
};
DungeonHeroes[3].stats = { hp: 25, hpm: 25, might: 5, guard: 4, speed: 4, dodge: 5, luck: 7 };

/* ====================================================================== *
 *  DUNGEON CORE                                                          *
 * ====================================================================== */

function generateDungeonName(type: string): string {
	if (type === "Factory") return `${getWord(choose(["secret", "ruined", "magical"]))} ${choose(["factory", "factories", "bakery", "bakeries", "confectionery", "laboratory", "research center", "chocolate forge", "chocolate foundry", "manufactory", "warehouse", "machinery", "works", "bakeworks", "workshop", "assembly line"])}`;
	if (type === "Mine") return `${getWord(choose(["secret", "ruined", "magical"]))} ${choose(["chocolate", "chocolate", "chocolate", "white chocolate", "sugar", "cacao"])} ${choose(["mine", "mines", "pit", "pits", "quarry", "excavation", "tunnel", "shaft", "lode", "trench", "mountain", "vein", "cliff", "peak", "dome", "crater", "abyss", "chasm", "hole", "burrow"])}`;
	if (type === "Portal") return `${getWord(choose(["secret", "ruined", "magical"]))} ${choose(["portal", "gate", "dimension", "warpgate", "door"])}`;
	return "Mysterious dungeon";
}

function dungeonLocationChain(map: DungeonGenMap, x: number, y: number): any[] {
	const room = map.getRoom(x, y);
	const chain: any[] = [];
	if (room !== -1) { let r = room as RoomData; while (r.parent && r.parent !== -1) { chain.push(r); r = r.parent as RoomData; } }
	chain.reverse(); return chain;
}

function dungeonLinkLocationChains(start: any[], end: any[]): any {
	start = [...start].reverse(); end = [...end].reverse();
	if (start[0]?.id === end[0]?.id) return start[start.length - 1];
	for (const e of end) { if (start[0] === e.parent) return e; }
	if (start.length > 1) return start[1];
	return start[0];
}

/* ====================================================================== *
 *  MINIGAME CONTRACT                                                     *
 * ====================================================================== */

interface DungeonMinigame {
	/* --- engine contract (building.minigame.*) --- */
	name: string | 0;
	parent: Building;
	launch: () => void;
	init: (div: HTMLElement) => void;
	save: () => string;
	load: (str: string) => boolean | undefined;
	/* the engine calls reset(true) on a hard reset, bare otherwise */
	reset: (hard?: boolean) => void;
	logic: () => void;
	draw: () => void;
	onResize: () => void;
	/* --- Dungeon reward economy (Tier 1) --- */
	/* Relics: the run resource salvaged from cleared dungeons; spent in the
	 * in-dungeon shop on repeatable upgrades (parallel to Cat Colony treats /
	 * Sitting Room yarn). Never a cookie cost. */
	relics: number;
	relicsEarnedTotal: number;
	/* Ordered to match the .dungeonAdd/.dungeonMult declarations in
	 * content/upgrades.ts; price lives on the real Game.Upgrade (.relicsPrice). */
	upgradeNames: string[];
	/* parallel to upgradeNames: stacks bought per dungeon upgrade */
	upgradeStacks: number[];
	/* effective stack count for CpS/purchase lookups + lazy migration of
	 * pre-stacking saves (see minigameCatColony.ts for the same pattern). */
	effectiveStacks: (name: string) => number;
	buyUpgrade: (name: string) => boolean;
	grantUpgrade: (name: string) => boolean;
	refresh: () => void;
	/* Lifetime bests (Tier 3) — persisted in the minigame save so the info
	 * panel's "best" readouts survive reloads/ascensions. */
	bestDepth: number;
	bestCookies: number;
	bestMonsters: number;
}

const M = {} as DungeonMinigame;
M.parent = null as unknown as Building;
M.name = "Dungeon" as string | 0;

M.launch = function (this: DungeonMinigame) {
		g = (window as any).Game as EngineGame;
		const parent = this.parent;
		const self = this;
		if (!g) return;

		// --- Dungeon reward economy (Tier 1) ---
		// Initialize the relic shop state on the minigame. These persist across
		// runs (saved in M.save / M.load) and feed Factory dungeonAdd/dungeonMult.
		self.relics = 0;
		self.relicsEarnedTotal = 0;
		// Ordered to match the .dungeonAdd/.dungeonMult declarations in
		// content/upgrades.ts; prices live on the real Game.Upgrade (.relicsPrice).
		self.upgradeNames = ['Reinforced plating','Conveyor optimization','Assembly-line doctrine','Quality assurance','Overtime shifts','Dungeon core reactor'];
		self.upgradeStacks = [0,0,0,0,0,0];
		// Lifetime bests (Tier 3), persisted across reloads/ascensions.
		self.bestDepth = 0;
		self.bestCookies = 0;
		self.bestMonsters = 0;
		// Effective stack count for CpS/purchase lookups, plus the lazy migration
		// of pre-stacking saves (only know about an upgrade via its main-save
		// bought flag; M.load can run BEFORE that flag is restored, so a
		// one-time-bought upgrade with 0 stacks self-migrates to 1 the first time
		// anything asks — after that the stacks array and the flag agree).
		self.effectiveStacks = function (name: string) {
			var i = self.upgradeNames.indexOf(name);
			var n = i >= 0 ? (self.upgradeStacks[i] || 0) : 0;
			var up = g.Upgrades[name];
			if (up && up.bought && n < 1) { n = 1; if (i >= 0) self.upgradeStacks[i] = 1; }
			return n;
		};
		self.buyUpgrade = function (name: string) {
			var up = g.Upgrades[name];
			var i = self.upgradeNames.indexOf(name);
			if (!up || i < 0) return false;
			var price = up.relicsPrice || 0;
			if (self.relics < price) return false;
			self.relics -= price;
			var n = self.effectiveStacks(name);
			if (n < 1) up.earn(); // first-ever stack → mark in the main save
			self.upgradeStacks[i] = n + 1;
			g.recalculateGains = 1;
			PlaySound('snd/buy2.mp3', 0.7); // CC3 (Tier 3): relic-purchase blip
			self.refresh();
			return true;
		};
		// CC3 (Tier 2): grant a dungeon-upgrade stack for free (used by scavenged
		// schematics). Mirrors buyUpgrade's stack bookkeeping but skips the relic cost.
		self.grantUpgrade = function (name: string) {
			var i = self.upgradeNames.indexOf(name);
			if (i < 0) return false;
			var up = g.Upgrades[name];
			var n = self.effectiveStacks(name);
			if (n < 1 && up) up.earn(); // first-ever stack → mark in the main save
			self.upgradeStacks[i] = n + 1;
			g.recalculateGains = 1;
			self.refresh();
			return true;
		};
		self.refresh = function () {
			var d = (self.parent as any).dungeon;
			if (d) d.Draw();
		};

		// Inject CSS once
		if (!document.getElementById("dungeonStyle")) {
			const style = document.createElement("style");
			style.id = "dungeonStyle";
			style.textContent = `
#dungeonLog .new{color:#ff0;}
.dungeonLog{font-size:11px;width:${9 * 16}px;height:72px;overflow-y:scroll;position:absolute;bottom:0px;left:0px;background:rgba(0,0,0,0.5);}
.dungeonLog div{width:100%;}
.map{overflow:hidden;position:absolute;left:0px;top:0px;border:2px solid #000;background:#000;margin:0px;}
.mapContainer{position:absolute;}
.mobSlot{width:64px;height:96px;position:absolute;top:24px;}
.mobPic{width:48px;height:48px;background:url(img/dungeonFoes.webp);position:absolute;top:0px;left:8px;}
.mobName{position:absolute;top:52px;text-align:center;width:100%;}
.hpmBar{width:48px;height:4px;border:1px solid #666;position:absolute;top:72px;left:8px;background:#000;}
.hpBar{height:100%;background:#0f0;}
#hpMonster{background:#f00;}
.dungeonName{font-size:11px;text-align:center;white-space:nowrap;margin:8px 0px;}
.control{width:48px;height:48px;display:block;background:url(img/dungeonPictos.webp);background-size:144px 144px;cursor:pointer;position:absolute;}
.control.west{background-position:0px 0px;top:0px;left:0px;}
.control.east{background-position:-48px 0px;top:0px;left:0px;}
.control.north{background-position:0px -48px;top:0px;left:0px;}
.control.south{background-position:-48px -48px;top:0px;left:0px;}
.control.middle{background-position:-96px 0px;top:0px;left:0px;}
.thing{width:16px;height:16px;position:absolute;background:url(img/dungeonItems.webp);}
.dungeonCard{position:absolute;width:144px;background:#15101f;border:1px solid #5a4a2a;border-color:#dfbc9a #875526 #a44e36 #dfbc9a;border-radius:4px;box-shadow:0px 0px 1px 2px rgba(0,0,0,0.5),0px 2px 4px rgba(0,0,0,0.4),0px 0px 2px 2px rgba(0,0,0,0.5) inset;padding:6px 8px;font-size:11px;color:#ddd;line-height:1.35;}
.dungeonInfoCard{left:304px;top:128px;}
.dungeonShopCard{left:304px;top:208px;}
.dungeonCardTitle{font-weight:bold;color:#ffd9a0;font-size:10px;letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #5a4a2a;padding-bottom:3px;}
.dungeonInfoRow{display:flex;justify-content:space-between;align-items:baseline;gap:6px;margin:2px 0;}
.dungeonInfoRow span:first-child{color:#bba;}
.dungeonInfoRow b{color:#fff;}
.dungeonInfoBest{color:#a99;font-size:9px;margin-left:auto;}
.dungeonInfoRelics,.dungeonShopRelics{color:#ffd9a0;font-weight:bold;margin:4px 0 2px;}
.dungeonShopRow{margin-top:3px;}
.dungeonShopBtn{display:block;}
`;
			document.head.appendChild(style);
		}

		// Create the dungeon state
		const dungeon = {
			id: parent.id,
			type: parent.name,
			log: [] as string[],
			logNew: 0,
			name: "",
			hero: null as any,
			currentOpponent: null as any,
			level: 0,
			auto: true,
			autoTimer: 0,
			autoWarmup: 5,
			portalPic: "dungeonFactory",
			cookiesMadeThisRun: 0,
			monstersKilledThisRun: 0,
			heroEntity: null as any,
			entities: [] as Entity[],
			map: null as any,
			entrance: [0, 0] as [number, number],
			onTile: -1,
			Log: function (what: string) { this.log.unshift(what); this.logNew++; },
			UpdateLog: function () {
				this.log = this.log.slice(0, 30);
				let str = "";
				for (let i = 0; i < this.log.length; i++) {
					str += i < this.logNew ? `<div class="new">${this.log[i]}</div>` : `<div>${this.log[i]}</div>`;
				}
				this.logNew = 0;
				const el = l("dungeonLog" + this.id);
				if (el) el.innerHTML = str;
			},
			infoHTML: function () {
				return `<div class="dungeonCardTitle">Delve status</div>` +
					`<div class="dungeonInfoRow"><span>Depth</span><b>${this.level + 1}</b><span class="dungeonInfoBest">best ${self.bestDepth}</span></div>` +
					`<div class="dungeonInfoRow"><span>Cookies</span><b>${Beautify(this.cookiesMadeThisRun)}</b><span class="dungeonInfoBest">best ${Beautify(self.bestCookies)}</span></div>` +
					`<div class="dungeonInfoRow"><span>Monsters</span><b>${Beautify(this.monstersKilledThisRun)}</b><span class="dungeonInfoBest">best ${Beautify(self.bestMonsters)}</span></div>` +
					`<div class="dungeonInfoRelics">Relics: <b>${Beautify(self.relics)}</b></div>`;
			},
			shopHTML: function () {
				let s = `<div class="dungeonCardTitle">Relic workshop</div>`;
				s += `<div class="dungeonShopRelics">Relics: <b>${Beautify(self.relics)}</b></div>`;
				for (let si = 0; si < self.upgradeNames.length; si++) {
					const uname = self.upgradeNames[si];
					const u = g.Upgrades[uname];
					const price = u ? (u.relicsPrice || 0) : 0;
					const stacks = self.effectiveStacks(uname);
					const canBuy = self.relics >= price;
					s += `<div class="dungeonShopRow"><a class="dungeonShopBtn" style="color:${canBuy ? '#9f9' : '#777'};cursor:${canBuy ? 'pointer' : 'default'};text-decoration:none;" onclick="(g.ObjectsById[${this.id}].minigame.buyUpgrade('${uname}'));">${uname} ×${stacks} — ${price} relics</a></div>`;
				}
				return s;
			},
			UpdateInfo: function () {
				// Per-turn refresh of the delve-status card only. The relic workshop's
				// contents (relic count, prices, stacks) change solely on purchase /
				// grant / floor-clear, each of which already triggers a full Draw(),
				// so re-rendering it here would needlessly thrash its buttons.
				const ei = l("dungeonInfo" + this.id); if (ei) ei.innerHTML = this.infoHTML();
			},
			GetEntities: function (x: number, y: number) { return this.entities.filter((e: Entity) => e.x === x && e.y === y); },
			AddEntity: function (type: string, subtype: string, x: number, y: number, value?: any) {
				const entity = createEntity(type, subtype, this, value);
				entity.x = x; entity.y = y; entity.dungeon = this;
				this.entities.push(entity);
				return entity;
			},
			RemoveEntities: function (x: number, y: number) { const entities = this.GetEntities(x, y); for (const e of entities) e.Destroy(); },
			DrawEntities: function () {
				return [...this.entities].sort((a: Entity, b: Entity) => a.zIndex - b.zIndex).map((e: Entity) => e.Draw()).join("");
			},
			CheckObstacle: function (x: number, y: number) {
				if (x < 0 || x >= this.map.w || y < 0 || y >= this.map.h) return -1;
				const entities = this.GetEntities(x, y);
				for (const e of entities) { if (e.obstacle) return e; }
				return this.map.isObstacle(x, y) ? -1 : 0;
			},
			Generate: function () {
				if (this.level === 0) this.name = generateDungeonName("Factory");
				this.entities = [];
				const M2 = makeMap(40, 40, Math.random(), {
					roomSize: 10, corridorSize: 5, fillRatio: 1 / 2,
					corridorRatio: 0.3, pillarRatio: Math.random() * 0.8 + 0.2,
					waterRatio: Math.random(), branching: Math.ceil(Math.random() * 6), sizeVariance: 0.4,
				});
				let r = 0;
				while (r !== 1) r = M2.dig();
				M2.finish();
				for (const door of M2.doors) this.AddEntity("destructible", "door", door[0], door[1]);
				for (const room of M2.rooms) {
					const altStr = choose(["alt ", "", ""]);
					const tiles: Record<string, string> = {
						void: altStr + "void", wall: altStr + "wall", "wall corner": altStr + "wall corner",
						floor: altStr + "tiled floor", "floor edges": altStr + "floor",
						door: altStr + "door", water: choose(["water", "green water", "dark water"]),
						pillar: choose([altStr + "wall", altStr + "round pillar", altStr + "square pillar", altStr + "potted plant", "conveyor belt"]),
						entrance: altStr + "entrance", exit: altStr + "exit",
					};
					if (Math.random() < 0.1) { tiles["wall corner"] = "wooden wall"; tiles["wall"] = "wooden wall"; tiles["floor edges"] = "wooden floor"; tiles["pillar"] = "wooden wall"; }
					if (Math.random() < 0.1) { tiles["wall corner"] = altStr + "bookshelf"; tiles["wall"] = altStr + "bookshelf"; tiles["pillar"] = altStr + "bookshelf"; }
					M2.assignTiles(room, tiles);
				}
				this.map = M2;
				this.map.str = this.map.getStr();

				const exitTile = this.map.exit;
				const candidates: string[] = [];
				for (const boss of BossMonsters) if (boss.level <= (1 + this.level) && Math.random() < (boss.stats.rarity || 1)) candidates.push(boss.name);
				const bossName = candidates.length > 0 ? choose(candidates) : choose(BossMonsters).name;
				this.AddEntity("monster", bossName, exitTile[0], exitTile[1]);
				if (this.map.isFloor(exitTile[0], exitTile[1]) !== -1) this.map.removeFreeTile(exitTile[0], exitTile[1]);

				const spawnCount = Math.ceil(this.map.freeTiles.length * 0.7);
				for (let i = 0; i < spawnCount; i++) {
					const tile = choose(this.map.freeTiles) as any;
					if (tile && tile !== -1) {
						const room = this.map.getRoom(tile[0], tile[1]);
						const depth = (room !== -1 ? (room as any).gen : 0) + 1;
						if (Math.random() < 0.2) {
							const monsterCandidates: string[] = [];
							for (const k in Monsters) { const m = Monsters[k]; if (m.level !== 0 && m.level <= (depth + this.level) && Math.random() < (m.stats.rarity || 1)) monsterCandidates.push(k); }
							if (monsterCandidates.length > 0) { this.AddEntity("monster", choose(monsterCandidates), tile[0], tile[1]); this.map.removeFreeTile(tile[0], tile[1]); }
						} else {
							if (Math.random() < 0.6) { const value = Math.round(Math.pow(Math.random(), 6) * (10 + this.level)); if (value > 0) { const entity = this.AddEntity("item", "cookies", tile[0], tile[1]); entity.value = value; } }
							else this.AddEntity("destructible", "random", tile[0], tile[1]);
							this.map.removeFreeTile(tile[0], tile[1]);
						}
					}
				}
				// CC3 (Tier 2): scatter "dungeon schematics" — free stacks of the
				// relic-bought upgrades — through the depths. Deeper floors drop
				// more (up to a cap), giving exploration a direct payoff beyond
				// cookies and relics.
				const schematicCount = Math.min(4, 1 + Math.floor(this.level / 4));
				for (let si = 0; si < schematicCount; si++) {
					const tile = choose(this.map.freeTiles) as any;
					if (tile && tile !== -1) {
						const upName = self.upgradeNames[Math.floor(Math.random() * self.upgradeNames.length)];
						this.AddEntity("special", "upgrade", tile[0], tile[1], upName);
						this.map.removeFreeTile(tile[0], tile[1]);
					}
				}
			},
			Draw: function () {
				if (!this.map || !this.hero) return;
				const x = -this.hero.x;
				const y = -this.hero.y;
				let str = `<div id="map${this.id}" class="map" style="width:${9 * 16}px;height:${9 * 16}px;"><div class="mapContainer" id="mapcontainer${this.id}" style="position:absolute;left:${x * 16}px;top:${y * 16}px;"><div id="mapitems${this.id}"></div>${this.map.str}</div></div>`;
				str += `<div style="position:absolute;left:${9 * 16 + 16}px;">` +
					`<a class="control west" onclick="document.getElementById('dungeonP${this.id}').value='west';document.getElementById('dungeonP${this.id}').dispatchEvent(new Event('change',{bubbles:true}));"></a><br>` +
					`<a class="control east" onclick="document.getElementById('dungeonP${this.id}').value='east';document.getElementById('dungeonP${this.id}').dispatchEvent(new Event('change',{bubbles:true}));"></a><br>` +
					`<a class="control north" onclick="document.getElementById('dungeonP${this.id}').value='north';document.getElementById('dungeonP${this.id}').dispatchEvent(new Event('change',{bubbles:true}));"></a><br>` +
					`<a class="control south" onclick="document.getElementById('dungeonP${this.id}').value='south';document.getElementById('dungeonP${this.id}').dispatchEvent(new Event('change',{bubbles:true}));"></a><br>` +
					`<a class="control middle" onclick="document.getElementById('dungeonP${this.id}').value='wait';document.getElementById('dungeonP${this.id}').dispatchEvent(new Event('change',{bubbles:true}));"></a><br>` +
					`</div>`;
				str += `<div style="position:absolute;left:${9 * 16 + 16 + 48 * 3}px;bottom:16px;height:100%;">` +
					`<div class="dungeonName"><a onclick="g.ObjectsById[${this.id}].setSpecial(0);">Exit</a> - <span class="title" style="font-size:12px;">${this.name}</span> lvl.${this.level + 1}</div>` +
					`<div id="heroSlot${this.id}" class="mobSlot"><div id="picHero${this.id}" class="mobPic"></div><div id="nameHero${this.id}" class="title mobName"></div><div class="hpmBar"><div id="hpHero${this.id}" class="hpBar"></div></div></div>` +
					`<div id="monsterSlot${this.id}" class="mobSlot" style="left:128px;"><div id="picMonster${this.id}" class="mobPic"></div><div id="nameMonster${this.id}" class="title mobName"></div><div class="hpmBar"><div id="hpMonster${this.id}" class="hpBar"></div></div></div>` +
					`</div>` +
					`<div id="dungeonLog${this.id}" class="dungeonLog"></div>`;
			// CC3 (Tier 1 + 3): the relic workshop + delve-status cards. Both render
			// through infoHTML()/shopHTML() so they can be refreshed live each turn
			// (UpdateInfo) as well as on the full Draw() that buyUpgrade triggers.
			str += `<div id="dungeonInfo${this.id}" class="dungeonCard dungeonInfoCard">${this.infoHTML()}</div>`;
			str += `<div id="dungeonShop${this.id}" class="dungeonCard dungeonShopCard">${this.shopHTML()}</div>`;
				const rowSpecial = l("rowSpecial" + this.id);
				if (rowSpecial) rowSpecial.innerHTML = `<div style="width:100%;height:100%;z-index:10000;position:absolute;left:0px;top:0px;">${str}</div>`;

				const picHero = l("picHero" + this.id);
				if (picHero) picHero.style.backgroundImage = `url(img/${this.hero.portrait}.webp)`;
				const nameHero = l("nameHero" + this.id);
				if (nameHero) nameHero.innerHTML = this.hero.name;
			},
			Refresh: function () {
				if (!l("mapcontainer" + this.id)) this.Draw();
				const x = 4 - this.hero.x;
				const y = 4 - this.hero.y;
				const mc = l("mapcontainer" + this.id);
				if (mc) { mc.style.left = (x * 16) + "px"; mc.style.top = (y * 16) + "px"; }
				const mi = l("mapitems" + this.id);
				if (mi) mi.innerHTML = this.DrawEntities();
			},
			RedrawMap: function () { this.map.str = this.map.getStr(); this.Draw(); },
			Turn: function () {
				for (const e of this.entities) if (e && e.type) e.Turn();
				if (this.currentOpponent) {
					const ms = l("monsterSlot" + this.id); if (ms) ms.style.visibility = "visible";
					const hpM = l("hpMonster" + this.id); if (hpM) hpM.style.width = Math.round((this.currentOpponent.stats.hp / this.currentOpponent.stats.hpm) * 100) + "%";
					const picM = l("picMonster" + this.id); if (picM) picM.style.backgroundImage = `url(img/${Monsters[this.currentOpponent.subtype]?.pic || "doughling"}.webp)`;
					const nameM = l("nameMonster" + this.id); if (nameM) nameM.innerHTML = Monsters[this.currentOpponent.subtype]?.name || "???";
				} else {
					const ms = l("monsterSlot" + this.id); if (ms) ms.style.visibility = "hidden";
					const hpM = l("hpMonster" + this.id); if (hpM) hpM.style.width = "100%";
				}
				this.currentOpponent = null;
				const hpH = l("hpHero" + this.id);
				if (hpH && this.heroEntity) hpH.style.width = Math.round((this.heroEntity.stats.hp / this.heroEntity.stats.hpm) * 100) + "%";
				this.Refresh();
				this.UpdateLog();
			this.UpdateInfo();
				if (this.hero && this.hero.x === this.map.exit[0] && this.hero.y === this.map.exit[1]) this.CompleteLevel();
			},
			DrawButton: function () {
				return `<div style="width:144px;height:144px;position:absolute;left:0px;bottom:0px;"><a class="specialButtonPic" style="background-image:url(img/${this.portalPic}.webp);" onclick="g.ObjectsById[${this.id}].setSpecial(1);"><div class="specialButtonText">Enter dungeons</div></a></div>`;
			},
			CompleteLevel: function () {
				// Salvage relics from the cleared floor. The boss guards the exit,
				// so reaching it means the floor's guardian fell — deeper floors
				// yield more relics.
				var relicGain = 1 + Math.floor(this.level / 2) + (Math.random() < 0.5 ? 1 : 0);
				self.relics += relicGain;
				self.relicsEarnedTotal += relicGain;
				// CC3 (Tier 2): cap the depth so the number never runs away and the
				// difficulty/reward curve plateaus instead of growing forever.
				this.level = Math.min(this.level + 1, DUNGEON_MAX_LEVEL);
				// CC3 (Tier 3): update lifetime bests.
				if (this.level > self.bestDepth) self.bestDepth = this.level;
			if (this.monstersKilledThisRun > self.bestMonsters) self.bestMonsters = this.monstersKilledThisRun;
				if (this.cookiesMadeThisRun > self.bestCookies) self.bestCookies = this.cookiesMadeThisRun;
				PlaySound('snd/harvest2.mp3', 0.7); // CC3 (Tier 3): floor-clear chime
				this.Generate();
				if (this.hero) DungeonHeroes[0].EnterDungeon(this, this.map.entrance[0], this.map.entrance[1]);
				this.Draw();
			},
			FailLevel: function () {
				this.Log(`Cookies made this run : ${Beautify(this.cookiesMadeThisRun)} | Monsters defeated this run : ${Beautify(this.monstersKilledThisRun)}`);
				// CC3 (Tier 3): bank the run's cookie total as a lifetime best.
				if (this.cookiesMadeThisRun > self.bestCookies) self.bestCookies = this.cookiesMadeThisRun;
				if (this.monstersKilledThisRun > self.bestMonsters) self.bestMonsters = this.monstersKilledThisRun;
			PlaySound('snd/error1.mp3', 0.5); // CC3 (Tier 3): gentle defeat tone
				this.cookiesMadeThisRun = 0;
				this.monstersKilledThisRun = 0;
				this.level = 0;
				this.Generate();
				if (this.hero) DungeonHeroes[0].EnterDungeon(this, this.map.entrance[0], this.map.entrance[1]);
				this.Draw();
			},
		} as any;

		(parent as any).dungeon = dungeon;
		// Must set DungeonList before hero.EnterDungeon so hero Say() can find it
		(window as any).DungeonList = [];
		(window as any).DungeonList[dungeon.id] = dungeon;
		(window as any).DungeonHeroes = DungeonHeroes;

		dungeon.Generate();
		const hero = DungeonHeroes[0];
		hero.EnterDungeon(dungeon, dungeon.map.entrance[0], dungeon.map.entrance[1]);
		dungeon.Draw();
		dungeon.UpdateLog();

		// Keyboard controls
		const rowSpecial = l("rowSpecial" + parent.id);
		if (rowSpecial) {
			rowSpecial.addEventListener("keydown", function (event) {
				const d = (parent as any).dungeon;
				if (!d) return;
				let control = false;
				if (event.key === "ArrowLeft") { DungeonHeroes[0].Move(-1, 0); control = true; }
				else if (event.key === "ArrowUp") { DungeonHeroes[0].Move(0, -1); control = true; }
				else if (event.key === "ArrowRight") { DungeonHeroes[0].Move(1, 0); control = true; }
				else if (event.key === "ArrowDown") { DungeonHeroes[0].Move(0, 1); control = true; }
				else if (event.key === " ") { DungeonHeroes[0].Move(0, 0); control = true; }
				else if (event.key === "a" || event.key === "A") { d.auto = !d.auto; if (d.auto) { d.autoTimer = 0; d.autoWarmup = 0; } event.preventDefault(); }
				if (control) { event.preventDefault(); d.autoTimer = g.fps * 10; d.autoWarmup = 5; }
			});
		}

		// Hidden input to route control clicks through DOM events
		const hiddenInput = document.createElement("input");
		hiddenInput.type = "hidden";
		hiddenInput.id = "dungeonP" + parent.id;
		hiddenInput.addEventListener("change", function () {
			const d = (parent as any).dungeon;
			if (!d) return;
			const dir = (this as HTMLInputElement).value;
			if (dir === "west") DungeonHeroes[0].Move(-1, 0);
			else if (dir === "east") DungeonHeroes[0].Move(1, 0);
			else if (dir === "north") DungeonHeroes[0].Move(0, -1);
			else if (dir === "south") DungeonHeroes[0].Move(0, 1);
			else if (dir === "wait") DungeonHeroes[0].Move(0, 0);
			d.autoTimer = g.fps * 10;
			d.autoWarmup = 5;
		});
		document.body.appendChild(hiddenInput);
};

M.init = function (this: DungeonMinigame, _div: HTMLElement) {
		// The div is the rowSpecial container — our launch() already filled it
};

M.save = function (this: DungeonMinigame): string {
		const d = (this.parent as any).dungeon;
		if (!d || !d.hero) return "";
		// Append the relic economy state after a '|' separator so the comma-
		// separated dungeon fields (none of which contain commas) stay intact.
		return `${d.level},${d.hero.name},${d.hero.x},${d.hero.y},${d.cookiesMadeThisRun},${d.monstersKilledThisRun},${d.hero.inDungeon}|${this.relics}|${this.upgradeStacks.join(':')}|${this.bestDepth}|${this.bestCookies}|${this.bestMonsters}`;
};

M.load = function (this: DungeonMinigame, str: string): boolean | undefined {
		if (!str) return undefined;
		const d = (this.parent as any).dungeon;
		if (!d) return undefined;
		const parts = str.split(",");
		d.level = parseInt(parts[0]);
		// The relic economy is appended after a '|' INSIDE parts[6] (the hero
		// name carries no comma, so parts[6] is "inDungeon|relics|stacks");
		// older saves without it (just the inDungeon number) leave
		// relics/stacks at their launch defaults.
		if (parts.length >= 7 && parts[6])
		{
			const extra = parts[6].split("|");
			this.relics = parseFloat(extra[1]) || 0;
			if (extra[2])
			{
				const stackParts = extra[2].split(":");
				for (let s = 0; s < this.upgradeStacks.length; s++) this.upgradeStacks[s] = Math.floor(parseFloat(stackParts[s] || 0) || 0);
				// Lazy migration: a one-time-bought upgrade (main-save bought flag)
				// with a 0 stack self-migrates to 1 on first effectiveStacks() call,
				// so just ensure the flag and stacks agree after load.
				for (let u = 0; u < this.upgradeNames.length; u++)
				{
					const mUp = g.Upgrades[this.upgradeNames[u]];
					if (mUp && mUp.bought && this.upgradeStacks[u] < 1) this.upgradeStacks[u] = 1;
				}
			}
			// CC3 (Tier 3): lifetime bests (extra[3]/extra[4]/extra[5]); default to 0.
			this.bestDepth = parseFloat(extra[3]) || 0;
			this.bestCookies = parseFloat(extra[4]) || 0;
			this.bestMonsters = parseFloat(extra[5]) || 0;
		}
		// The hero is always the first one for now
		return true;
};

M.reset = function (this: DungeonMinigame, _hard?: boolean) {
		const d = (this.parent as any).dungeon;
		if (!d) return;
		d.level = 0;
		d.cookiesMadeThisRun = 0;
		d.monstersKilledThisRun = 0;
		d.entities = [];
		// CC3 (Tier 2): the relic economy is a persistent meta-currency — it survives
		// minigame resets and ascensions (only the per-run delve state above is wiped),
		// so dungeon progress compounds across the whole save rather than per run.
		d.Generate();
		const hero = DungeonHeroes[0];
		hero.inDungeon = -1;
		hero.EnterDungeon(d, d.map.entrance[0], d.map.entrance[1]);
		d.Draw();
};

M.logic = function (this: DungeonMinigame) {
		const d = (this.parent as any).dungeon;
		if (!d || !d.hero) return;
		if (d.auto) {
			if (d.autoTimer > 0) d.autoTimer--;
			// CC3 (Tier 3): M.logic runs every animation frame, but this block only
			// fires when autoTimer has elapsed, capping the auto-turn step rate.
			if (d.autoTimer === 0) {
				const speed = d.heroEntity?.stats.speed ?? 5;
				d.autoTimer = g.fps * (Math.max(0.1, 2 - (speed * 0.2)) + Math.max(d.autoWarmup, 0));
				if (d.autoWarmup > 0) d.autoWarmup--;
				const hero = d.heroEntity;
				if (hero) {
					// CC3 (Tier 3) throttle: if already on the exit tile, skip the costly
					// pathfinding and just resolve the turn (which completes the floor).
					if (hero.x === d.map.exit[0] && hero.y === d.map.exit[1]) {
						d.Turn();
					} else {
						const chain = dungeonLocationChain(d.map, hero.x, hero.y);
						const targetRoom = chain.length > 0
							? dungeonLinkLocationChains(chain, dungeonLocationChain(d.map, d.map.exit[0], d.map.exit[1]))
							: undefined;
						const targetTile = (targetRoom && (targetRoom.gen === 0 || targetRoom.id === d.map.getRoom(hero.x, hero.y)?.id))
							? [d.map.exit[0], d.map.exit[1]]
							: (targetRoom ? targetRoom.door : [d.map.exit[0], d.map.exit[1]]);
						hero.GoTo(targetTile[0], targetTile[1]);
						if (hero.stuck) hero.Wander();
						if (d.hero) { d.hero.x = hero.x; d.hero.y = hero.y; }
						d.Turn();
					}
				}
			}
		}
};

M.draw = function (this: DungeonMinigame) {
		const d = (this.parent as any).dungeon;
		if (!d || !d.hero) return;
		d.Refresh();
};

M.onResize = function (this: DungeonMinigame) {
		// no-op
};

/* ====================================================================== *
 *  REGISTRATION                                                          *
 * ====================================================================== */

M.parent = (window as any).Game?.Objects["Factory"] || null;
if (M.parent) {
	M.parent.minigame = M as any;
	M.name = M.parent.minigameName || "Dungeon";
}

/* CC3: explicit module marker — at runtime these files are always ESM modules
 * (Vite bundles them as such), and this keeps their top-level var/function
 * declarations out of the TS global scope. Zero runtime effect. */
export {};