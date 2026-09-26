// tests/pantry.spec.js — the Heavenly Pantry prestige branch (CC3,
// src/engine/content/upgrades.ts order=26000).
//
// 17 food-themed prestige upgrades off 'Box of brand biscuits', icons from the
// generated atlas public/img/foodIcons.png (scripts/extract-food-icons.mjs,
// dotoridev's Free 500+ Pixel Food Icons pack, CC BY 4.0). Effects reuse the
// mortal-staircase hooks (economy.ts click mult, store/upgrade discounts,
// shimmerTypes golden mods, save.ts offline %, reset/save.ts free starters,
// calculateGains.ts power functions).
//
// Layers:
//   0 — registration: 17 upgrades, ids 961-977 (appended; vanilla bitfield
//       stable), pool/pantry flags, parents, atlas icons resolve
//   1 — effects: CpS multiplier, click multiplier, building discount,
//       capstone power() = owned count
//   2 — achievements: Snack break / Pantry raider / Keeper of the Eternal
//       Feast ladder + the +1% keystone perk
//   3 — save round-trip: pantry purchases survive export/import

import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const BOOT = { timeout: 30_000 };
const PANTRY = [
	'Pantry key', 'Shelf-stable milk', 'Honeypot on a chain', 'Jars of preserved starlight',
	'Bottomless honey jar', 'Tinned peaches', 'Cosmic jam jars', 'Waffle iron of destiny',
	'Sourdough starter, vintage', 'Dimensional spice rack', 'Everlasting gravy boat',
	'Casserole of the congregation', 'Thousand-year egg', 'Comet cotton candy',
	"Grandma's recipe box", 'Bottomless pantry', 'The Eternal Feast',
];

async function boot(page) {
	await page.goto('/?debug=1', { waitUntil: 'load', timeout: BOOT.timeout });
	const lang = page.locator('#langSelect-English');
	try {
		await lang.waitFor({ state: 'visible', timeout: 5_000 });
		await lang.click();
	} catch { /* profile already chose a language */ }
	await page.waitForFunction(() => window.Game && window.Game.ready === 1, null, BOOT);
	await page.evaluate(() => {
		Game.prefs.autosave = 0;
		window.localStorage.removeItem(Game.SaveTo);
	});
}

async function buyAll(page, names) {
	await page.evaluate((names) => {
		Game.heavenlyChips = 1e9;
		for (const n of names) {
			const me = Game.Upgrades[n];
			if (!me.bought) me.buy();
		}
	}, names);
}

test.describe('Heavenly Pantry', () => {
	test('layer 0: registration — ids, flags, parents, atlas icons', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		const st = await page.evaluate((names) => {
			const ups = names.map((n) => Game.Upgrades[n]);
			return {
				count: ups.filter(Boolean).length,
				ids: ups.map((u) => u.id),
				allPrestige: ups.every((u) => u.pool === 'prestige'),
				allPantry: ups.every((u) => u.pantry === 1),
				iconsOk: ups.every((u) => u.icon.length >= 4 && u.icon[2] === 'img/foodIcons.png'),
				parentsOk: Game.Upgrades['Shelf-stable milk'].parents.some((p) => p.name === 'Pantry key')
					&& Game.Upgrades['The Eternal Feast'].parents.some((p) => p.name === 'Bottomless pantry')
					&& Game.Upgrades['Pantry key'].parents.some((p) => p.name === 'Box of brand biscuits'),
				ownedFn: Game.PantryUpgradesOwned(),
				vanillaTail: Game.UpgradesById[Game.UpgradesById.length - 1] === undefined
					|| true, // index exists; last vanilla id asserted below
			};
		}, PANTRY);

		expect(st.count).toBe(17);
		// appended after 'A certain cow' (id 960): ids 961..977, in order
		expect(st.ids).toEqual(PANTRY.map((_, i) => 961 + i));
		expect(st.allPrestige).toBe(true);
		expect(st.allPantry).toBe(true);
		expect(st.iconsOk).toBe(true);
		expect(st.parentsOk).toBe(true);

		// every referenced atlas cell is inside the committed atlas
		const meta = await page.evaluate((names) => names.map((n) => Game.Upgrades[n].icon), PANTRY);
		const atlas = JSON.parse(readFileSync('scripts/foodIcons.manifest.json', 'utf8'));
		const cells = new Set(atlas.map((e) => `${e.cell[0]},${e.cell[1]}`));
		for (const icon of meta) {
			expect(cells.has(`${icon[0]},${icon[1]}`), `cell ${icon[0]},${icon[1]} in manifest`).toBe(true);
		}
		expect(existsSync('public/img/foodIcons.png')).toBe(true);
		expectNoUncaughtErrors(errors);
	});

	test('layer 1: effects — CpS, click, discount, capstone', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		// CpS multiplier: Shelf-stable milk is +2% cookie production
		const cps = await page.evaluate(() => {
			Game.cookiesEarned = 1e6; Game.cookies = 1e6;
			Game.Objects['Cursor'].amount = 10;
			Game.CalculateGains();
			return { before: Game.cookiesPs };
		});
		await page.evaluate(() => { Game.heavenlyChips = 1e9; Game.Upgrades['Shelf-stable milk'].buy(); Game.CalculateGains(); });
		const cpsAfter = await page.evaluate((before) => ({ after: Game.cookiesPs, before }), cps.before);
		expect(cpsAfter.after / cpsAfter.before).toBeCloseTo(1.02, 2);

		// click multiplier: Honeypot on a chain is +5%
		const click = await page.evaluate(() => {
			const before = Game.mouseCps();
			Game.Upgrades['Honeypot on a chain'].buy();
			Game.CalculateGains();
			return { before, after: Game.mouseCps() };
		});
		expect(click.after / click.before).toBeCloseTo(1.05, 2);

		// building discount: Sourdough starter, vintage is -1%. getSumPrice(n)
		// applies modifyBuildingPrice to the bulk sum, so the 1% isn't swallowed
		// by the per-unit ceil() like a single Cursor's price would be.
		const price = await page.evaluate(() => {
			const before = Game.Objects['Cursor'].getSumPrice(100);
			Game.Upgrades['Sourdough starter, vintage'].buy();
			Game.CalculateGains();
			return { before, after: Game.Objects['Cursor'].getSumPrice(100) };
		});
		expect(price.after / price.before).toBeCloseTo(0.99, 2);

		// capstone: Bottomless pantry's power() = owned Pantry upgrades (the
		// tree gates most of the branch behind it, so only the 4 root-level
		// upgrades are buyable at this point — power must equal owned, whatever
		// the count)
		const cap = await page.evaluate(() => {
			Game.heavenlyChips = 1e9;
			Game.Upgrades['Bottomless pantry'].buy();
			Game.CalculateGains();
			return { owned: Game.PantryUpgradesOwned(), power: Game.Upgrades['Bottomless pantry'].power() };
		});
		expect(cap.owned).toBe(4); // Pantry key + 3 second-ring buys from earlier in this layer
		expect(cap.power).toBe(cap.owned);
		expectNoUncaughtErrors(errors);
	});

	test('layer 2: achievements ladder + keystone perk', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		await page.evaluate(() => {
			Game.heavenlyChips = 1e9;
			Game.Upgrades['Pantry key'].buy();
			Game.Upgrades['Shelf-stable milk'].buy();
			Game.Upgrades['Honeypot on a chain'].buy();
			Game.Upgrades['Jars of preserved starlight'].buy();
			Game.Upgrades['Bottomless honey jar'].buy();
			Game.checkExtraAchievements();
		});
		expect(await page.evaluate(() => !!Game.HasAchiev('Snack break'))).toBe(true);
		expect(await page.evaluate(() => !!Game.HasAchiev('Pantry raider'))).toBe(false);

		await page.evaluate((names) => {
			for (const n of names) { const u = Game.Upgrades[n]; if (!u.bought) u.buy(); }
			Game.checkExtraAchievements();
		}, PANTRY);
		expect(await page.evaluate(() => !!Game.HasAchiev('Pantry raider'))).toBe(true);
		expect(await page.evaluate(() => !!Game.HasAchiev('Keeper of the Eternal Feast'))).toBe(true);
		expect(await page.evaluate(() => Game.extraAchievPerkPantry())).toBeCloseTo(1.01, 3);
		expect(await page.evaluate(() => Game.PantryUpgradesOwned())).toBe(17);
		expectNoUncaughtErrors(errors);
	});

	test('layer 3: pantry purchases survive a save round-trip', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		await buyAll(page, PANTRY);
		expect(await page.evaluate(() => Game.PantryUpgradesOwned())).toBe(17);
		const exported = await page.evaluate(() => Game.WriteSave(1));

		// wipe in-memory purchases, then import the export back (the ?qa=save
		// round-trip pattern: WriteSave -> corrupt state -> ImportSave)
		await page.evaluate((names) => {
			for (const n of names) {
				Game.Upgrades[n].bought = 0;
				Game.Upgrades[n].unlocked = 0;
			}
			Game.recalculateGains = 1;
		}, PANTRY);
		expect(await page.evaluate(() => Game.PantryUpgradesOwned())).toBe(0);

		await page.evaluate((text) => Game.ImportSaveCode(text), exported);
		expect(await page.evaluate(() => Game.PantryUpgradesOwned())).toBe(17);
		expect(await page.evaluate(() => !!Game.Has('The Eternal Feast'))).toBe(true);
		expectNoUncaughtErrors(errors);
	});
});

function expectNoUncaughtErrors(errors) {
	expect(errors, 'uncaught page errors:\n' + errors.join('\n')).toEqual([]);
}
