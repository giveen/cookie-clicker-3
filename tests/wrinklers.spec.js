import { expect, test } from '@playwright/test';

const BOOT = { timeout: 30_000 };

async function boot(page) {
	await page.goto('/?debug=1', { waitUntil: 'load', timeout: BOOT.timeout });
	const lang = page.locator('#langSelect-English');
	try {
		await lang.waitFor({ state: 'visible', timeout: 5_000 });
		await lang.click();
	} catch {
		/* no language prompt */
	}
	await page.waitForFunction(() => window.Game && window.Game.ready === 1, null, BOOT);
}

test.describe('Wrinklers System', () => {
	test('capacity expands to 12 with Elder spice and 13 with Bloodless ichor', async ({ page }) => {
		await boot(page);

		const capacities = await page.evaluate(() => {
			const Game = window.Game;
			// Base
			const baseMax = Game.getWrinklersMax();

			// Elder spice (+2)
			Game.Upgrades['Elder spice'].earn();
			const spiceMax = Game.getWrinklersMax();

			// Bloodless ichor (+1)
			Game.Upgrades['Bloodless ichor'].earn();
			const ichorMax = Game.getWrinklersMax();

			return {
				baseMax,
				spiceMax,
				ichorMax,
				arrayLength: Game.wrinklers.length,
			};
		});

		expect(capacities.baseMax).toBe(10);
		expect(capacities.spiceMax).toBe(12);
		expect(capacities.ichorMax).toBe(13);
		expect(capacities.arrayLength).toBeGreaterThanOrEqual(13);
	});

	test('all 13 wrinklers can spawn, reach phase 2, and wither CpS', async ({ page }) => {
		await boot(page);

		const result = await page.evaluate(() => {
			const Game = window.Game;
			Game.elderWrath = 3;
			Game.Upgrades['Elder spice'].earn();
			Game.Upgrades['Bloodless ichor'].earn();

			// Spawn until capacity is full
			for (let i = 0; i < 20; i++) {
				Game.SpawnWrinkler();
			}

			// Advance phase to 2 (attached and eating)
			for (let i = 0; i < Game.wrinklers.length; i++) {
				if (Game.wrinklers[i].phase > 0) {
					Game.wrinklers[i].phase = 2;
					Game.wrinklers[i].close = 1;
				}
			}

			// Compute gains with 13 active wrinklers
			Game.cookiesPs = 1000;
			Game.CalculateGains();

			const activeWrinklers = Game.wrinklers.filter(w => w.phase === 2);
			const maxCapacity = Game.getWrinklersMax();

			return {
				maxCapacity,
				activeCount: activeWrinklers.length,
				cpsSucked: Game.cpsSucked,
				activeIndices: activeWrinklers.map(w => w.id),
			};
		});

		expect(result.maxCapacity).toBe(13);
		expect(result.activeCount).toBe(13);
		// 13 active wrinklers each suck 5% (0.05) -> 13 * 0.05 = 0.65 of CpS
		expect(result.cpsSucked).toBeCloseTo(0.65, 3);
		expect(result.activeIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
	});

	test('popping wrinklers returns sucked cookies with multiplier, and shiny awards achievement', async ({ page }) => {
		await boot(page);

		const result = await page.evaluate(() => {
			const Game = window.Game;
			Game.cookies = 0;
			Game.cookiesEarned = 0;
			Game.ResetWrinklers();

			// Test normal wrinkler popping
			const normalW = Game.wrinklers[0];
			normalW.phase = 2;
			normalW.sucked = 1000;
			normalW.type = 0;
			normalW.hp = 0; // ready to pop

			// Update wrinklers processes hp <= 0
			Game.UpdateWrinklers();
			const cookiesAfterNormal = Game.cookies;

			// Now test shiny wrinkler
			Game.cookies = 0;
			const shinyW = Game.wrinklers[1];
			shinyW.phase = 2;
			shinyW.sucked = 1000;
			shinyW.type = 1; // Shiny
			shinyW.hp = 0;

			Game.UpdateWrinklers();
			const cookiesAfterShiny = Game.cookies;
			const hasShinyAchievement = Game.HasAchiev('Last Chance to See');

			return {
				cookiesAfterNormal,
				cookiesAfterShiny,
				hasShinyAchievement,
			};
		});

		expect(result.cookiesAfterNormal).toBeCloseTo(1100);
		// Shiny has 3x multiplier -> 1000 * 1.1 * 3 = 3300
		expect(result.cookiesAfterShiny).toBeCloseTo(3300);
		expect(result.hasShinyAchievement).toBe(1);
	});

	test('save and load preserves 13 wrinklers and shiny states accurately', async ({ page }) => {
		await boot(page);

		const result = await page.evaluate(() => {
			const Game = window.Game;
			Game.Upgrades['Elder spice'].earn();
			Game.Upgrades['Bloodless ichor'].earn();
			Game.ResetWrinklers();

			// Setup 13 active wrinklers (12 normal with 100 sucked, 1 shiny with 500 sucked)
			for (let i = 0; i < 12; i++) {
				Game.wrinklers[i].phase = 2;
				Game.wrinklers[i].close = 1;
				Game.wrinklers[i].sucked = 100;
				Game.wrinklers[i].type = 0;
			}
			Game.wrinklers[12].phase = 2;
			Game.wrinklers[12].close = 1;
			Game.wrinklers[12].sucked = 500;
			Game.wrinklers[12].type = 1;

			// Save wrinklers
			const saved = Game.SaveWrinklers();

			// Reset wrinklers
			Game.ResetWrinklers();

			// Load wrinklers
			Game.LoadWrinklers(saved.amount, saved.number, saved.shinies, saved.amountShinies);

			const loadedActive = Game.wrinklers.filter(w => w.phase === 2);
			const loadedShinies = Game.wrinklers.filter(w => w.phase === 2 && w.type === 1);
			const loadedNormal = Game.wrinklers.filter(w => w.phase === 2 && w.type === 0);

			return {
				savedNumber: saved.number,
				savedShinies: saved.shinies,
				savedAmount: saved.amount,
				savedAmountShinies: saved.amountShinies,
				loadedActiveCount: loadedActive.length,
				loadedShiniesCount: loadedShinies.length,
				loadedNormalCount: loadedNormal.length,
				normalSucked: loadedNormal[0].sucked,
				shinySucked: loadedShinies[0].sucked,
			};
		});

		expect(result.savedNumber).toBe(13);
		expect(result.savedShinies).toBe(1);
		expect(result.savedAmount).toBe(1200);
		expect(result.savedAmountShinies).toBe(500);
		expect(result.loadedActiveCount).toBe(13);
		expect(result.loadedShiniesCount).toBe(1);
		expect(result.loadedNormalCount).toBe(12);
		expect(result.normalSucked).toBe(100);
		expect(result.shinySucked).toBe(500);
	});
});
