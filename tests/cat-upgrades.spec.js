// Quick diagnostic: Cat building upgrades
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

test('Cat base upgrades set catAdd and affect CPS', async ({ page }) => {
	await boot(page);

	// Give cookies and buy 1 Cat
	const result = await page.evaluate(() => {
		Game.Earn(100000000);
		Game.Objects['Cats'].buy(1);
		const cps1 = Game.Objects['Cats'].storedCps;
		const tier1 = Game.Tiers['cat1'];
		const upg1 = Game.Objects['Cats'].tieredUpgrades['cat1'];
		const upg1InStore = Game.Upgrades['Cardboard box basics'];
		return {
			cps1,
			tier1Unlock: tier1?.unlock,
			tier1Name: tier1?.name,
			upg1Name: upg1?.name,
			upg1Tier: upg1?.tier,
			upg1CatAdd: upg1?.catAdd,
			upg1Unlocked: upg1InStore?.unlocked,
			upg1Bought: upg1InStore?.bought,
			upg1Pool: upg1InStore?.pool,
			amount: Game.Objects['Cats'].amount,
		};
	});
	console.log('After 1 Cat:', JSON.stringify(result, null, 2));

	// Buy the first upgrade
	const afterBuy = await page.evaluate(() => {
		const upg = Game.Upgrades['Cardboard box basics'];
		upg.earn();
		Game.CalculateGains();
		const cps2 = Game.Objects['Cats'].storedCps;
		return {
			cps2,
			bought: upg.bought,
			catAdd: upg.catAdd,
		};
	});
	console.log('After buying Cardboard box basics:', JSON.stringify(afterBuy, null, 2));

	// Buy 5 more Cats and check if all 5 tier upgrades unlock
	const after5Cats = await page.evaluate(() => {
		Game.Earn(100000000);
		Game.Objects['Cats'].buy(5);
		const unlocks = {};
		for (let i = 1; i <= 5; i++) {
			const name = 'cat' + i;
			const upg = Game.Objects['Cats'].tieredUpgrades[name];
			unlocks[name] = { name: upg?.name, unlocked: Game.Upgrades[upg?.name]?.unlocked };
		}
		return { amount: Game.Objects['Cats'].amount, unlocks };
	});
	console.log('After 5+1 Cats:', JSON.stringify(after5Cats, null, 2));

	// Buy all 14 base upgrades and check CPS
	const afterAllBase = await page.evaluate(() => {
		const baseNames = [
			'Cardboard box basics','Sunbeam training','Whisker refinement','Midnight zoomies',
			'Tuna-grade nutrition','Claw-powered kneading','Purrfect production','Nine-lives efficiency',
			'Feline assembly','Astral catnaps','Infinite yarn loop','Quantum litter boxes',
			'Cosmic whisker arrays','Protein singularity'
		];
		for (const name of baseNames) {
			const upg = Game.Upgrades[name];
			if (upg && !upg.bought) upg.earn();
		}
		Game.CalculateGains();
		const cps = Game.Objects['Cats'].storedCps;
		let totalCatAdd = 0;
		for (const name of baseNames) {
			const upg = Game.Upgrades[name];
			totalCatAdd += (upg?.catAdd || 0);
		}
		return { cps, totalCatAdd, amount: Game.Objects['Cats'].amount };
	});
	console.log('After all 14 base upgrades:', JSON.stringify(afterAllBase, null, 2));

	// Buy specialty upgrades and check CPS
	const afterSpec = await page.evaluate(() => {
		const specNames = [
			'Grandma-approved recipes','Purrfect timing','Cat café loyalty',
			'Protein-rich kibble','Feather wand drills','Sunbeam perches',
			'Catnip cultivation','Scratching-post ovens','Climbing shelves','Nine lives logistics'
		];
		for (const name of specNames) {
			const upg = Game.Upgrades[name];
			if (upg && !upg.bought) upg.earn();
		}
		Game.CalculateGains();
		const cps = Game.Objects['Cats'].storedCps;
		const bought = {};
		for (const name of specNames) {
			bought[name] = Game.Upgrades[name]?.bought;
		}
		return { cps, bought };
	});
	console.log('After all specialty upgrades:', JSON.stringify(afterSpec, null, 2));
});

test('Cat base upgrades appear in store when unlocked', async ({ page }) => {
	await boot(page);

	// Buy 25 Cats so tier cat3 (unlock 25) should be available
	const result = await page.evaluate(() => {
		Game.Earn(100000000);
		Game.Objects['Cats'].buy(25);
		Game.upgradesToRebuild = 1;
		Game.RebuildUpgrades();
		const storeNames = Game.UpgradesInStore.map(u => u.name);
		const catUpgradesInStore = storeNames.filter(n => 
			n.includes('Cardboard') || n.includes('Sunbeam training') || n.includes('Whisker') || 
			n.includes('Grandma-approved') || n.includes('Purrfect timing') || n.includes('Protein-rich')
		);
		return {
			amount: Game.Objects['Cats'].amount,
			catUpgradesInStore,
			totalInStore: storeNames.length,
		};
	});
	console.log('Store with 25 Cats:', JSON.stringify(result, null, 2));
});
