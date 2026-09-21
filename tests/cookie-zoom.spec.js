// tests/cookie-zoom.spec.js — the dynamic cookie zoom (CC3 feature,
// src/engine/ui/drawBackground.ts).
//
// Buying hundreds of cursors used to push the cursor spiral off the panel:
// rings draw at radius 140+n*16px and nothing ever shrank the scene. With
// the "Cookie zoom" setting (on by default), DrawBackground computes a zoom
// factor from the ring count vs the panel size each frame, and the cookie,
// its shine, the spiral, the wrinklers and the #bigCookie hit area all scale
// with it. The setting is localStorage-backed (`cc3_cookieZoom`) — the save's
// prefs bitfield is byte-locked by the save-compat test.
//
// Layers:
//   0 — zoom is 1 with no cursors, and the spiral never exceeds the panel
//   1 — zoom eases down as cursors grow; the spiral fits; the button scales
//   2 — the Options toggle flips the setting (zoom back to 1 / re-engages)
//   3 — the setting persists across a page reload
//   4 — wrinklers ride the zoom (position scales with CookieZoom)

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
	// fresh profiles: disable autosave so an exit autosave can't carry state
	// between the test's own reload steps
	await page.evaluate(() => {
		Game.prefs.autosave = 0;
		window.localStorage.removeItem(Game.SaveTo);
	});
}

/**
 * Wait for the zoom to actually re-target and then settle. The per-frame
 * lerp (0.1) needs a frame with the new state first: `expectZoomOut` guards
 * the race where the waiter passes before any Draw ran with the seeded
 * cursors (target would still be 1). Equality (not a tolerance) is safe:
 * the engine snaps CookieZoom to the target once the lerp is within 0.005,
 * and geometric convergence reaches that in a few dozen frames.
 */
async function settleZoom(page, expectZoomOut = false) {
	if (expectZoomOut) {
		await page.waitForFunction(() => Game.CookieZoomTarget < 1, null, { timeout: 10_000 });
	}
	await page.waitForFunction(
		() => Game.CookieZoom === Game.CookieZoomTarget,
		null,
		{ timeout: 10_000 },
	);
}

function expectNoUncaughtErrors(errors) {
	expect(errors, 'uncaught page errors:\n' + errors.join('\n')).toEqual([]);
}

test.describe('dynamic cookie zoom', () => {
	test('layer 0: zoom stays 1 with a small spiral and the spiral fits', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		const st = await page.evaluate(() => {
			Game.Objects['Cursor'].amount = 100; // 2 rings — fits unzoomed
			return {
				pref: Game.CookieZoomPref(),
				zoom: Game.CookieZoom,
				panelW: Game.LeftBackground.canvas.width,
			};
		});
		expect(st.pref).toBe(1); // default ON
		await settleZoom(page);
		const after = await page.evaluate(() => {
			const rings = Math.ceil(Game.Objects['Cursor'].amount / 50);
			const outerR = (140 + (rings - 1) * 16 + 32) * Game.CookieZoom;
			return { zoom: Game.CookieZoom, outerR, panelW: Game.LeftBackground.canvas.width };
		});
		expect(after.zoom).toBe(1); // a 2-ring spiral never zooms
		expect(after.outerR).toBeLessThanOrEqual(after.panelW / 2);
		expectNoUncaughtErrors(errors);
	});

	test('layer 1: zoom shrinks with many cursors and everything tracks it', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		await page.evaluate(() => { Game.Objects['Cursor'].amount = 1000; }); // 20 rings
		await settleZoom(page, true);

		const st = await page.evaluate(() => {
			const rings = Math.ceil(Game.Objects['Cursor'].amount / 50);
			const outerR = (140 + (rings - 1) * 16 + 32) * Game.CookieZoom;
			const bigCookie = document.getElementById('bigCookie');
			return {
				zoom: Game.CookieZoom,
				zoomLt1: Game.CookieZoom < 1,
				fits: outerR <= Game.LeftBackground.canvas.width / 2 + 1,
				bigCookieSize: bigCookie ? bigCookie.getBoundingClientRect().width : 0,
			};
		});
		expect(st.zoomLt1).toBe(true);
		expect(st.fits).toBe(true); // the whole spiral is on the panel
		// the DOM hit area scaled down with the drawn cookie (256px × zoom)
		expect(st.bigCookieSize).toBeGreaterThan(0);
		expect(st.bigCookieSize).toBeLessThan(256 * st.zoom + 20);
		// clicking still works through the scaled button
		const cookiesBefore = await page.evaluate(() => Game.cookies);
		await page.locator('#bigCookie').click();
		await page.waitForTimeout(100);
		expect(await page.evaluate((c) => Game.cookies > c, cookiesBefore)).toBe(true);
		expectNoUncaughtErrors(errors);
	});

	test('layer 2: the Options toggle disables and re-enables the zoom', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		await page.evaluate(() => { Game.Objects['Cursor'].amount = 1000; });
		await settleZoom(page, true);
		expect(await page.evaluate(() => Game.CookieZoom)).toBeLessThan(1);

		await page.locator('#prefsButton').click();
		const toggle = page.locator('#cookieZoomButton');
		await expect(toggle).toContainText('ON');
		await toggle.click();
		await expect(toggle).toContainText('OFF');
		expect(await page.evaluate(() => Game.CookieZoomPref())).toBe(0);
		await settleZoom(page);
		expect(await page.evaluate(() => Game.CookieZoom)).toBe(1); // instantly vanilla

		await toggle.click(); // re-enable
		await expect(toggle).toContainText('ON');
		// expectZoomOut guards the stale-frame race: right after the click the
		// target is still 1 from the pref-off frames, so a plain settle would
		// pass before any frame recomputes it
		await settleZoom(page, true);
		expect(await page.evaluate(() => Game.CookieZoom)).toBeLessThan(1);
		await page.locator('.menuClose').click();
		expectNoUncaughtErrors(errors);
	});

	test('layer 3: the setting persists across a reload', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		await page.evaluate(() => { Game.ToggleCookieZoom(); });
		expect(await page.evaluate(() => Game.CookieZoomPref())).toBe(0);

		await page.reload({ waitUntil: 'load' });
		await page.waitForFunction(() => window.Game && window.Game.ready === 1, null, BOOT);
		expect(await page.evaluate(() => Game.CookieZoomPref())).toBe(0);

		// restore for any later layers running in the same profile
		await page.evaluate(() => { Game.ToggleCookieZoom(); });
		expect(await page.evaluate(() => Game.CookieZoomPref())).toBe(1);
		expectNoUncaughtErrors(errors);
	});

	test('layer 4: wrinklers ride the zoom', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		// spawn a wrinkler at close=1 and let its position compute
		// (SpawnWrinkler needs the grandmapocalypse active to find a free slot)
		await page.evaluate(() => {
			Game.elderWrath = 1;
			const wr = Game.SpawnWrinkler();
			wr.close = 1;
			wr.phase = 2;
		});
		await page.waitForTimeout(200); // one UpdateWrinklers pass

		const at1 = await page.evaluate(() => {
			const wr = Game.wrinklers.find((w) => w.phase > 0);
			const dx = wr.x - Game.cookieOriginX;
			const dy = wr.y - Game.cookieOriginY;
			return Math.sqrt(dx * dx + dy * dy);
		});

		await page.evaluate(() => { Game.Objects['Cursor'].amount = 2000; });
		await settleZoom(page, true);
		await page.waitForTimeout(200);

		const atZoom = await page.evaluate(() => {
			const wr = Game.wrinklers.find((w) => w.phase > 0);
			const dx = wr.x - Game.cookieOriginX;
			const dy = wr.y - Game.cookieOriginY;
			return { dist: Math.sqrt(dx * dx + dy * dy), zoom: Game.CookieZoom };
		});

		// at close=1 the base distance is 128px; scaled, it must track the zoom
		expect(at1).toBeGreaterThan(0);
		expect(atZoom.dist / 128).toBeCloseTo(atZoom.zoom, 0);
		expectNoUncaughtErrors(errors);
	});
});
