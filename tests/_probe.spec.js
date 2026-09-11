// TEMPORARY probe: trace what zeroes Game.cookies after a poisoned import.
import { test, expect } from '@playwright/test';

const BOOT = { timeout: 30_000 };

test('probe', async ({ page }) => {
	await page.goto('/?debug=1', { waitUntil: 'load' });
	try {
		const lang = page.locator('#langSelect-English');
		await lang.waitFor({ state: 'visible', timeout: 5_000 });
		await lang.click();
	} catch {}
	await page.waitForFunction(() => window.Game && window.Game.ready === 1, null, BOOT);
	const res = await page.evaluate(() => {
		const G = window.Game;
		const raw = G.WriteSave(2);
		const parts = raw.split('|');
		const run = parts[2].split(';');
		run[0] = 'Infinity';
		run[1] = 'Infinity';
		run[8] = 'Infinity';
		parts[2] = run.join(';');
		const poisoned = btoa(unescape(encodeURIComponent(parts.join('|'))));
		const trace = [];
		const oe = G.Earn, os = G.Spend, od = G.Dissolve;
		G.Earn = (n) => { if (G.cookies > 0 && (typeof n !== 'number' || n < 0 || !Number.isFinite(n))) trace.push({ op: 'Earn', n, before: G.cookies, stack: new Error().stack.split('\n').slice(2, 6).join(' | ') }); oe(n); };
		G.Spend = (n) => { trace.push({ op: 'Spend', n, before: G.cookies, stack: new Error().stack.split('\n').slice(2, 6).join(' | ') }); os(n); };
		G.Dissolve = (n) => { trace.push({ op: 'Dissolve', n, before: G.cookies, stack: new Error().stack.split('\n').slice(2, 6).join(' | ') }); od(n); };
		const ok = G.ImportSaveCode(poisoned);
		const rightAfter = { c: G.cookies, e: G.cookiesEarned };
		return new Promise((resolve) => {
			setTimeout(() => {
				G.Earn = oe; G.Spend = os; G.Dissolve = od;
				resolve({ ok, rightAfter, later: { c: G.cookies, e: G.cookiesEarned }, trace });
			}, 2500);
		});
	});
	console.log('OK:', res.ok);
	console.log('rightAfter:', res.rightAfter);
	console.log('later:', res.later);
	console.log('TRACE:', JSON.stringify(res.trace, null, 1));
	expect(true).toBe(true);
});
