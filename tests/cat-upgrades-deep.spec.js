// Deeper diagnostic: Cat upgrade unlock timing and store visibility
import { test, expect } from '@playwright/test';

const BOOT = { timeout: 30_000 };

async function boot(page) {
	await page.goto('/?debug=1', { waitUntil: 'load' });
	const lang = page.locator('#langSelect-English');
	try {
		await lang.waitFor({ state: 'visible', timeout: 5_000 });
		await lang.click();
	} catch { /* no language prompt */ }
	await page.waitForFunction(() => window.Game && window.Game.ready === 1, null, BOOT);
}

test('Cat upgrade unlock thresholds match tier definitions', async ({ page }) => {
	await boot(page);

	const result = await page.evaluate(() => {
		const cats = Game.Objects['Cats'];
		const issues = [];

		// Check base upgrades
		for (let i = 1; i <= 14; i++) {
			const tierKey = 'cat' + i;
			const tier = Game.Tiers[tierKey];
			const upg = cats.tieredUpgrades[tierKey];
			if (!tier) { issues.push(`Missing tier ${tierKey}`); continue; }
			if (!upg) { issues.push(`Missing tiered upgrade for ${tierKey}`); continue; }
			if (upg.tier !== tierKey) issues.push(`${tierKey}: upgrade.tier=${upg.tier} !== ${tierKey}`);
			if (upg.buildingTie !== cats) issues.push(`${tierKey}: buildingTie is wrong`);
			if (typeof upg.catAdd !== 'number') issues.push(`${tierKey}: missing catAdd property`);
			if (!upg.name) issues.push(`${tierKey}: missing name`);
		}

		// Check specialty upgrades
		for (let i = 1; i <= 10; i++) {
			const tierKey = 'catS' + i;
			const tier = Game.Tiers[tierKey];
			const upg = cats.tieredUpgrades[tierKey];
			if (!tier) { issues.push(`Missing tier ${tierKey}`); continue; }
			if (!upg) { issues.push(`Missing tiered upgrade for ${tierKey}`); continue; }
			if (upg.tier !== tierKey) issues.push(`${tierKey}: upgrade.tier=${upg.tier} !== ${tierKey}`);
			if (upg.buildingTie !== cats) issues.push(`${tierKey}: buildingTie is wrong`);
		}

		// Check all tiered upgrades have matching unlock thresholds
		const catUpgradeUnlocks = [
			[10,'Grandma-approved recipes'],[25,'Purrfect timing'],[50,'Cat café loyalty'],
			[75,'Protein-rich kibble'],[100,'Feather wand drills'],[150,'Sunbeam perches'],
			[200,'Catnip cultivation'],[250,'Scratching-post ovens'],[350,'Climbing shelves'],
			[450,'Nine lives logistics']
		];

		for (const [threshold, name] of catUpgradeUnlocks) {
			const upg = Game.Upgrades[name];
			if (!upg) { issues.push(`Missing upgrade ${name}`); continue; }
			if (!upg.tier) { issues.push(`${name}: missing tier`); continue; }
			const tier = Game.Tiers[upg.tier];
			if (!tier) { issues.push(`${name}: tier ${upg.tier} not in Game.Tiers`); continue; }
			if (tier.unlock !== threshold) issues.push(`${name}: tier.unlock=${tier.unlock} !== expected ${threshold}`);
		}

		return { issues, tieredUpgradesCount: Object.keys(cats.tieredUpgrades).length };
	});

	console.log('Issues:', JSON.stringify(result, null, 2));
	expect(result.issues).toEqual([]);
	expect(result.tieredUpgradesCount).toBe(24);
});

test('UnlockTiered unlocks at correct Cat amounts', async ({ page }) => {
	await boot(page);

	// Test unlock at each threshold
	const thresholds = [
		{ cats: 1, expected: ['Cardboard box basics'] },
		{ cats: 5, expected: ['Sunbeam training'] },
		{ cats: 10, expected: ['Grandma-approved recipes'] },
		{ cats: 25, expected: ['Whisker refinement', 'Purrfect timing'] },
		{ cats: 50, expected: ['Midnight zoomies', 'Cat café loyalty'] },
		{ cats: 75, expected: ['Protein-rich kibble'] },
		{ cats: 100, expected: ['Tuna-grade nutrition', 'Feather wand drills'] },
		{ cats: 550, expected: ['Protein singularity'] },
	];

	// Buy 1 cat first
	await page.evaluate(() => {
		Game.Earn(100000000);
		Game.Objects['Cats'].buy(1);
	});

	for (const { cats, expected } of thresholds) {
		const result = await page.evaluate(({ cats }) => {
			// Reset cats to target amount
			Game.Objects['Cats'].amount = cats;
			Game.UnlockTiered(Game.Objects['Cats']);

			const newlyUnlocked = [];
			for (const [name] of [
				['Cardboard box basics'],['Sunbeam training'],['Whisker refinement'],['Midnight zoomies'],
				['Tuna-grade nutrition'],['Claw-powered kneading'],['Purrfect production'],['Nine-lives efficiency'],
				['Feline assembly'],['Astral catnaps'],['Infinite yarn loop'],['Quantum litter boxes'],
				['Cosmic whisker arrays'],['Protein singularity'],
				['Grandma-approved recipes'],['Purrfect timing'],['Cat café loyalty'],
				['Protein-rich kibble'],['Feather wand drills'],['Sunbeam perches'],
				['Catnip cultivation'],['Scratching-post ovens'],['Climbing shelves'],['Nine lives logistics']
			]) {
				if (Game.Upgrades[name] && Game.Upgrades[name].unlocked) newlyUnlocked.push(name);
			}
			return { amount: Game.Objects['Cats'].amount, newlyUnlocked };
		}, { cats });

		console.log(`Cats=${cats}: unlocked=[${result.newlyUnlocked.join(', ')}]`);

		for (const name of expected) {
			expect(result.newlyUnlocked).toContain(name);
		}
	}
});

test('Cat mult upgrades actually boost CPS', async ({ page }) => {
	await boot(page);

	const result = await page.evaluate(() => {
		Game.Earn(1000000000);
		// Buy 10 cats
		Game.Objects['Cats'].buy(10);

		// Get base CPS with no upgrades
		Game.CalculateGains();
		const baseCps = Game.Objects['Cats'].storedCps;

		// Buy Protein-rich kibble
		Game.Upgrades['Protein-rich kibble'].earn();
		Game.CalculateGains();
		const afterKibble = Game.Objects['Cats'].storedCps;

		// Buy all 7 cat mult upgrades
		const multNames = ['Protein-rich kibble','Feather wand drills','Sunbeam perches','Catnip cultivation','Scratching-post ovens','Climbing shelves','Nine lives logistics'];
		for (const n of multNames) {
			const u = Game.Upgrades[n];
			if (u && !u.bought) u.earn();
		}
		Game.CalculateGains();
		const afterAllMult = Game.Objects['Cats'].storedCps;

		return { baseCps, afterKibble, afterAllMult, ratio: afterAllMult / baseCps };
	});

	console.log('Mult upgrade test:', JSON.stringify(result, null, 2));
	// With 7 mult upgrades at 2% each: 1.02^7 ≈ 1.1487
	expect(result.afterKibble).toBeGreaterThan(result.baseCps);
	expect(result.afterAllMult).toBeGreaterThan(result.afterKibble);
	// Ratio should be close to 1.02^7 = 1.1487
	expect(result.ratio).toBeGreaterThan(1.1);
	expect(result.ratio).toBeLessThan(1.2);
});

test('Grandma-approved recipes bonus scales with Grandmas', async ({ page }) => {
	await boot(page);

	const result = await page.evaluate(() => {
		Game.Earn(1000000000);
		Game.Objects['Cats'].buy(10);
		Game.Objects['Grandma'].buy(50);

		Game.Upgrades['Grandma-approved recipes'].earn();
		Game.CalculateGains();
		const withRecipe = Game.Objects['Cats'].storedCps;

		Game.Upgrades['Grandma-approved recipes'].unearn();
		Game.CalculateGains();
		const withoutRecipe = Game.Objects['Cats'].storedCps;

		return { withRecipe, withoutRecipe, boost: (withRecipe / withoutRecipe - 1) * 100 };
	});

	console.log('Grandma recipe boost:', JSON.stringify(result, null, 2));
	// 50 Grandmas * 0.5% = 25% (capped at 25%)
	expect(result.boost).toBeGreaterThan(20);
	expect(result.boost).toBeLessThanOrEqual(26);
});
