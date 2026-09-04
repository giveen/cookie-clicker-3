// Touch-device hold-to-buy regression test.
// Emulates a phone (touch + coarse pointer), boots the game, asserts the
// engine's touch detection armed (Game.touchEvents==1 — previously hardcoded
// 0, which left every touch branch in the engine dead) and that a
// touchstart-hold on a store row repeat-buys through the hold timer with the
// release touchend swallowed (no double-buy of the final tap).
// Chromium-only on purpose: the probe dispatches TouchEvent, which the
// desktop Firefox/WebKit builds in this repo don't provide.
import { test, expect, devices } from '@playwright/test';

const BOOT = { timeout: 60_000 };

test.use({ browserName: 'chromium', ...devices['iPhone 13'] });

async function boot(page) {
	await page.goto('/?debug=1', { waitUntil: 'load' });
	const lang = page.locator('#langSelect-English');
	try {
		await lang.waitFor({ state: 'visible', timeout: 5_000 });
		await lang.click({ timeout: 5_000 });
	} catch {
		// In touch-emulated contexts the locator click can fail actionability
		// (the button's hover transform keeps it "unstable"); a DOM click works.
		await page.evaluate(() => { const b = l('langSelect-English'); if (b) b.click(); });
	}
	await page.waitForFunction(() => window.Game && window.Game.ready === 1, null, BOOT);
}

test('touch: detection arms and hold-to-buy repeat-buys from a store row', async ({ page }) => {
	const errors = [];
	page.on('pageerror', (e) => errors.push(String(e)));
	await boot(page);

	const state = await page.evaluate(() => ({
		touchEvents: Game.touchEvents,
		mobile: Game.mobile,
		clickStr: Game.clickStr,
		pref: Game.HoldToBuyPref(),
	}));
	expect(state.touchEvents).toBe(1);
	expect(state.clickStr).toBe('ontouchend');
	expect(state.pref).toBe(1);

	// hold-buy via a synthetic touch on the Cursor row
	await page.evaluate(() => { Game.cookies = 1e9; });
	const before = await page.evaluate(() => Game.Objects['Cursor'].amount);
	await page.evaluate(() => {
		const el = l('product0');
		const r = el.getBoundingClientRect();
		const x = r.left + r.width / 2, y = r.top + r.height / 2;
		const touch = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
		el.dispatchEvent(new TouchEvent('touchstart', { touches: [touch], targetTouches: [touch], changedTouches: [touch], bubbles: true, cancelable: true }));
	});
	// 500ms arm delay + 80ms repeats: release only after repeats fired
	await page.waitForFunction(
		(before) => Game.Objects['Cursor'].amount >= before + 3,
		before,
		{ timeout: 5_000 }
	);
	await page.evaluate(() => {
		const el = l('product0');
		const r = el.getBoundingClientRect();
		const x = r.left + r.width / 2, y = r.top + r.height / 2;
		const touch = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
		el.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [touch], bubbles: true, cancelable: true }));
	});
	// repeats bought, and the release touchend was swallowed (no extra buy)
	expect(await page.evaluate((b) => Game.Objects['Cursor'].amount, before)).toBe(before + 3);
	expect(errors).toEqual([]);
});
