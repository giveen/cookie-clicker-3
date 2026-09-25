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

test.describe('Stock Market Opportunity System', () => {
	test('Opportunity slot scaling by office level', async ({ page }) => {
		await boot(page);

		const slots = await page.evaluate(async () => {
			const G = window.Game;
			const bank = G.Objects['Bank'];
			bank.amount = 50;
			bank.level = 1;
			if (!bank.minigameLoaded && G.LoadMinigames) G.LoadMinigames();

			while (!bank.minigameLoaded) {
				await new Promise(r => setTimeout(r, 50));
			}

			const M = bank.minigame;

			const officeSlots = [];
			for (let lvl = 0; lvl <= 5; lvl++) {
				M.officeLevel = lvl;
				officeSlots.push(M.getOppSlots());
			}

			return officeSlots;
		});

		// Level 0: 0 slots
		// Level 1, 2: 1 slot
		// Level 3, 4: 2 slots
		// Level 5: 3 slots
		expect(slots).toEqual([0, 1, 1, 2, 2, 3]);
	});

	test('Opportunity generation, execution, and cooldown trigger', async ({ page }) => {
		await boot(page);

		const result = await page.evaluate(async () => {
			const G = window.Game;
			const bank = G.Objects['Bank'];
			bank.amount = 100;
			bank.level = 5;
			G.Objects['Cursor'].amount = 500;
			G.Objects['Cursor'].level = 12;
			G.cookiesPsRawHighest = 100000;
			G.cookies = 100000000;

			if (!bank.minigameLoaded && G.LoadMinigames) G.LoadMinigames();
			while (!bank.minigameLoaded) {
				await new Promise(r => setTimeout(r, 50));
			}

			const M = bank.minigame;
			M.officeLevel = 5; // Palace of Greed (3 slots)
			M.oppT = 0; // Ready

			// Generate opportunities
			M.generateOpportunities();
			const choicesCount = M.currentOpps.length;
			const choicesOpen = M.oppChoicesOpen;

			// Verify cards rendered in modal
			const modalDisplayed = document.getElementById('bankOppModal').style.display !== 'none';

			// Execute first opportunity
			const firstOppTitle = M.currentOpps[0].title;
			M.executeOpportunity(0);

			const oppsAfterExecution = M.currentOpps.length;
			const cooldownActive = M.oppT > Date.now();
			const modalHiddenAfterExec = document.getElementById('bankOppModal').style.display === 'none';

			return {
				choicesCount,
				choicesOpen,
				modalDisplayed,
				firstOppTitle,
				oppsAfterExecution,
				cooldownActive,
				modalHiddenAfterExec,
			};
		});

		expect(result.choicesCount).toBe(3);
		expect(result.choicesOpen).toBe(true);
		expect(result.modalDisplayed).toBe(true);
		expect(result.oppsAfterExecution).toBe(0);
		expect(result.cooldownActive).toBe(true);
		expect(result.modalHiddenAfterExec).toBe(true);
	});

	test('Opportunity cooldown persists across save and load', async ({ page }) => {
		await boot(page);

		const result = await page.evaluate(async () => {
			const G = window.Game;
			const bank = G.Objects['Bank'];
			bank.amount = 100;
			bank.level = 2;
			if (!bank.minigameLoaded && G.LoadMinigames) G.LoadMinigames();
			while (!bank.minigameLoaded) {
				await new Promise(r => setTimeout(r, 50));
			}

			const M = bank.minigame;
			const futureCooldown = Date.now() + 1800000; // 30 min cooldown
			M.oppT = futureCooldown;

			const saved = M.save();
			M.oppT = 0;
			M.load(saved);

			return {
				restoredOppT: M.oppT,
				expectedOppT: futureCooldown,
			};
		});

		expect(Math.abs(result.restoredOppT - result.expectedOppT)).toBeLessThan(100);
	});

	test('Sugar lump refilled timer resets cooldown and grants economic burst', async ({ page }) => {
		await boot(page);

		const result = await page.evaluate(async () => {
			const G = window.Game;
			const bank = G.Objects['Bank'];
			bank.amount = 100;
			bank.level = 2;
			G.lumps = 10;
			G.lumpRefill = 0;
			G.cookiesPsRawHighest = 1000000;
			const initialCookies = G.cookies;

			if (!bank.minigameLoaded && G.LoadMinigames) G.LoadMinigames();
			while (!bank.minigameLoaded) {
				await new Promise(r => setTimeout(r, 50));
			}

			const M = bank.minigame;
			M.oppT = Date.now() + 3600000; // 1 hour in future

			// Click lump refill button
			const refillBtn = document.getElementById('bankLumpRefill');
			refillBtn.click();

			return {
				oppTAfterRefill: M.oppT,
				lumpsRemaining: G.lumps,
				cookiesGained: G.cookies - initialCookies,
			};
		});

		expect(result.oppTAfterRefill).toBe(0);
		expect(result.lumpsRemaining).toBe(9);
		// 10 minutes of highest raw CpS = 1,000,000 * 60 * 10 = 600,000,000
		expect(result.cookiesGained).toBeGreaterThanOrEqual(600_000_000);
	});
});
