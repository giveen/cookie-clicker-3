// Balance regression gate — runs the engine's own economy audit
// (Game.AnalyzeEconomy) against the production build and diffs its warnings
// against the committed baseline (tests/balance-baseline.json).
//
// A warning is a pure function of the content data (prices/CpS): the audit
// measures every vanilla building's per-unit purchase payback against the
// geometric curve of its store neighbors (±3x flags), and every upgrade's
// price vs. the production it buys. So a NEW warning means a balance
// regression slipped in — the gate fails it. A RESOLVED warning (content
// changed on purpose) passes with a note: re-generate the baseline with
// BALANCE_UPDATE=1.
//
// Run:          npx playwright test tests/balance.spec.js
// Regenerate:   BALANCE_UPDATE=1 npx playwright test tests/balance.spec.js
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASELINE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'balance-baseline.json');
const BOOT = { timeout: 30_000 };

/** Same boot as the QA suite: fresh profile, English, wait for Game.ready. */
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

async function audit(page) {
	await boot(page);
	return page.evaluate(() => {
		const r = Game.AnalyzeEconomy();
		return {
			buildingCount: r.buildingCount,
			upgradeCount: r.upgradeCount,
			warnings: [...r.warnings].sort(),
		};
	});
}

test('balance: no new warnings against the committed baseline', async ({ page }) => {
	test.skip(!!process.env.BALANCE_UPDATE, 'skipped under BALANCE_UPDATE=1 (baseline regeneration run)');
	const current = await audit(page);
	let baseline;
	try {
		baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
	} catch (err) {
		throw new Error(`balance baseline missing or unreadable (${BASELINE}) — generate it with BALANCE_UPDATE=1 npx playwright test tests/balance.spec.js`);
	}
	const newWarnings = current.warnings.filter((w) => !baseline.warnings.includes(w));
	const resolved = baseline.warnings.filter((w) => !current.warnings.includes(w));
	if (resolved.length) {
		console.log(`[balance] ${resolved.length} baseline warning(s) no longer fire (content changed on purpose?):`);
		for (const w of resolved) console.log('[balance]   resolved: ' + w);
		console.log('[balance]   re-run with BALANCE_UPDATE=1 to refresh the baseline.');
	}
	console.log(
		`[balance] audit: ${current.buildingCount} buildings, ${current.upgradeCount} upgrades, ` +
			`${current.warnings.length} warning(s) (baseline: ${baseline.warnings.length})`,
	);
	expect(newWarnings, 'NEW balance warnings (balance regression):\n' + newWarnings.join('\n')).toEqual([]);
});

test('balance: regenerate the committed baseline', async ({ page }) => {
	test.skip(!process.env.BALANCE_UPDATE, 'set BALANCE_UPDATE=1 to regenerate tests/balance-baseline.json');
	const current = await audit(page);
	fs.writeFileSync(BASELINE, JSON.stringify(current, null, '\t') + '\n');
	console.log(`[balance] baseline written: ${current.warnings.length} warning(s)`);
});
