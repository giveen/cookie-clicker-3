/* Dyson Swarm — a CC3 extras post-transcendence building.
 *
 * This building appears in the store ONLY after the player has completed
 * their first Transcendence (transcendences >= 1). It is an ultra-expensive
 * endgame building (1 Octillion cookies base price) with a solar system theme,
 * featuring a blacked-out silhouette store icon while locked/unaffordable,
 * 6 unique display sprites on the building canvas, and 10 tiered upgrades
 * with custom pixel-art icons.
 *
 * It is declared as a native CC3 mod with vanilla=0, completely isolated from
 * CC2 save data structures, maintaining 100% byte compatibility.
 */

import { STACK_TARGET_H, stackDims, stackPosition } from '../engine/content/buildings/stackDraw';
import type { Building, Game as EngineGame } from '../engine/types';

(function () {
	if (window.__cc3DysonSwarm) return;
	window.__cc3DysonSwarm = 1;

	const NAME = 'Dyson Swarm';
	const DESC = 'Envelops the home star in a dense, orbiting swarm of solar-collecting megastructures and mirror satellites, beaming boundless stellar power straight into the cosmic cookie ovens.';
	const COMMON = 'dyson swarm|dyson swarms|harvested|[X]% larger solar array|[X]% larger solar array';
	const STORE_ICON = 'img/dysonswarm.webp';
	const STORE_ICON_OFF = 'img/dysonswarm_off.webp';
	const CANVAS_PIC = 'dysonswarm_sheet.webp';
	const CANVAS_BG = 'dysonswarmBackground.webp';
	const UPGRADES_ICON_SHEET = 'img/dysonswarm_upgrades.webp';
	const ORDER_BASE = 110000;

	// 10 Tiered Upgrades with Solar System theme
	const TIERED_UPGRADES: [string, string][] = [
		['Photonic Sails', 'Ultra-thin reflective sails capturing raw radiation pressure to propel automated baking rigs.'],
		['Coronal Siphons', 'Direct plasma pipelines dipping into the sun\'s chromosphere for maximum baking thermal efficiency.'],
		['Mercury Stripmine Array', 'Entire inner planets dismantled into orbital mirrors and solar panels.'],
		['Lagrange Harvesters', 'Massive swarm stations positioned stably at L1 through L5 gravitational equilibrium points.'],
		['Solar Flare Converters', 'Harnessing coronal mass ejections to flash-bake billions of cookies in milliseconds.'],
		['Photosphere Resonators', 'Harmonic frequencies that coax the star into emitting cookie-resonant light spectrums.'],
		['Heliospheric Grid', 'An interconnected orbital energy web stretching across interplanetary space.'],
		['Asteroid Belt Smelters', 'Automated orbital factories turning chondrite asteroids into high-capacity cookie capacitors.'],
		['Kuiper Belt Transceivers', 'Outer solar system relay buoys beaming deep-freeze crunch signatures back to the sun.'],
		['Full Star Enclosure', 'A complete, interlocking stellar shell capturing 100% of solar luminosity for infinite pastry perfection.'],
	];

	const UPGRADE_NAMES = TIERED_UPGRADES.map((t) => t[0]);
	const declared = { done: false };

	/* ------------------------------------------------------------------ */
	/* Content declaration — runs in the 'create' hook (before LoadSave). */
	/* ------------------------------------------------------------------ */
	function declare(Game: EngineGame) {
		if (declared.done || Game.Objects[NAME]) return;
		declared.done = true;

		const art = {
			pic: CANVAS_PIC,
			bg: CANVAS_BG,
			xV: 8,
			yV: 8,
			w: 64,
			h: 80,
			x: 0,
			y: 0,
			rows: 2,
			frames: 3,
			storeIcon: STORE_ICON,
			storeIconOff: STORE_ICON_OFF,
			storeIconSize: '48px 48px',
			storeIconPosition: '0px 0px',
		};

		const me = new Game.Object(
			NAME,
			COMMON,
			DESC,
			0,   // icon row
			2,   // iconColumn
			art,
			0,   // price (overridden below)
			function (m: Building) {
				let mult = 1;
				mult *= Game.GetTieredCpsMult(m);
				mult *= Game.magicCpS(m.name);
				return m.baseCps * mult;
			},
			function (this: Building) {
				Game.UnlockTiered(this);
			}
		);

		// Store icon coordinates and styling
		me.iconFunc = function () { return [0, 0]; };
		me.displayName = '<span style="font-size:85%;position:relative;bottom:4px;">Dyson Swarm</span>';

		// Store order: directly below Black Hole Inverter (id 20 / storeOrder 20)
		me.storeOrder = 21;

		// Post-transcendence unlock condition: ONLY visible in store after 1st transcend
		(me as any).lockedCondition = function (): boolean {
			const T = (window as any).__cc3Transcendence;
			return !!(T && T.state && T.state.transcendences >= 1);
		};

		// Super-expensive pricing: 1.0e27 base price, 1.2e20 base CpS
		me.basePrice = 1.0e27;
		me.price = me.basePrice;
		me.bulkPrice = me.basePrice;
		me.baseCps = 1.2e20;

		// 10 tiered upgrades with solar system theme and custom icons
		for (let i = 0; i < TIERED_UPGRADES.length; i++) {
			const up = Game.TieredUpgrade(TIERED_UPGRADES[i][0], '<q>' + TIERED_UPGRADES[i][1] + '</q>', NAME, i + 1);
			up.order = ORDER_BASE + i;
			// Custom upgrade icon from our dysonswarm_upgrades.webp sheet
			up.icon = [i, 0, UPGRADES_ICON_SHEET, 48];
		}

		if (typeof window.LocalizeUpgradesAndAchievs === 'function') window.LocalizeUpgradesAndAchievs();

		// Building canvas display: 6 distinct solar swarm megastructure sprites on 3x2 sheet
		const biCellW = 64;
		const biCellH = 80;
		const biSheetCols = 3;
		const biSheetRows = 2;

		me.draw = function (this: Building) {
			if (this.amount <= 0 || !this.canvas || !this.ctx) return false;
			if (this.toResize || this.canvas.width === 0) {
				if (this.canvas.clientWidth > 0) {
					this.canvas.width = this.canvas.clientWidth;
					this.canvas.height = this.canvas.clientHeight;
					this.pics = [];
					this.toResize = false;
				}
			}
			const ctx = this.ctx;
			ctx.globalAlpha = 1;
			const bg = (window as any).Pic(this.art.bg);
			if (bg && bg.complete && bg.naturalWidth > 0) {
				ctx.imageSmoothingEnabled = true;
				const bgW = Math.max(1, Math.ceil((this.canvas.height * bg.naturalWidth) / bg.naturalHeight));
				for (let bgX = 0; bgX < this.canvas.width; bgX += bgW) {
					ctx.drawImage(bg, 0, 0, bg.naturalWidth, bg.naturalHeight, bgX, 0, bgW, this.canvas.height);
				}
			} else if (typeof this.art.bg === 'string') {
				ctx.fillPattern((window as any).Pic(this.art.bg), 0, 0, this.canvas.width, this.canvas.height, 128, 128);
			}

			const sheet = (window as any).Pic(this.art.pic);
			if (sheet.width !== this._stackSheetW || sheet.height !== this._stackSheetH) {
				this.pics = [];
				this._stackSheetW = sheet.width;
				this._stackSheetH = sheet.height;
			}
			const cellSrcW = sheet.naturalWidth ? Math.round(sheet.naturalWidth / biSheetCols) : biCellW;
			const cellSrcH = sheet.naturalHeight ? Math.round(sheet.naturalHeight / biSheetRows) : biCellH;
			const scale = Math.min(1, STACK_TARGET_H / biCellH);
			const drawW = biCellW * scale;
			const drawH = biCellH * scale;
			const canvasW = this.canvas.width;
			const canvasH = this.canvas.height;
			const dims = stackDims(canvasW, canvasH, drawW, drawH);
			const iT = Math.min(this.amount, dims.perRow * dims.numRows);

			let i = this.pics.length;
			if (i !== iT) {
				while (i < iT) {
					Math.seedrandom(Game.seed + ' ' + this.id + ' ' + i);
					const pos = stackPosition(i, canvasW, canvasH, drawW, drawH);
					const sx = (i % biSheetCols) * cellSrcW;
					const sy = (Math.floor(i / biSheetCols) % biSheetRows) * cellSrcH;
					this.pics.push({
						x: Math.floor(pos.x),
						y: Math.floor(pos.y),
						z: pos.z,
						pic: this.art.pic,
						id: i,
						frame: 0,
						flip: Math.random() < 0.5,
						sx: sx,
						sy: sy,
						srcW: cellSrcW,
						srcH: cellSrcH,
						drawW: drawW,
						drawH: drawH,
						born: Game.T,
					});
					i++;
				}
				while (i > iT) {
					this.pics.sort(Game.sortSpritesById);
					this.pics.pop();
					i--;
				}
				this.pics.sort(Game.sortSprites);
			}
			ctx.imageSmoothingEnabled = true;
			for (let pIdx = 0; pIdx < this.pics.length; pIdx++) {
				const pic: any = this.pics[pIdx];
				ctx.globalAlpha = Math.floor(pic.id / dims.perRow) > 0 ? 0.88 : 1;
				if (pic.flip) {
					ctx.save();
					ctx.translate(pic.x + pic.drawW, pic.y);
					ctx.scale(-1, 1);
					ctx.drawImage(sheet, pic.sx, pic.sy, pic.srcW || cellSrcW, pic.srcH || cellSrcH, 0, 0, pic.drawW, pic.drawH);
					ctx.restore();
				} else {
					ctx.drawImage(sheet, pic.sx, pic.sy, pic.srcW || cellSrcW, pic.srcH || cellSrcH, pic.x, pic.y, pic.drawW, pic.drawH);
				}
			}
			ctx.globalAlpha = 1;
			return true;
		};

		setupBuildingDom(Game, me);
		Game.recalculateGains = 1;
	}

	function setupBuildingDom(Game: EngineGame, me: Building) {
		Game.BuildStore();
		if (me.id <= 0) return;
		const canvas = window.l('rowCanvas' + me.id) as HTMLCanvasElement;
		me.canvas = canvas;
		if (canvas) {
			me.ctx = canvas.getContext('2d');
			me.pics = [];
			if (window.AddEvent) {
				window.AddEvent(canvas, 'mouseover', function () { me.mouseOn = true; });
				window.AddEvent(canvas, 'mouseout', function () { me.mouseOn = false; });
				window.AddEvent(canvas, 'mousemove', function (e: MouseEvent) {
					const box = canvas.getBounds();
					me.mousePos[0] = e.pageX - box.left;
					me.mousePos[1] = e.pageY - box.top;
				});
			}
		}

		if (Game.clickStr) {
			const icon = [0 * 64, me.icon * 64];
			const host = window.l('buildingsMute');
			if (host && !window.l('mutedProduct' + me.id)) {
				host.insertAdjacentHTML('beforeend',
					'<div class="tinyProductIcon" id="mutedProduct' + me.id + '" style="display:none;background-position:-' + icon[0] + 'px -' + icon[1] + 'px;" ' +
					Game.clickStr + '="Game.ObjectsById[' + me.id + '].mute(0);PlaySound(Game.ObjectsById[' + me.id + '].muted?\'snd/clickOff2.mp3\':\'snd/clickOn2.mp3\');"></div>');
			}
		}
	}

	/* ------------------------------------------------------------------ */
	/* Presentation: re-assert custom store icons each draw tick.         */
	/* ------------------------------------------------------------------ */
	function drawIcon(Game: EngineGame) {
		const me = Game.Objects[NAME];
		if (!me) return;
		const on = document.getElementById('productIcon' + me.id);
		const off = document.getElementById('productIconOff' + me.id);
		if (on) {
			on.style.backgroundImage = 'url(' + STORE_ICON + ')';
			on.style.backgroundSize = '48px 48px';
			on.style.backgroundPosition = '0px 0px';
		}
		if (off) {
			off.style.backgroundImage = 'url(' + STORE_ICON_OFF + ')';
			off.style.backgroundSize = '48px 48px';
			off.style.backgroundPosition = '0px 0px';
		}
	}

	/* ------------------------------------------------------------------ */
	/* Persistence — vanilla=0 content is not saved by engine, so save/load */
	/* ------------------------------------------------------------------ */
	function save(Game: EngineGame): string | undefined {
		const me = Game.Objects[NAME];
		if (!me) return undefined;
		const boughtUpgs: string[] = [];
		for (let i = 0; i < UPGRADE_NAMES.length; i++) {
			const u = Game.Upgrades[UPGRADE_NAMES[i]];
			if (u && u.bought) boughtUpgs.push(u.name);
		}
		if (me.amount === 0 && !me.bought && boughtUpgs.length === 0) return undefined;
		return [
			[1, me.amount, me.bought ? 1 : 0, Math.floor(me.totalCookies), me.level, me.highest, me.muted ? 1 : 0].join('|'),
			boughtUpgs.join(','),
		].join('@');
	}

	function load(Game: EngineGame, str: string): void {
		if (!str) return;
		const me = Game.Objects[NAME];
		if (!me) return;
		const parts = String(str).split('@');
		const nums = (parts[0] || '').split('|');
		me.amount = parseInt(nums[1] || '0', 10) || 0;
		me.bought = parseInt(nums[2] || '0', 10) || 0;
		me.totalCookies = parseFloat(nums[3] || '0') || 0;
		me.level = parseInt(nums[4] || '0', 10) || 0;
		me.highest = parseInt(nums[5] || '0', 10) || 0;
		me.muted = parseInt(nums[6] || '0', 10) || 0;
		Game.BuildingsOwned = (Game.BuildingsOwned || 0) + me.amount;

		const boughtUpgs = (parts[1] || '').split(',').filter(Boolean);
		for (let i = 0; i < boughtUpgs.length; i++) {
			const u = Game.Upgrades[boughtUpgs[i]];
			if (u) {
				u.unlocked = 1;
				u.bought = 1;
				if (typeof u.buyFunction === 'function') u.buyFunction.call(u);
			}
		}
		me.refresh();
		Game.recalculateGains = 1;
	}

	/* ------------------------------------------------------------------ */
	/* Registration                                                        */
	/* ------------------------------------------------------------------ */
	function register() {
		const Game = window.Game;
		if (!Game || typeof Game.registerMod !== 'function') return false;
		Game.registerMod('Dyson Swarm', {
			name: 'Dyson Swarm',
			version: '1.0-cc3',
			init: function () {
				Game.registerHook('create', function () { declare(Game); });
				Game.registerHook('draw', function () { drawIcon(Game); });
			},
			save: function () { return save(Game); },
			load: function (str: string) { load(Game, str); },
		}, true);
		return true;
	}

	if (!register()) {
		const t = window.setInterval(function () {
			if (register()) window.clearInterval(t);
		}, 25);
		window.addEventListener('load', function () { window.clearInterval(t); }, { once: true });
	}
})();
