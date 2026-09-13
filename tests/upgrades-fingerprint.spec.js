// Upgrade registration fingerprint — pins the ORDER and identity of every
// registered upgrade against a committed baseline
// (tests/upgrades-baseline.json).
//
// Why this exists: upgrade ids are the registration index and saves store
// purchased upgrades by id (see the CC3 notes in src/engine/content/
// upgrades.ts). Reordering, duplicating, or dropping a single declaration
// silently shifts every later id and breaks saves — with no visible
// runtime error. This test serializes Game.UpgradesById in id order
// (id, name, basePrice, icon, order, pool, power, tier, buildingTie,
// unlockAt, priceLumps, techUnlock, parents, vanilla, type) and diffs it
// against the baseline: any drift fails, with the first divergent entries
// printed.
//
// Run:          npx playwright test tests/upgrades-fingerprint.spec.js
// Regenerate:   UPGRADES_UPDATE=1 npx playwright test tests/upgrades-fingerprint.spec.js
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASELINE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'upgrades-baseline.json');
const BOOT = { timeout: 30_000 };

/** Same boot as the balance suite: fresh profile, English, wait for Game.ready. */
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

async function fingerprint(page) {
	await boot(page);
	const current = await page.evaluate(() => {
		const ups = Object.values(Game.UpgradesById).sort((a, b) => a.id - b.id);
		return {
			count: ups.length,
			upgrades: ups.map((u) => [
				u.id,
				u.name,
				u.basePrice,
				u.icon ?? null,
				u.order ?? null,
				u.pool ?? null,
				u.power ?? 0,
				u.tier ?? null,
				u.buildingTie && typeof u.buildingTie.name === 'string' ? u.buildingTie.name : null,
				u.unlockAt ?? null,
				u.priceLumps ?? null,
				Array.isArray(u.techUnlock) ? u.techUnlock : null,
				Array.isArray(u.parents) ? u.parents : [],
				u.vanilla ?? 0,
				u.type ?? null,
			]),
		};
	});
	return current;
}

test('upgrades: registration fingerprint matches the committed baseline', async ({ page }) => {
	test.skip(!!process.env.UPGRADES_UPDATE, 'skipped under UPGRADES_UPDATE=1 (baseline regeneration run)');
	const current = await fingerprint(page);
	let baseline;
	try {
		baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
	} catch (err) {
		throw new Error(`upgrades baseline missing or unreadable (${BASELINE}) — generate it with UPGRADES_UPDATE=1 npx playwright test tests/upgrades-fingerprint.spec.js`);
	}
	if (current.count !== baseline.count) {
		throw new Error(
			`upgrade count drift: baseline ${baseline.count}, current ${current.count} — ` +
			`a declaration was added, removed, or duplicated. Re-run with UPGRADES_UPDATE=1 if the change is intentional.`,
		);
	}
	const diffs = [];
	for (let i = 0; i < current.count && diffs.length < 10; i++) {
		const a = JSON.stringify(baseline.upgrades[i]);
		const b = JSON.stringify(current.upgrades[i]);
		if (a !== b) {
			diffs.push(`  row ${i}: baseline ${a}\n            current  ${b}`);
		}
	}
	console.log(`[upgrades] fingerprint: ${current.count} upgrades (baseline: ${baseline.count})`);
	expect(
		diffs,
		`upgrade registration drift (ids are the registration index and saves store purchases by id — do not reorder declarations):\n` + diffs.join('\n'),
	).toEqual([]);
});

test('upgrades: regenerate the committed baseline', async ({ page }) => {
	test.skip(!process.env.UPGRADES_UPDATE, 'set UPGRADES_UPDATE=1 to regenerate tests/upgrades-baseline.json');
	const current = await fingerprint(page);
	fs.writeFileSync(BASELINE, JSON.stringify(current, null, '\t') + '\n');
	console.log(`[upgrades] baseline written: ${current.count} upgrades`);
});
