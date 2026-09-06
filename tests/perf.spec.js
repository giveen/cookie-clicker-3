// Perf regression gate — measures the production build under a heavier
// sustained load than the level-1 smoke test in qa.spec.js, and gates four
// numbers:
//
//   1. boot: time from navigation start to Game.ready (the playable moment,
//      including the first-load language prompt) and FCP;
//   2. game-loop tick rate: the in-page ?qa=perf probe seeds four minigame
//      buildings (here: level QPERF_LVL, not 1) plus an open Garden, then
//      samples Game.T for ~3s against the 30-tick target (verdict OK = >= 90%);
//   3. long tasks during that 3s steady-state window: count and total blocked
//      time. The logic loop is setTimeout-driven, so a DOM/canvas regression
//      that hitches rendering (main-thread stalls) can hold the tick target
//      and still show up here;
//   4. no uncaught errors under load.
//
// NOTE: LCP is deliberately NOT gated. Headless Chromium (verified on 151,
// 2026-09) emits first-paint/first-contentful-paint for this page but zero
// largest-contentful-paint entries — the LCP session ends on the first input
// (the language-prompt click) and no entries are buffered past it. FCP +
// time-to-ready cover the same ground for an app whose LCP element is the
// game screen painted after that click.
//
// Thresholds are generous on purpose: CI runners are slow and variable, so
// these gate order-of-magnitude regressions, not precise frame budgets. The
// measured values are logged on every run — tighten the constants against
// those numbers before treating a failure as a real regression.
import { test, expect } from '@playwright/test';

// Load profile: 4 minigame buildings (Farm/Bank/Temple/Wizard tower) at this
// level, Garden open — the probe's sampling window runs with all of that live.
const QPERF_LVL = 10;

// Gates. Calibrated 2026-09-06 on local desktop (285K/RTX 5090, 60Hz
// headless): FCP ~80ms, time-to-ready ~2–6s, 0 long tasks in window.
// CI (ubuntu-latest) is far slower; leave ~3-5x headroom there.
const MAX_FCP_MS = 4000; // first contentful paint
const MAX_READY_MS = 20_000; // navigation start -> Game.ready (playable)
const MAX_LONGTASKS = 20; // count of >=50ms tasks in the 3s window
const MAX_LONGTASK_MS = 1000; // total blocked ms in that window

const BOOT = { timeout: 30_000 };

/**
 * Load the game with `?debug=1` + `query`, dismiss the fresh-profile
 * language prompt (pick English), and wait for the engine to boot.
 * (Same helper as qa.spec.js — spec files are self-contained.)
 */
async function boot(page, query) {
	await page.goto(`/?debug=1${query}`, { waitUntil: 'load' });
	const lang = page.locator('#langSelect-English');
	try {
		await lang.waitFor({ state: 'visible', timeout: 5_000 });
		await lang.click();
	} catch {
		/* no language prompt (a profile already chose one) */
	}
	await page.waitForFunction(() => window.Game && window.Game.ready === 1, null, BOOT);
}

/**
 * Wait until the probe's #__dbgqa report matches `doneRe` and return the
 * full report text.
 */
async function qaReport(page, doneRe, timeout = 60_000) {
	const el = page.locator('#__dbgqa');
	await expect(el).toContainText(doneRe, { timeout });
	return el.innerText();
}

/** No uncaught errors were painted onto the debug error surface. */
async function assertNoUncaughtErrors(page) {
	await expect(page.locator('#__dbg')).toHaveCount(0);
}

test('perf gate: boot speed + sustained 4-minigame load holds loop rate with low long-task time', async ({ page }) => {
	// Stamp the playable moment in-page: an init script polls Game.ready on
	// the navigation timeline, so the value excludes test-side round trips.
	// (16ms poll resolution is far below any gate precision needed here.)
	await page.addInitScript(() => {
		window.__timeToReadyMs = null;
		const t0 = performance.now();
		const iv = window.setInterval(() => {
			if (window.Game && window.Game.ready === 1) {
				window.__timeToReadyMs = performance.now() - t0;
				window.clearInterval(iv);
			}
		}, 16);
	});

	await boot(page, `&qa=perf&qlvl=${QPERF_LVL}`);

	const timeToReady = await page.evaluate(() => window.__timeToReadyMs);
	const fcp = await page.evaluate(() => {
		const p = performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint');
		return p ? p.startTime : -1;
	});

	// The probe's report element is appended the moment its 3s steady-state
	// sampling window starts (after all four minigames loaded + Garden open).
	await page.locator('#__dbgqa').waitFor({ timeout: BOOT.timeout });

	// Long-task observation starts here, capturing the probe's 3s window.
	// A few ms at the very start can slip past us — that only weakens the
	// gate, never flukes it.
	await page.evaluate(() => {
		window.__perfLongTasks = [];
		new PerformanceObserver((list) => {
			for (const e of list.getEntries()) window.__perfLongTasks.push(e.duration);
		}).observe({ type: 'longtask' });
	});

	// Match the bare "verdict:" so a BELOW-target result fails fast with the
	// full report instead of burning out the wait timeout.
	const report = await qaReport(page, /verdict:/, 90_000);
	expect(report, report).not.toMatch(/BELOW target/);
	expect(report).toMatch(/target Game\.fps = 30/);

	const tasks = await page.evaluate(() => window.__perfLongTasks);
	const totalMs = tasks.reduce((a, b) => a + b, 0);
	console.log(
		`[perf-gate] lvl=${QPERF_LVL} fcp=${fcp.toFixed(0)}ms ready=${timeToReady?.toFixed(0) ?? 'n/a'}ms ` +
			`longTasks=${tasks.length} total=${totalMs.toFixed(0)}ms ` +
			`(${tasks.map((t) => t.toFixed(0)).join(',') || 'none'})`,
	);

	expect(fcp, `FCP: ${fcp.toFixed(0)}ms (gate < ${MAX_FCP_MS}ms)`).toBeGreaterThan(0);
	expect(fcp, `FCP: ${fcp.toFixed(0)}ms (gate < ${MAX_FCP_MS}ms)`).toBeLessThan(MAX_FCP_MS);
	expect(timeToReady, `time-to-ready missing (init script did not run?)`).not.toBeNull();
	expect(timeToReady, `time-to-ready: ${timeToReady.toFixed(0)}ms (gate < ${MAX_READY_MS}ms)`).toBeLessThan(MAX_READY_MS);
	expect(tasks.length, `long tasks in 3s window: ${tasks.length} (gate < ${MAX_LONGTASKS})`).toBeLessThan(MAX_LONGTASKS);
	expect(totalMs, `total long-task time in 3s window: ${totalMs.toFixed(0)}ms (gate < ${MAX_LONGTASK_MS}ms)`).toBeLessThan(MAX_LONGTASK_MS);

	await assertNoUncaughtErrors(page);
});
