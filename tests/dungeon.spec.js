// Factory Dungeon minigame — functional coverage (Tier 2).
//
// Boots the production build in headless Chromium, force-loads the Factory
// minigame (it unlocks at Factory level 1), and asserts the dungeon behaves:
//   1. the minigame loads with a hero, generated map, entrance and exit;
//   2. hero selection swaps the live hero and persists on the minigame;
//   3. auto-explore (BFS pathing, throttled) actually drives the hero to the
//      exit and clears a floor (level increases);
//   4. the relic economy grants relics (boss/loot path) and save/load round-trips
//      relics + the selected hero;
//   5. the visible auto-explore indicator badge reflects the auto state.
//
// Each test re-boots fresh so state never leaks between them.
// Run: npx playwright test tests/dungeon.spec.js
import { test, expect } from '@playwright/test';

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

/** Force the Factory minigame to load: unlock the building, then LoadMinigames. */
async function loadDungeon(page) {
	await page.evaluate(() => {
		const G = window.Game;
		G.cookies += 1e15;
		const f = G.Objects['Factory'];
		f.amount = 1;
		f.unlocked = 1;
		f.bought = 1;
		f.highest = 1;
		f.level = 1;
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
	// No buffing: this is a balance assertion. A freshly unlocked Factory (amount 1)
	// must not be blocked by an unbeatable boss on floor 1 — the hero should clear
	// at least one floor and win fights along the way.
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

test('visible auto-explore indicator reflects the auto state', async ({ page }) => {
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
	await expect(page.locator('#' + badgeId)).toBeVisible({ timeout: 10_000 });

	const on = await page.evaluate((id) => {
		const el = document.getElementById(id);
		return { display: el.style.display, auto: window.Game.Objects['Factory'].dungeon.auto };
	}, badgeId);
	expect(on.auto).toBe(true);
	expect(on.display).toBe('block');

	// Turn auto off and redraw — the badge must hide.
	await page.evaluate(() => {
		const F = window.Game.Objects['Factory'];
		F.dungeon.auto = false;
		F.minigame.draw();
	});
	const off = await page.evaluate((id) => document.getElementById(id).style.display, badgeId);
	expect(off).toBe('none');
});
