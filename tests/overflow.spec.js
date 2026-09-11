// P0 regression: the cookie ledger must never leave the finite, displayable
// range.
//
// Background: on an endgame save the Factory Dungeon's cookie pickups scale
// with the factory's stored CpS. The product overflowed float64, the top
// counter rendered the literal "Infinity", and WriteSave stored that literal
// in the save string (ImportSaveCode re-parses it as Infinity — so the
// damage was self-perpetuating: counter stuck at "Infinity", purchases as
// no-ops, and every re-save rewrote the corruption). These tests pin the
// layered fix:
//   1. Earn/Spend/Dissolve clamp balances at the displayable cap (1e270, the
//      largest number the UI can honestly render) and ignore non-finite amounts;
//   2. the top counter never renders "Infinity" under overflow pressure;
//   3. a save written after overflow is clean (no "Infinity" literal) and
//      re-imports as a finite, capped, playable balance;
//   4. a save already poisoned with the literal "Infinity" (as written by the
//      broken builds) self-heals on import;
//   5. a dungeon pickup scaled by an endgame-grade factory CpS (1e300) cannot
//      push the ledger past the cap.
//
// Run: npx playwright test tests/overflow.spec.js
import { test, expect } from '@playwright/test';

const BOOT = { timeout: 30_000 };
// Largest displayable number: utils/format.ts computes 1000^(min(formatLong,
// formatShort).length-1) — both suffix tables have 90 extended + 10 base
// entries, so the cap is 1000^99 = 1e297. Beyond it, Beautify renders the
// literal "Infinity".
const CAP = 1e297;

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

/** Force the Factory minigame to load: give it the unlock threshold, then LoadMinigames. */
async function loadDungeon(page) {
	await page.evaluate(() => {
		const G = window.Game;
		G.cookies += 1e15;
		const f = G.Objects['Factory'];
		f.amount = 50;
		f.unlocked = 1;
		f.bought = 50;
		f.highest = 50;
		G.recalculateGains = 1;
		if (G.LoadMinigames) G.LoadMinigames();
	});
	await page.waitForFunction(
		() => {
			const f = window.Game.Objects['Factory'];
			return !!(f && f.minigameLoaded && f.minigame && f.dungeon && f.dungeon.hero);
		},
		null,
		{ timeout: 30_000 },
	);
	await page.waitForFunction(
		() => !!window.Game.Objects['Factory'].dungeon?.heroEntity,
		null,
		{ timeout: 15_000 },
	);
}

test('Earn/Spend/Dissolve clamp the ledger and ignore non-finite amounts', async ({ page }) => {
	await boot(page);
	await page.evaluate(() => {
		const G = window.Game;
		G.cookies = Number.MAX_VALUE; // finite but far above the displayable cap
		G.cookiesEarned = Number.MAX_VALUE;
		G.Earn(1e6); // must land on the cap, not on MAX_VALUE
	});
	const r = await page.evaluate((cap) => {
		const G = window.Game;
		G.cookies = cap;
		G.cookiesEarned = cap;
		const before = { c: G.cookies, e: G.cookiesEarned };
		G.Earn(Number.POSITIVE_INFINITY);
		G.Earn(Number.NaN);
		G.Spend(Number.POSITIVE_INFINITY);
		G.Dissolve(Number.NaN);
		return { before, c: G.cookies, e: G.cookiesEarned };
	}, CAP);
	expect(Number.isFinite(r.c)).toBe(true);
	expect(Number.isFinite(r.e)).toBe(true);
	expect(r.c).toBe(r.before.c); // non-finite amounts are ignored, not applied
	expect(r.e).toBe(r.before.e);
});

test('the top counter never renders "Infinity" under overflow pressure', async ({ page }) => {
	await boot(page);
	await page.evaluate(() => {
		const G = window.Game;
		G.cookies = Number.MAX_VALUE;
		G.Earn(1e300);
	});
	await page.waitForTimeout(2000); // ticker + render loop keep running
	const state = await page.evaluate(() => ({ c: window.Game.cookies, e: window.Game.cookiesEarned }));
	expect(Number.isFinite(state.c)).toBe(true);
	expect(Number.isFinite(state.e)).toBe(true);
	expect(state.c).toBeLessThanOrEqual(CAP * 1.0000000001);
	const label = await page.locator('#cookieAmount').first().textContent();
	expect(label, 'counter text').toBeTruthy();
	expect(label).not.toMatch(/infinite/i);
});

test('a save written after overflow is clean and re-imports', async ({ page }) => {
	await boot(page);
	await page.evaluate(() => {
		const G = window.Game;
		G.cookies = 1e200;
		G.Earn(1e90); // 1e290 is past the cap — the ledger must clamp it
	});
	// WriteSave(2) is the uncompressed string: a literal "Infinity" in it is
	// exactly the corruption signature the broken builds produced.
	const code = await page.evaluate(() => window.Game.WriteSave(2));
	expect(typeof code).toBe('string');
	expect(code.length).toBeGreaterThan(100);
	expect(code, 'save must not contain the Infinity literal').not.toContain('Infinity');
	const res = await page.evaluate(({ code }) => {
		const G = window.Game;
		const ok = G.ImportSaveCode(btoa(unescape(encodeURIComponent(code))));
		return { ok, c: G.cookies, e: G.cookiesEarned };
	}, { code });
	expect(res.ok, 'the clean save imports').toBe(true);
	expect(Number.isFinite(res.c)).toBe(true);
	expect(res.c).toBeGreaterThan(0);
	expect(res.c).toBeLessThanOrEqual(CAP * 1.0000000001);
});

test('a save poisoned with the literal "Infinity" self-heals on import', async ({ page }) => {
	await boot(page);
	const res = await page.evaluate(() => {
		const G = window.Game;
		const raw = G.WriteSave(2); // uncompressed string
		const parts = raw.split('|');
		const run = parts[2].split(';');
		// Corrupt it exactly the way the broken builds wrote it: parseFloat
		// turns the literal "Infinity" back into float Infinity on import.
		run[0] = 'Infinity'; // cookies
		run[1] = 'Infinity'; // cookiesEarned
		run[8] = 'Infinity'; // cookiesReset
		parts[2] = run.join(';');
		const poisoned = btoa(unescape(encodeURIComponent(parts.join('|'))));
		const ok = G.ImportSaveCode(poisoned);
		return { ok, cookies: G.cookies, earned: G.cookiesEarned, reset: G.cookiesReset };
	});
	expect(res.ok, 'a poisoned save still imports (not rejected)').toBe(true);
	expect(Number.isFinite(res.cookies)).toBe(true);
	expect(res.cookies).toBeGreaterThan(0); // capped, not zeroed — the game stays playable
	expect(res.cookies).toBeLessThanOrEqual(CAP * 1.0000000001);
	expect(Number.isFinite(res.earned)).toBe(true);
	expect(res.earned).toBeLessThanOrEqual(CAP * 1.0000000001);
	expect(Number.isFinite(res.reset)).toBe(true);
	// And the counter renders a real number, not "Infinity".
	await page.waitForTimeout(500);
	const label = await page.locator('#cookieAmount').first().textContent();
	expect(label, 'counter text').toBeTruthy();
	expect(label).not.toMatch(/infinite/i);
});

test('a dungeon pickup scaled by endgame factory CpS cannot overflow the ledger', async ({ page }) => {
	await boot(page);
	await loadDungeon(page);
	const res = await page.evaluate(() => {
		const G = window.Game;
		const f = G.Objects['Factory'];
		const d = f.dungeon;
		// An endgame-grade factory CpS: on the broken builds one pickup of a
		// 50-cookie chest would be 50 * 1e300 * luck — beyond float64 range.
		f.storedCps = 1e300;
		const hero = d.heroEntity;
		for (let i = 0; i < 5; i++) {
			const ent = d.AddEntity('item', 'cookies', hero.x, hero.y);
			ent.value = 50;
			hero.Turn(); // the hero's turn runs the cookie-pickup handler on its tile
		}
		return { c: G.cookies, run: d.cookiesMadeThisRun };
	});
	expect(Number.isFinite(res.c)).toBe(true);
	// The very first capped pickup saturates the cap; later pickups keep it there.
	expect(res.c).toBeGreaterThan(CAP * 0.99);
	expect(res.c).toBeLessThan(CAP * 1.01);
	expect(Number.isFinite(res.run), 'per-run dungeon cookie tally stays finite').toBe(true);
	await page.waitForTimeout(500);
	const label = await page.locator('#cookieAmount').first().textContent();
	expect(label).not.toMatch(/infinite/i);
	const code = await page.evaluate(() => window.Game.WriteSave(2));
	expect(code, 'the save stays clean under the stress').not.toContain('Infinity');
});
