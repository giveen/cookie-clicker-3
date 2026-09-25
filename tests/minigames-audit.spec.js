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

test.describe('Minigames Audit Fixes', () => {
	test('Pantheon restores multiple worship swaps on offline elapsed time', async ({ page }) => {
		await boot(page);

		const result = await page.evaluate(async () => {
			const G = window.Game;
			const temple = G.Objects['Temple'];
			temple.amount = 100;
			temple.level = 1;
			if (!temple.minigameLoaded && G.LoadMinigames) G.LoadMinigames();

			// Wait for minigame to load
			while (!temple.minigameLoaded) {
				await new Promise(r => setTimeout(r, 50));
			}

			const M = temple.minigame;

			// Scenario 1: 0 swaps, 22 hours pass (0->1 is 16h, 1->2 is 4h, 2->3 is 1h => 21h total)
			M.swaps = 0;
			M.swapT = Date.now() - (22 * 3600 * 1000);
			M.logic();
			const swapsAfter22h = M.swaps;

			// Scenario 2: 0 swaps, 18 hours pass (16h gets 1st swap, remaining 2h < 4h so sits at 1 swap)
			M.swaps = 0;
			M.swapT = Date.now() - (18 * 3600 * 1000);
			M.logic();
			const swapsAfter18h = M.swaps;

			// Scenario 3: 1 swap, 5 hours pass (1->2 is 4h, 2->3 is 1h => 5h gets both)
			M.swaps = 1;
			M.swapT = Date.now() - (5 * 3600 * 1000);
			M.logic();
			const swapsAfter5h = M.swaps;

			return {
				swapsAfter22h,
				swapsAfter18h,
				swapsAfter5h,
			};
		});

		expect(result.swapsAfter22h).toBe(3);
		expect(result.swapsAfter18h).toBe(1);
		expect(result.swapsAfter5h).toBe(3);
	});

	test('Grimoire Resurrect Abomination tooltip explains requirements', async ({ page }) => {
		await boot(page);

		const desc = await page.evaluate(async () => {
			const G = window.Game;
			const wiz = G.Objects['Wizard tower'];
			wiz.amount = 100;
			wiz.level = 1;
			if (!wiz.minigameLoaded && G.LoadMinigames) G.LoadMinigames();

			while (!wiz.minigameLoaded) {
				await new Promise(r => setTimeout(r, 50));
			}

			const M = wiz.minigame;
			return M.spells['resurrect abomination'].desc;
		});

		expect(desc).toContain('requires active Grandmapocalypse and wrinkler capacity');
	});

	test('Grandma Sitting Room accumulates offline yarn based on activity rate', async ({ page }) => {
		await boot(page);

		const result = await page.evaluate(async () => {
			const G = window.Game;
			const gm = G.Objects['Grandma'];
			gm.amount = 100;
			gm.level = 1;
			if (!gm.minigameLoaded && G.LoadMinigames) G.LoadMinigames();

			while (!gm.minigameLoaded) {
				await new Promise(r => setTimeout(r, 50));
			}

			const M = gm.minigame;
			M.yarn = 50;
			M.yarnEarned = 50;
			// Assign cozy activities: seat 0 (knitting = 0.02), seat 1 (tea = 0.03)
			M.seats[0] = 0;
			M.seats[1] = 1;
			M.computeEffs();

			const rate = M.yarnPerSecond();

			// Simulate saving 2 hours ago (7200 seconds)
			const fakePastTime = Date.now() - (7200 * 1000);
			const savedStr = `${M.yarn} ${M.yarnEarned} ${M.seats.join(':')} ${M.upgradeStacks.join(':')} ${fakePastTime}`;

			// Load the save
			M.yarn = 0;
			M.yarnEarned = 0;
			M.load(savedStr);

			return {
				rate,
				loadedYarn: M.yarn,
				loadedEarned: M.yarnEarned,
			};
		});

		const expectedOfflineYarn = 50 + Math.floor(7200 * result.rate);
		expect(result.loadedYarn).toBe(expectedOfflineYarn);
		expect(result.loadedEarned).toBe(expectedOfflineYarn);
	});
});
