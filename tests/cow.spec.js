// tests/cow.spec.js — the cookie cow (CC3 feature, src/engine/systems/cow.ts).
//
// The cow grows in 11 stages (1M → 10 quadrillion cookies, ×10 per stage)
// and grows the milk bonus: CalculateGains multiplies the milkMult block by
// 1+CowMilkBonus() — flat +1% per stage for stages 1-10, a terminal +3%
// spike at stage 11 (max +13%).
//
// The milk bonus flows into the observable, deterministic output
// Game.cookiesMultByType['kittens'] (one kitten tier × milkProgress), so
// with a clean seed the whole chain is a pure function of Game.cowLevel:
//
//   kittens(cow) = 1 + milkProgress·0.1·milkMult,
//   milkMult     = 1.05^auras · 1+cowBonus   (clean seed: no Santa/gods/effs)
//
// Layers:
//   0 — the pure table (bonus column + ×10 cost ladder)
//   1 — exact math on a clean seed (hook value AND position)
//   2 — the buy path (UpgradeCow spend/level/terminal achievement)
//   3 — save round-trip + legacy save (no cow field) import
//   4 — light UI smoke (special tab, growing drawer sprite, cost display)

import { expect, test } from '@playwright/test';

const BOOT = { timeout: 30_000 };

/** Stage i (1-based) costs 1e6·10^(i-1) cookies; level i grants the bonus. */
const STAGE_COST = (i) => 1e6 * 10 ** (i - 1);
const EXPECTED_BONUS = [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.13];

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
}

function expectNoUncaughtErrors(errors) {
	expect(errors, 'uncaught page errors:\n' + errors.join('\n')).toEqual([]);
}

test.describe('cookie cow', () => {
	test('layer 0: the bonus table and the ×10 cost ladder', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		// Compute in-page, assert in Node (expect is not available in the page).
		const table = await page.evaluate(() => {
			const G = window.Game;
			const out = {
				isArray: Array.isArray(G.cowLevels),
				len: G.cowLevels.length,
				bonus: [],
				ladder: [],
				costStr11: G.cowLevels[10].costStr(),
				terminalCost: G.cowLevels[11].cost
			};
			for (let i = 0; i <= 11; i++) {
				G.cowLevel = i;
				out.bonus.push(G.CowMilkBonus());
			}
			// clamped for hand-edited saves
			G.cowLevel = 99; out.clampedHigh = G.CowMilkBonus();
			G.cowLevel = -3; out.clampedLow = G.CowMilkBonus();
			G.cowLevel = 0;
			// cost ladder: stage i (1-based) = 1e6·10^(i-1), 1M … 10 quadrillion
			for (let i = 1; i <= 11; i++) {
				const cost = 1e6 * 10 ** (i - 1);
				// 1e16-1 is not representable in float64 (it rounds up to 1e16);
				// step down by 2 there — the game shares the same float limit.
				const below = cost - (cost > 9e15 ? 2 : 1);
				G.cookies = below;
				const atCostMinusOne = G.cowLevels[i - 1].cost();
				G.cookies = cost;
				const atCost = G.cowLevels[i - 1].cost();
				out.ladder.push([atCostMinusOne, atCost]);
			}
			G.cookies = 0;
			return out;
		});

		expect(table.isArray).toBe(true);
		expect(table.len).toBe(12); // 11 growth stages + terminal state
		// bonus column: flat +1% for stages 1-10, terminal spike +3%
		for (let i = 0; i <= 11; i++) {
			expect(table.bonus[i], 'bonus at level ' + i).toBeCloseTo(i < 11 ? i * 0.01 : 0.13, 12);
		}
		expect(table.clampedHigh).toBeCloseTo(0.13, 12);
		expect(table.clampedLow).toBe(0);
		for (let i = 1; i <= 11; i++) {
			expect(table.ladder[i - 1][0], 'stage ' + i + ' unaffordable at cost-1').toBe(false);
			expect(table.ladder[i - 1][1], 'stage ' + i + ' affordable at cost').toBe(true);
		}
		// LBeautify rendering of the terminal cost
		expect(table.costStr11).toContain('10 quadrillion');
		// the terminal state has no cost (mirrors the dragon's final level)
		expect(table.terminalCost).toBeUndefined();

		expectNoUncaughtErrors(errors);
	});

	test('layer 1: the milk bonus math on a clean seed', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		const recalc = (page) => page.evaluate(() => {
			const G = window.Game;
			G.recalculateGains = 1;
			G.CalculateGains();
			return G.cookiesMultByType['kittens'];
		});

		// Clean seed: milkProgress exactly 1, exactly one kitten tier
		// (X=0.1), and a fresh profile guarantees no Santa's milk, no aura,
		// no gods, no minigame effs → milkMult is a pure function of cowLevel.
		await page.evaluate(() => {
			const G = window.Game;
			G.AchievementsOwned = 25;
			G.Upgrades['Kitten helpers'].bought = 1;
			G.cowLevel = 0;
			G.dragonAura = 0;
		});

		// Baseline (cow at level 0): proves the seed is clean AND that the
		// existing kitten math is untouched (×1.0 at level 0).
		let kittens = await recalc(page);
		expect(kittens).toBeCloseTo(1 + 1 * 0.1 * 1, 10);

		// Walk every stage: same op order as the engine (milkMult*=1+bonus,
		// then catMult*=1+mp·X·milkMult) → bit-identical floats.
		for (let i = 1; i <= 11; i++) {
			await page.evaluate((lvl) => { window.Game.cowLevel = lvl; }, i);
			kittens = await recalc(page);
			const m = 1 + EXPECTED_BONUS[i];
			expect(kittens, 'cow level ' + i).toBeCloseTo(1 + 1 * 0.1 * m, 10);
		}

		// Composition: multiplicative with the Breath of Milk aura (5%).
		// A wrong-position implementation (e.g. a flat catMult addend) lands
		// on a different number.
		await page.evaluate(() => {
			const G = window.Game;
			G.dragonAura = 1; // Breath of Milk
			G.cowLevel = 5;
		});
		kittens = await recalc(page);
		expect(kittens).toBeCloseTo(1 + 1 * 0.1 * (1.05 * 1.05), 10); // 1.11025

		// Inert with no milk progress: the cow is a MILK bonus, not a flat
		// kitten buff.
		await page.evaluate(() => {
			const G = window.Game;
			G.AchievementsOwned = 0;
			G.dragonAura = 0;
			G.cowLevel = 11;
		});
		kittens = await recalc(page);
		expect(kittens).toBeCloseTo(1.0, 10);
	});

	test('layer 2: the buy path (UpgradeCow)', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		// Zero-CpS economy so cookies stay put between evaluate calls.
		const before = await page.evaluate(() => {
			const G = window.Game;
			G.cowLevel = 0;
			G.cookies = 1e17;
			return { cps: G.cookiesPs, level: G.cowLevel };
		});
		expect(before.cps).toBe(0);

		for (let i = 1; i <= 11; i++) {
			const res = await page.evaluate((cost) => {
				const G = window.Game;
				const had = G.cookies;
				G.UpgradeCow();
				return {
					level: G.cowLevel,
					spent: had - G.cookies,
					ach: !!G.Achievements['Here be a moo'] && G.Achievements['Here be a moo'].won === 1,
					recalc: G.recalculateGains
				};
			}, STAGE_COST(i));
			expect(res.level, 'stage ' + i).toBe(i);
			expect(res.spent, 'spend at stage ' + i).toBe(STAGE_COST(i));
			expect(res.recalc, 'recalc flag set at stage ' + i).toBeTruthy();
			if (i < 11) expect(res.ach, 'terminal not yet won at stage ' + i).toBe(false);
		}
		// Terminal stage won its achievement (fired by the last buy()).
		const terminal = await page.evaluate(() => {
			const G = window.Game;
			return {
				won: G.Achievements['Here be a moo'].won === 1,
				level: G.cowLevel,
				bonus: G.CowMilkBonus()
			};
		});
		expect(terminal.won).toBe(true);
		expect(terminal.level).toBe(11);
		expect(terminal.bonus).toBeCloseTo(0.13, 12);

		// Fully grown: UpgradeCow is a no-op (no cost at the terminal state).
		const noop = await page.evaluate(() => {
			const G = window.Game;
			const had = G.cookies;
			G.UpgradeCow();
			return { level: G.cowLevel, spent: had - G.cookies };
		});
		expect(noop.level).toBe(11);
		expect(noop.spent).toBe(0);

		// Unaffordable mid-ladder: no-op.
		const poor = await page.evaluate((cost) => {
			const G = window.Game;
			G.cowLevel = 0;
			G.cookies = cost - 1;
			const had = G.cookies;
			G.UpgradeCow();
			return { level: G.cowLevel, spent: had - G.cookies };
		}, STAGE_COST(1));
		expect(poor.level).toBe(0);
		expect(poor.spent).toBe(0);

		expectNoUncaughtErrors(errors);
	});

	test('layer 3: save round-trip and legacy saves', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		// Seed a mid-ladder cow and write an uncompressed save.
		const code = await page.evaluate(() => {
			const G = window.Game;
			G.cowLevel = 7;
			return G.WriteSave(2);
		});
		expect(typeof code).toBe('string');

		// Round-trip: import into a fresh profile.
		const roundTrip = await page.evaluate((save) => {
			const G = window.Game;
			const ok = G.ImportSaveCode(btoa(unescape(encodeURIComponent(save))));
			return { ok, level: G.cowLevel, bonus: G.CowMilkBonus() };
		}, code);
		expect(roundTrip.ok).toBe(true);
		expect(roundTrip.level).toBe(7);
		expect(roundTrip.bonus).toBeCloseTo(0.07, 12);

		// Legacy save: a save without the cow field (strip the appended
		// spl[53] — the cow level this build writes last, before the section's
		// trailing empty field) must import fine and default to level 0.
		const legacy = await page.evaluate((save) => {
			const G = window.Game;
			const parts = save.split('|');
			const misc = parts[4].split(';');
			const cowField = misc[53];
			misc.splice(53, 1); // drop the cow field — pre-cow layout
			parts[4] = misc.join(';');
			const ok = G.ImportSaveCode(btoa(unescape(encodeURIComponent(parts.join('|')))));
			return { ok, cowField, level: G.cowLevel, bonus: G.CowMilkBonus() };
		}, code);
		expect(legacy.cowField).toBe('7');
		expect(legacy.ok).toBe(true);
		expect(legacy.level).toBe(0);
		expect(legacy.bonus).toBe(0);

		expectNoUncaughtErrors(errors);
	});

	test('layer 4: the drawer, the growing sprite, and the buy button', async ({ page }) => {
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await boot(page);

		// Seed the unlock pair and rebuild the special tabs.
		await page.evaluate(() => {
			const G = window.Game;
			G.Upgrades['How to milk a cookie cow'].bought = 1;
			G.Upgrades['A certain cow'].bought = 1;
			G.UpdateSpecial();
		});
		const tabs = await page.evaluate(() => window.Game.specialTabs);
		expect(tabs).toContain('cow');

		// Open the cow drawer.
		await page.evaluate(() => {
			const G = window.Game;
			G.specialTab = 'cow';
			G.ToggleSpecialMenu(1);
		});
		const pic0 = await page.locator('#specialPic').getAttribute('style');
		expect(pic0).toContain('Cow.png');
		expect(pic0).toContain('scale(0.5)'); // stage 0 = 48px
		expect(pic0).toContain('--cowScale:0.5'); // growth scale published for the idle-breath keyframes
		// the cow sits on the milk at the RIGHT of the drawer area
		expect(pic0).toContain('right:-16px');
		expect(pic0).not.toContain('left:-16px');
		// the idle-breath animation is scoped to the cow (cc3CowBreathe,
		// gated by reduced-motion / the fancy-graphics toggle in CSS)
		const cowAnim = await page.evaluate(() => {
			const el = document.getElementById('specialPic');
			const cs = getComputedStyle(el);
			return { cls: el.className, name: cs.animationName, dur: cs.animationDuration, scale: el.style.getPropertyValue('--cowScale') };
		});
		expect(cowAnim.cls).toBe('cc3Cow');
		expect(cowAnim.name).toContain('cc3CowBreathe');
		expect(parseFloat(cowAnim.dur)).toBeCloseTo(2.4, 2);
		expect(cowAnim.scale).toBe('0.5');
		// the in-game "fancy graphics" toggle publishes body.noMotion: the
		// idle-breath stops and the static inline scale is the fallback
		await page.evaluate(() => document.body.classList.add('noMotion'));
		const cowAnimOff = await page.evaluate(() => getComputedStyle(document.getElementById('specialPic')).animationName);
		expect(cowAnimOff).toBe('none');
		await page.evaluate(() => document.body.classList.remove('noMotion'));

		// ...while the dragon's drawer still hangs off the left
		await page.evaluate(() => {
			const G = window.Game;
			G.Upgrades['A crumbly egg'].bought = 1;
			G.UpdateSpecial();
			G.specialTab = 'dragon';
			G.ToggleSpecialMenu(1);
		});
		const dragonPic = await page.locator('#specialPic').getAttribute('style');
		expect(dragonPic).toContain('left:-16px');
		expect(dragonPic).not.toContain('right:-16px');
		// the dragon sprite is untouched: no cc3Cow class, no idle-breath animation
		const dragonAnim = await page.evaluate(() => {
			const el = document.getElementById('specialPic');
			return { cls: el.className, name: getComputedStyle(el).animationName };
		});
		expect(dragonAnim.cls).toBe('');
		expect(dragonAnim.name).toBe('none');

		// back to the cow drawer for the remaining checks
		await page.evaluate(() => {
			window.Game.specialTab = 'cow';
			window.Game.ToggleSpecialMenu(1);
		});
		const name = await page.locator('#specialPopup h3').first().textContent();
		expect(name).toBe('A certain cow');
		expect(await page.locator('#specialPopup').textContent()).toContain('+0%');

		// Unaffordable cost greys out; affordable does not.
		await page.evaluate((cost) => {
			window.Game.cookies = cost - 1;
			window.Game.ToggleSpecialMenu(1);
		}, STAGE_COST(1));
		const costGrey = await page.locator('#specialPopup .option').first().innerHTML();
		expect(costGrey).toContain('color:#777');
		await page.evaluate((cost) => {
			window.Game.cookies = cost;
			window.Game.ToggleSpecialMenu(1);
		}, STAGE_COST(1));
		const costLit = await page.locator('#specialPopup .option').first().innerHTML();
		expect(costLit).not.toContain('color:#777');

		// Click the grow button (the cow tab itself is a canvas hit-test,
		// but the drawer button is a real element).
		await page.evaluate(() => { if (window.Game.CloseNotes) window.Game.CloseNotes(); });
		await page.locator('#specialPopup .option').first().click();
		const grown = await page.evaluate(() => {
			const G = window.Game;
			return { level: G.cowLevel, cookies: G.cookies };
		});
		expect(grown.level).toBe(1);
		const picStyle1 = await page.locator('#specialPic').getAttribute('style');
		const scale1 = parseFloat(picStyle1.match(/scale\(([\d.]+)\)/)[1]);
		expect(Math.abs(scale1 - (0.5 + 1 / 22))).toBeLessThan(1e-9); // visibly bigger
		expect(grown.cookies).toBe(0);

		expectNoUncaughtErrors(errors);
	});
});
