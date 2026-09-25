// tests/seasons.spec.js — season lifecycle, natural expiration, manual cancellation, and switching.

import { expect, test } from '@playwright/test';

const BOOT = { timeout: 30_000 };

async function boot(page) {
	await page.goto('/?debug=1', { waitUntil: 'load', timeout: BOOT.timeout });
	const lang = page.locator('#langSelect-English');
	try {
		await lang.waitFor({ state: 'visible', timeout: 5_000 });
		await lang.click();
	} catch {
		/* no language prompt (a profile already chose one) */
	}
	await page.waitForFunction(() => window.Game && window.Game.ready === 1, null, BOOT);
}

function expectNoUncaughtErrors(errors) {
	expect(errors, 'uncaught page errors:\n' + errors.join('\n')).toEqual([]);
}

test.describe('Seasons lifecycle', () => {
	test('natural timer expiration cleanly resets season, unearns biscuit, and reverts state', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		const result = await page.evaluate(() => {
			const G = window.Game;
			G.baseSeason = '';
			G.cookies = 1e12;
			G.cookiesEarned = 1e12;

			// Give Season switcher heavenly upgrade
			G.Upgrades['Season switcher'].earn();
			for (const s in G.seasons) {
				G.Unlock(G.seasons[s].trigger);
			}

			// Buy Christmas
			const festive = G.Upgrades['Festive biscuit'];
			festive.buy(1);

			const beforeExpire = {
				season: G.season,
				seasonT: G.seasonT,
				festiveBought: festive.bought,
			};

			// Simulate timer running down to 1 tick
			G.seasonT = 1;
			G.Logic(); // Decrements to 0 and triggers expiration

			const afterExpire = {
				season: G.season,
				seasonT: G.seasonT,
				festiveBought: festive.bought,
				festiveUnlocked: festive.unlocked,
			};

			return { beforeExpire, afterExpire };
		});

		expectNoUncaughtErrors(errors);
		expect(result.beforeExpire.season).toBe('christmas');
		expect(result.beforeExpire.festiveBought).toBe(1);

		expect(result.afterExpire.season).toBe('');
		expect(result.afterExpire.seasonT).toBe(-1);
		expect(result.afterExpire.festiveBought).toBe(0);
		expect(result.afterExpire.festiveUnlocked).toBe(1);
	});

	test('manual cancellation cleanly ends season and unlocks biscuit', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		const result = await page.evaluate(() => {
			const G = window.Game;
			G.baseSeason = '';
			G.cookies = 1e12;
			G.cookiesEarned = 1e12;

			G.Upgrades['Season switcher'].earn();
			for (const s in G.seasons) {
				G.Unlock(G.seasons[s].trigger);
			}

			// Buy Valentines
			const lovesick = G.Upgrades['Lovesick biscuit'];
			lovesick.buy(1);

			const beforeCancel = {
				season: G.season,
				seasonT: G.seasonT,
				lovesickBought: lovesick.bought,
			};

			// Click again to cancel
			lovesick.buy();

			const afterCancel = {
				season: G.season,
				seasonT: G.seasonT,
				lovesickBought: lovesick.bought,
				lovesickUnlocked: lovesick.unlocked,
			};

			return { beforeCancel, afterCancel };
		});

		expectNoUncaughtErrors(errors);
		expect(result.beforeCancel.season).toBe('valentines');
		expect(result.beforeCancel.lovesickBought).toBe(1);

		expect(result.afterCancel.season).toBe('');
		expect(result.afterCancel.seasonT).toBe(-1);
		expect(result.afterCancel.lovesickBought).toBe(0);
		expect(result.afterCancel.lovesickUnlocked).toBe(1);
	});

	test('switching from one season directly to another updates both biscuits', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		const result = await page.evaluate(() => {
			const G = window.Game;
			G.baseSeason = '';
			G.cookies = 1e12;
			G.cookiesEarned = 1e12;

			G.Upgrades['Season switcher'].earn();
			for (const s in G.seasons) {
				G.Unlock(G.seasons[s].trigger);
			}

			// Buy Easter
			const bunny = G.Upgrades['Bunny biscuit'];
			bunny.buy(1);

			const inEaster = {
				season: G.season,
				bunnyBought: bunny.bought,
			};

			// Directly buy Halloween
			const ghostly = G.Upgrades['Ghostly biscuit'];
			ghostly.buy(1);

			const inHalloween = {
				season: G.season,
				bunnyBought: bunny.bought,
				bunnyUnlocked: bunny.unlocked,
				ghostlyBought: ghostly.bought,
			};

			return { inEaster, inHalloween };
		});

		expectNoUncaughtErrors(errors);
		expect(result.inEaster.season).toBe('easter');
		expect(result.inEaster.bunnyBought).toBe(1);

		expect(result.inHalloween.season).toBe('halloween');
		expect(result.inHalloween.bunnyBought).toBe(0);
		expect(result.inHalloween.bunnyUnlocked).toBe(1);
		expect(result.inHalloween.ghostlyBought).toBe(1);
	});
});
