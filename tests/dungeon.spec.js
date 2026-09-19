// Factory Dungeon minigame — functional coverage (Tier 2).
//
// Boots the production build in headless Chromium, force-loads the Factory
// minigame (it unlocks once you own 50 Factories), and asserts the dungeon behaves:
//   1. the minigame loads with a hero, generated map, entrance and exit;
//   2. hero selection swaps the live hero and persists on the minigame;
//   3. auto-explore (BFS pathing, throttled) actually drives the hero to the
//      exit and clears a floor (level increases);
//   4. the relic economy grants relics (boss/loot path) and save/load round-trips
//      relics + the selected hero;
//   5. the visible auto-explore indicator badge reflects the auto state;
//   6. the panel's inline onclick handlers (Exit link, hero-picker chips,
//      relic-workshop buy buttons) execute without ReferenceErrors — they run
//      in the global scope, so they must reference the global `Game`, not a
//      module-local.
//
// Each test re-boots fresh so state never leaks between them.
// Run: npx playwright test tests/dungeon.spec.js
import { expect, test } from '@playwright/test';

const BOOT = { timeout: 30_000 };

async function boot(page) {
	await page.goto('/?debug=1', { waitUntil: 'load' });
	const lang = page.locator('#langSelect-English');
	try {
		await lang.waitFor({ state: 'visible', timeout: 5_000 });
		await lang.click();
	} catch {
		/* no language prompt (a profile already chose one) */
	}
	await page.waitForFunction(() => window.Game && window.Game.ready === 1, null, BOOT);
}

/** Force the Factory minigame to load: give it the unlock threshold, then LoadMinigames. */
async function loadDungeon(page) {
	await page.evaluate(() => {
		const G = window.Game;
		G.cookies += 1e15;
		const f = G.Objects['Factory'];
		// the Factory Dungeon is gated behind OWING 50 Factories (CC3) — not the
		// sugar-lump level, which buying Factories never advances.
		f.amount = 50;
		f.unlocked = 1;
		f.bought = 50;
		f.highest = 50;
		G.recalculateGains = 1;
		if (G.LoadMinigames) G.LoadMinigames();
	});
	await page.waitForFunction(
		() => {
			const f = window.Game.Objects['Factory'];
			return !!(f && f.minigameLoaded && f.minigame && f.dungeon && f.dungeon.hero);
		},
		null,
		{ timeout: 30_000 },
	);
}

test('Factory Dungeon is gated behind owning 50 Factories', async ({ page }) => {
	await boot(page);
	// Drive Game.isMinigameReady directly with the prerequisites satisfied so we
	// isolate the ownership gate (no async script-loading timing in the assertion).
	// level is pinned to 0 so a regression to a sugar-lump-level gate fails here
	// (a level-only gate would keep the dungeon locked at 50 owned Factories).
	const res = await page.evaluate(() => {
		const G = window.Game;
		const f = G.Objects['Factory'];
		f.minigameUrl = 'minigameDungeon.js';
		f.minigameLoaded = true;
		f.level = 0;
		const check = (n) => {
			f.amount = n;
			return G.isMinigameReady(f);
		};
		return { lockedAt1: check(1), lockedAt49: check(49), unlockedAt50: check(50) };
	});
	expect(res.lockedAt1, 'dungeon should NOT be ready with 1 Factory').toBe(false);
	expect(res.lockedAt49, 'dungeon should NOT be ready with 49 Factories').toBe(false);
	expect(res.unlockedAt50, 'dungeon should be ready with 50 Factories').toBe(true);
});

test('the dungeon loads in-session once the 50th Factory is owned (no reload, no manual load)', async ({ page }) => {
	await boot(page);
	// Reach the unlock threshold the way a player would: own 50 Factories.
	// Deliberately do NOT call Game.LoadMinigames() — the engine's per-tick poll
	// in Logic() must notice and load the dungeon on its own.
	await page.evaluate(() => {
		const G = window.Game;
		const f = G.Objects['Factory'];
		G.cookies += 1e15;
		f.amount = 50;
		f.unlocked = 1;
		f.bought = 50;
		f.highest = 50;
		G.recalculateGains = 1;
	});
	await page.waitForFunction(
		() => {
			const f = window.Game.Objects['Factory'];
			return !!(f && f.minigameLoaded && f.minigame && f.dungeon && f.dungeon.hero);
		},
		null,
		{ timeout: 30_000 },
	);
});

test('dungeon minigame loads with a hero, map, entrance and exit', async ({ page }) => {
	await boot(page);
	await loadDungeon(page);
	const info = await page.evaluate(() => {
		const d = window.Game.Objects['Factory'].dungeon;
		const M = window.Game.Objects['Factory'].minigame;
		return {
			hasMap: !!d.map,
			w: d.map ? d.map.w : 0,
			h: d.map ? d.map.h : 0,
			hasEntrance: Array.isArray(d.map && d.map.entrance),
			hasExit: Array.isArray(d.map && d.map.exit),
			heroName: d.hero ? d.hero.name : '',
			selectedHero: M.selectedHero,
			autoDefault: d.auto,
		};
	});
	expect(info.hasMap).toBe(true);
	expect(info.w).toBeGreaterThan(0);
	expect(info.h).toBeGreaterThan(0);
	expect(info.hasEntrance).toBe(true);
	expect(info.hasExit).toBe(true);
	expect(info.heroName.length).toBeGreaterThan(0);
	expect(info.selectedHero).toBe(0);
	expect(info.autoDefault).toBe(true);
});

test('hero selection swaps the live hero and updates the minigame pick', async ({ page }) => {
	await boot(page);
	await loadDungeon(page);
	const before = await page.evaluate(() => {
		const d = window.Game.Objects['Factory'].dungeon;
		return { sel: window.Game.Objects['Factory'].minigame.selectedHero, name: d.hero.name };
	});
	expect(before.sel).toBe(0);
	await page.evaluate(() => window.Game.Objects['Factory'].minigame.setHero(1));
	const after = await page.evaluate(() => {
		const d = window.Game.Objects['Factory'].dungeon;
		return { sel: window.Game.Objects['Factory'].minigame.selectedHero, name: d.hero.name };
	});
	expect(after.sel).toBe(1);
	expect(after.name).not.toBe(before.name);
	// The previous hero's slot is freed and the new hero is re-entered at the entrance.
	const placed = await page.evaluate(() => {
		const d = window.Game.Objects['Factory'].dungeon;
		return { x: d.hero.x, y: d.hero.y, ex: d.map.entrance[0], ey: d.map.entrance[1] };
	});
	expect(placed.x).toBe(placed.ex);
	expect(placed.y).toBe(placed.ey);
});

test('auto-explore (BFS pathing) clears the early floors for a fresh, un-buffed hero', async ({ page }) => {
	await boot(page);
	await loadDungeon(page);
	// No buffing: this is a balance assertion. A freshly unlocked Factory (50
	// Factories — the unlock threshold, the minimum a player can have here)
	// must not be blocked by an unbeatable boss on floor 1 — the hero should
	// clear at least one floor and win fights along the way.
	const res = await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		const d = F.dungeon;
		const M = F.minigame;
		d.auto = true;
		const startLevel = d.level;
		let cleared = false;
		for (let i = 0; i < 12000 && !cleared; i++) {
			d.autoTimer = 0; // force a step on this tick
			M.logic();
			if (d.level > startLevel) cleared = true;
		}
		return { cleared, startLevel, level: d.level, monsters: d.monstersKilledThisRun, cookies: d.cookiesMadeThisRun };
	});
	expect(res.cleared, `fresh hero never cleared a floor (level stayed at ${res.level})`).toBe(true);
	expect(res.monsters).toBeGreaterThan(0);
});

test('boss-guarded floors are winnable once the factory is built up', async ({ page }) => {
	await boot(page);
	await loadDungeon(page);
	const res = await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		const d = F.dungeon;
		const M = F.minigame;
		F.amount = 500; // a built-up factory → a scaled-up hero
		d.auto = true;
		d.level = 5; // force a boss-guarded floor (bosses only spawn from level 5)
		d.Generate();
		M.setHero(0); // re-enter the hero at the entrance with the scaled stats
		const startLevel = d.level;
		let cleared = false;
		for (let i = 0; i < 20000 && !cleared; i++) {
			d.autoTimer = 0;
			M.logic();
			if (d.level > startLevel) { cleared = true; break; }
		}
		return { cleared, level: d.level };
	});
	expect(res.cleared, `boss floor not cleared even with a built-up factory (level ${res.level})`).toBe(true);
});

test('relic economy grants relics and the meta state round-trips through save/load', async ({ page }) => {
	await boot(page);
	await loadDungeon(page);
	const econ = await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		const d = F.dungeon;
		const M = F.minigame;
		// Relics are a persistent meta-currency held on the minigame (M), not the
		// per-run dungeon object — addRelics and save/load both target M.relics.
		const before = M.relics;
		d.addRelics(5);
		const afterGrant = M.relics;
		// Pick hero 2, then save and reload to verify the meta persists.
		M.setHero(2);
		const save = M.save();
		M.relics = 0;
		M.load(save);
		return { before, afterGrant, loadedRelics: M.relics, loadedSel: M.selectedHero };
	});
	expect(econ.afterGrant).toBe(econ.before + 5);
	expect(econ.loadedRelics).toBe(econ.before + 5);
	expect(econ.loadedSel).toBe(2);
});

test('visible auto-explore indicator reflects the auto state and toggles on click', async ({ page }) => {
	await boot(page);
	await loadDungeon(page);
	// Open the minigame panel so the dungeon Draw() populates the DOM.
	await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		if (F.switchMinigame) {
			F.switchMinigame(1);
			if (F.refresh) F.refresh();
		}
	});
	const badgeId = await page.evaluate(() => 'dungeonAuto' + window.Game.Objects['Factory'].id);
	const badge = page.locator('#' + badgeId);
	await expect(badge).toBeVisible({ timeout: 10_000 });

	const on = await page.evaluate((id) => {
		const el = document.getElementById(id);
		return { text: el.textContent, auto: window.Game.Objects['Factory'].dungeon.auto, className: el.className };
	}, badgeId);
	expect(on.auto).toBe(true);
	expect(on.text).toContain('ON');
	expect(on.className).toContain('active');

	// Click the badge to toggle auto off — button must stay visible and show OFF
	await page.evaluate(() => window.Game.CloseNotes());
	await badge.click();

	const off = await page.evaluate((id) => {
		const el = document.getElementById(id);
		return { text: el.textContent, auto: window.Game.Objects['Factory'].dungeon.auto, className: el.className };
	}, badgeId);
	expect(off.auto).toBe(false);
	expect(off.text).toContain('OFF');
	expect(off.className).toContain('off');
	await expect(badge).toBeVisible();

	// Click again to toggle auto back on
	await badge.click();
	const onAgain = await page.evaluate((id) => {
		const el = document.getElementById(id);
		return { text: el.textContent, auto: window.Game.Objects['Factory'].dungeon.auto, className: el.className };
	}, badgeId);
	expect(onAgain.auto).toBe(true);
	expect(onAgain.text).toContain('ON');
	expect(onAgain.className).toContain('active');
});

test('expanded panel has the full-size layout: in-flow wrapper, board inside the panel, no stacked controls', async ({ page }) => {
	await boot(page);
	await loadDungeon(page);
	// Open the panel through the instant path (the one save-restore uses); the
	// animated user-click path tweens to the same natural height measured here.
	await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		F.switchMinigame(1);
		F.refresh();
	});
	const geo = await page.evaluate(() => {
		const f = window.Game.Objects['Factory'];
		const l = (id) => document.getElementById(id);
		const r = (el) => {
			if (!el) return null;
			const b = el.getBoundingClientRect();
			return { top: b.top, left: b.left, right: b.right, bottom: b.bottom, w: b.width, h: b.height };
		};
		const wrap = l('dungeonContent');
		const panel = r(l('rowSpecial' + f.id));
		const inPanel = (x) => !!x && !!panel && x.top >= panel.top - 1 && x.left >= panel.left - 1 && x.right <= panel.right + 1 && x.bottom <= panel.bottom + 1;
		const map = r(l('map' + f.id));
		const log = r(l('dungeonLog' + f.id));
		const info = r(l('dungeonInfo' + f.id));
		const shop = r(l('dungeonShop' + f.id));
		return {
			onMinigame: f.onMinigame,
			panel,
			wrap: r(wrap),
			wrapPosition: wrap ? getComputedStyle(wrap).position : null,
			mapInside: inPanel(map),
			logInside: inPanel(log),
			infoInside: inPanel(info),
			shopInside: inPanel(shop),
			exitInside: wrap ? inPanel(r(wrap.querySelector('.dungeonName'))) : false,
			// The relic workshop must not cover the delve-status card above it.
			infoShopGap: info && shop ? shop.top - info.bottom : null,
			// All five D-pad buttons must occupy distinct positions (the legacy
			// collapse pinned them all on top of each other).
			controlTops: wrap ? [...wrap.querySelectorAll('.control')].map((c) => Math.round(c.getBoundingClientRect().top)) : null,
			logSitsOnBottomEdge: panel && log ? Math.abs(log.bottom - panel.bottom) <= 2 : false,
		};
	});
	// onMinigame can be the truthy number 1 (switchMinigame(1) from the QA/save-restore path), so assert truthiness, not strict boolean.
	expect(geo.onMinigame, 'panel should be open').toBeTruthy();
	// The regression being guarded against: the legacy absolute wrapper left the
	// panel at its 24px min-height. A usable dungeon needs the full board —
	// at least 3x the collapsed 128px canvas row.
	expect(geo.panel.h, 'panel height').toBeGreaterThanOrEqual(360);
	expect(geo.wrap.h, 'in-flow wrapper fills the panel').toBeCloseTo(geo.panel.h, 0);
	expect(geo.wrapPosition, 'wrapper must be the positioned containing block').toBe('relative');
	expect(geo.mapInside, 'map is inside the panel').toBe(true);
	expect(geo.logInside, 'log is inside the panel').toBe(true);
	expect(geo.logSitsOnBottomEdge, 'log pinned to the panel bottom edge').toBe(true);
	expect(geo.infoInside, 'delve-status card is inside the panel').toBe(true);
	expect(geo.shopInside, 'relic workshop is inside the panel').toBe(true);
	expect(geo.exitInside, 'exit/level header is inside the panel').toBe(true);
	expect(geo.infoShopGap, 'relic workshop does not overlap the delve-status card').toBeGreaterThanOrEqual(0);
	const tops = geo.controlTops || [];
	expect(tops.length, 'five D-pad buttons present').toBe(5);
	expect(new Set(tops).size, 'D-pad buttons occupy distinct rows').toBeGreaterThanOrEqual(3);

	// Closing collapses the row back to its fixed-height canvas form.
	await page.evaluate(() => window.Game.Objects['Factory'].switchMinigame(0));
	const closed = await page.evaluate(() => {
		const f = window.Game.Objects['Factory'];
		const p = document.getElementById('rowSpecial' + f.id);
		const row = document.getElementById('row' + f.id);
		return { onMinigame: f.onMinigame, panelDisplay: getComputedStyle(p).display, rowH: row.getBoundingClientRect().height };
	});
	expect(closed.onMinigame, 'panel flagged closed').toBeFalsy();
	expect(closed.panelDisplay, 'panel hidden when closed').toBe('none');
	expect(closed.rowH, 'row back to the canvas height, not the panel height').toBeLessThan(300);
});

test('panel inline handlers (Exit link, hero chips, relic buy) run without reference errors', async ({ page }) => {
	await boot(page);
	await loadDungeon(page);
	// Inline onclick attributes compile to GLOBAL-scope functions in the page:
	// they can only reach `window.Game`, never a module-local alias. A handler
	// that references anything else (e.g. the minigame's private `g`) throws a
	// ReferenceError the moment a real user clicks it — exactly what happened
	// to the Exit link, hero chips and relic-workshop buttons before the fix.
	const errors = [];
	page.on('pageerror', (e) => errors.push(String(e)));
	page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

	await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		F.switchMinigame(1);
		F.refresh();
	});
	// loadDungeon's 1e15-cookie seed cascades into an achievement-crate flood in
	// the #notes overlay, which sits over the panel and intercepts clicks. Clear
	// them the way a user would (the same call the notes panel's own x uses),
	// right before each interaction — more crates can still arrive between them.
	const clearNotes = () => page.evaluate(() => window.Game.CloseNotes());

	// (a) hero-picker chip -> minigame.setHero
	await clearNotes();
	const chips = page.locator('.dungeonHeroChip');
	expect(await chips.count(), 'four hero chips in the panel').toBe(4);
	await chips.nth(1).click();
	const hero = await page.evaluate(() => window.Game.Objects['Factory'].minigame.selectedHero);
	expect(hero, 'hero chip click applied (no ReferenceError)').toBe(1);

	// (b) relic-workshop buy button -> minigame.buyUpgrade
	await page.evaluate(() => {
		const M = window.Game.Objects['Factory'].minigame;
		M.relics = 500;
		M.draw(); // redraw the shop so the row is rendered buyable
	});
	const before = await page.evaluate(() => {
		const M = window.Game.Objects['Factory'].minigame;
		return { name: M.upgradeNames[0], stacks: M.effectiveStacks(M.upgradeNames[0]), relics: M.relics };
	});
	await clearNotes();
	await page.locator('.dungeonShopBtn').first().click();
	const after = await page.evaluate(() => {
		const M = window.Game.Objects['Factory'].minigame;
		return { name: M.upgradeNames[0], stacks: M.effectiveStacks(M.upgradeNames[0]), relics: M.relics };
	});
	expect(after.stacks, 'relic buy applied a stack').toBe(before.stacks + 1);
	expect(after.relics, 'relic buy spent relics').toBeLessThan(before.relics);

	// (c) Exit link -> switchMinigame(0,1): flips the flag instantly; the
	// user-click path closes ANIMATED (~180ms). The close animation removes the
	// row's class up-front (keeping the panel in flow via inline styles), so
	// the class is NOT a done-signal — wait for the panel to actually collapse.
	await clearNotes();
	await page.locator('#dungeonContent .dungeonName a').first().click();
	const fid = await page.evaluate(() => window.Game.Objects['Factory'].id);
	await page.waitForFunction((_pid) => {
		const F = window.Game.Objects['Factory'];
		if (F.onMinigame) return false;
		const el = document.getElementById('dungeonContent');
		if (!el) return true;
		return el.getBoundingClientRect().height < 10; // collapsed (CSS display:none or zero height)
	}, fid, { timeout: 15_000 });
	const closed = await page.evaluate((_id) => {
		const F = window.Game.Objects['Factory'];
		const el = document.getElementById('dungeonContent');
		return {
			onMinigame: F.onMinigame,
			panelGone: !el || el.getBoundingClientRect().height < 10 || getComputedStyle(el).display === 'none',
		};
	}, fid);
	expect(closed.onMinigame, 'Exit link closed the panel').toBeFalsy();
	expect(closed.panelGone, 'panel collapsed after the animated close').toBe(true);

	expect(errors, 'no uncaught errors from any inline handler').toEqual([]);
});

test('dungeon fullscreen mode provides balanced layout with right sidebar, large map, and responsive scaling', async ({ page }) => {
	await boot(page);
	await loadDungeon(page);

	await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		F.switchMinigame(1);
		F.refresh();
	});

	await page.screenshot({ path: '/home/jabbatheduck/.gemini/antigravity/brain/9f24492c-e623-41b9-827b-4d2aa381386f/dungeon_normal.png' });

	// Toggle fullscreen
	await page.evaluate(() => {
		window.Game.Objects['Factory'].minigame.toggleFullscreen();
	});

	const fsGeo = await page.evaluate(() => {
		const f = window.Game.Objects['Factory'];
		const l = (id) => document.getElementById(id);
		const r = (el) => {
			if (!el) return null;
			const b = el.getBoundingClientRect();
			return { top: b.top, left: b.left, right: b.right, bottom: b.bottom, w: b.width, h: b.height };
		};
		const wrap = l('dungeonContent');
		const map = r(l('map' + f.id));
		const log = r(l('dungeonLog' + f.id));
		const info = r(l('dungeonInfo' + f.id));
		const shop = r(l('dungeonShop' + f.id));
		const name = r(wrap ? wrap.querySelector('.dungeonName') : null);
		return {
			isFullscreen: wrap ? wrap.classList.contains('dungeonFullscreen') : false,
			winW: window.innerWidth,
			winH: window.innerHeight,
			map,
			log,
			info,
			shop,
			name,
		};
	});

	expect(fsGeo.isFullscreen, 'dungeonContent has dungeonFullscreen class').toBe(true);
	// Map is enlarged significantly in fullscreen (larger than the 240px normal mode map)
	expect(fsGeo.map.w, 'map width is enlarged in fullscreen').toBeGreaterThanOrEqual(480);
	expect(fsGeo.map.h, 'map height is enlarged in fullscreen').toBeGreaterThanOrEqual(480);
	// Delve status is a compact bar on the right
	expect(fsGeo.info.w, 'delve status width is sidebar width (~340px)').toBeCloseTo(340, -1);
	expect(fsGeo.info.h, 'delve status is compact height').toBeLessThanOrEqual(130);
	expect(fsGeo.winW - fsGeo.info.right, 'delve status is anchored to the right margin').toBeLessThanOrEqual(25);
	// Relic workshop is below delve status on the right
	expect(fsGeo.shop.top, 'shop is below delve status').toBeGreaterThanOrEqual(fsGeo.info.bottom);
	expect(fsGeo.shop.w, 'shop width is sidebar width (~340px)').toBeCloseTo(340, -1);
	expect(fsGeo.winW - fsGeo.shop.right, 'shop is anchored to the right margin').toBeLessThanOrEqual(25);
	// Log is vertically long down to the bottom margin on the right
	expect(fsGeo.log.top, 'log is below shop').toBeGreaterThanOrEqual(fsGeo.shop.bottom);
	expect(fsGeo.log.w, 'log width is sidebar width (~340px)').toBeCloseTo(340, -1);
	expect(fsGeo.winW - fsGeo.log.right, 'log is anchored to the right margin').toBeLessThanOrEqual(25);
	expect(fsGeo.winH - fsGeo.log.bottom, 'log reaches near bottom edge of screen').toBeLessThanOrEqual(25);

	await page.screenshot({ path: '/home/jabbatheduck/.gemini/antigravity/brain/9f24492c-e623-41b9-827b-4d2aa381386f/dungeon_fullscreen.png' });
});

test('Factory Dungeon gear system: weapons and armor drop, equip, buff stats, and persist in save', async ({ page }) => {
	await boot(page);
	await loadDungeon(page);

	// Verify gear definitions and baseline state
	const baseline = await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		const d = F.dungeon;
		const hero = window.DungeonHeroes[F.minigame.selectedHero];
		return {
			armorTiers: window.DungeonArmor.length,
			weaponTiers: window.DungeonWeapons.length,
			initialArmor: hero.gear.armor,
			initialWeapon: hero.gear.weapon,
			heroMight: d.heroEntity.stats.might,
			heroGuard: d.heroEntity.stats.guard,
			heroHpm: d.heroEntity.stats.hpm,
		};
	});

	expect(baseline.armorTiers).toBe(5);
	expect(baseline.weaponTiers).toBe(5);
	expect(baseline.initialArmor).toBe(-1);
	expect(baseline.initialWeapon).toBe(-1);

	// Spawn a gear chest on the hero's position and trigger Turn to pick it up
	const pickup = await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		const d = F.dungeon;
		const hero = window.DungeonHeroes[F.minigame.selectedHero];

		// Add Tier 2 Armor chest (Ceramic Kiln Plate: +4 Guard, +20 HP)
		const chest = d.AddEntity('item', 'gear', hero.x, hero.y);
		chest.value = { type: 'armor', id: 2 };

		// Hero executes turn to collect items on tile
		d.heroEntity.Turn();

		return {
			newArmor: hero.gear.armor,
			newGuard: d.heroEntity.stats.guard,
			newHpm: d.heroEntity.stats.hpm,
			infoHTML: d.infoHTML(),
		};
	});

	expect(pickup.newArmor).toBe(2);
	expect(pickup.newGuard).toBe(baseline.heroGuard + 4);
	expect(pickup.newHpm).toBe(baseline.heroHpm + 20);
	expect(pickup.infoHTML).toContain('Ceramic Kiln Plate');

	// Pick up a weapon (Tier 1 Serrated Spatula: +2 Might, +1 Speed)
	const weaponPickup = await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		const d = F.dungeon;
		const hero = window.DungeonHeroes[F.minigame.selectedHero];

		const chest = d.AddEntity('item', 'gear', hero.x, hero.y);
		chest.value = { type: 'weapon', id: 1 };
		d.heroEntity.Turn();

		return {
			newWeapon: hero.gear.weapon,
			newMight: d.heroEntity.stats.might,
			infoHTML: d.infoHTML(),
		};
	});

	expect(weaponPickup.newWeapon).toBe(1);
	expect(weaponPickup.newMight).toBe(baseline.heroMight + 2);
	expect(weaponPickup.infoHTML).toContain('Serrated Spatula');

	// Verify save/load persistence of equipped gear
	const persist = await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		const hero = window.DungeonHeroes[F.minigame.selectedHero];
		const saveStr = F.minigame.save();

		// Reset gear
		hero.gear.armor = -1;
		hero.gear.weapon = -1;

		// Reload save string
		F.minigame.load(saveStr);

		return {
			loadedArmor: hero.gear.armor,
			loadedWeapon: hero.gear.weapon,
		};
	});

	expect(persist.loadedArmor).toBe(2);
	expect(persist.loadedWeapon).toBe(1);
});

test('dungeon run speed is greatly slowed down and has a speed toggle badge', async ({ page }) => {
	await boot(page);
	await loadDungeon(page);

	// Open the minigame panel so the dungeon Draw() populates the DOM.
	await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		if (F.switchMinigame) {
			F.switchMinigame(1);
			if (F.refresh) F.refresh();
		}
	});

	const badgeId = await page.evaluate(() => 'dungeonSpeed' + window.Game.Objects['Factory'].id);
	const badge = page.locator('#' + badgeId);
	await expect(badge).toBeVisible();
	await expect(badge).toHaveText('SPEED: 1x');

	// Verify autoTimer pacing is greatly slowed down:
	// At base hero speed 5, step interval is >= 60 frames (2.0s at 30fps),
	// whereas previously it was only 30 frames (1.0s) or 3 frames (100ms) with gear.
	const stepTimer = await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		const d = F.dungeon;
		const M = F.minigame;
		d.auto = true;
		d.autoWarmup = 0;
		d.autoTimer = 0;
		// Trigger logic tick which calculates the next autoTimer
		M.logic();
		return d.autoTimer;
	});
	expect(stepTimer).toBeGreaterThanOrEqual(40); // At least 1.3s even on high-speed heroes (vs old 6 frames / 200ms)

	// Click to cycle speed mode to 0.5x
	await page.evaluate(() => window.Game.CloseNotes());
	await badge.click({ force: true });
	await expect(badge).toHaveText('SPEED: 0.5x');

	// Click again to cycle to 2x
	await page.evaluate(() => window.Game.CloseNotes());
	await badge.click({ force: true });
	await expect(badge).toHaveText('SPEED: 2x');

	// Click again to cycle back to 1x
	await page.evaluate(() => window.Game.CloseNotes());
	await badge.click({ force: true });
	await expect(badge).toHaveText('SPEED: 1x');
});

test('closing the dungeon screen mutes audio while auto-explore continues running in background', async ({ page }) => {
	await boot(page);
	await loadDungeon(page);

	// Start with dungeon open, auto enabled
	await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		if (F.switchMinigame) {
			F.switchMinigame(1);
			if (F.refresh) F.refresh();
		}
		const d = F.dungeon;
		d.auto = true;
	});

	// Track all calls to PlaySound
	await page.evaluate(() => {
		window.__dungeonSoundsPlayed = [];
		const origPlaySound = window.PlaySound;
		window.PlaySound = function (url, vol) {
			window.__dungeonSoundsPlayed.push({ url, vol });
			return origPlaySound ? origPlaySound(url, vol) : undefined;
		};
	});

	// Close the dungeon screen (switchMinigame(0))
	await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		if (F.switchMinigame) {
			F.switchMinigame(0);
		}
	});

	// Verify the dungeon screen is reported closed
	const isClosed = await page.evaluate(() => !window.Game.Objects['Factory'].onMinigame);
	expect(isClosed).toBe(true);

	// Let auto run in background for several steps while closed
	const runStats = await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		const d = F.dungeon;
		const M = F.minigame;
		const startX = d.hero.x;
		const startY = d.hero.y;
		const startLevel = d.level;

		// Simulate background ticks
		for (let i = 0; i < 30; i++) {
			d.autoTimer = 0;
			M.logic();
		}

		return {
			auto: d.auto,
			moved: (d.hero.x !== startX || d.hero.y !== startY || d.level !== startLevel),
			soundsCount: window.__dungeonSoundsPlayed.length,
		};
	});

	// Assert auto was retained and hero progressed in the background
	expect(runStats.auto).toBe(true);
	expect(runStats.moved).toBe(true);

	// Assert audio was completely muted during background execution
	expect(runStats.soundsCount).toBe(0);

	// Reopen the dungeon screen
	await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		if (F.switchMinigame) {
			F.switchMinigame(1);
		}
	});

	const isOpen = await page.evaluate(() => window.Game.Objects['Factory'].onMinigame);
	expect(Boolean(isOpen)).toBe(true);
});



