#!/usr/bin/env node
/**
 * scripts/check-bundle-size.mjs — first-load size gate.
 *
 * Runs after `vite build` (wired into `npm run build`, so it also runs inside
 * the playwright webServer build that feeds every test job in CI): the
 * critical `index-*.js` chunk — what every visitor downloads, parses and
 * compiles before the game is playable — must not grow past the budget.
 * This is the download-side twin of the runtime perf gate (tests/perf.spec.js
 * covers FCP / tick rate / long tasks, not bytes).
 *
 * The budget has ~6% headroom over the 2026-09-05 baseline (807 KB after the
 * extras + changelog chunks went deferred). A miss usually means content
 * that belongs in a deferred chunk (an extra, a language, the changelog)
 * leaked back into the critical path — check the chunk list below before
 * raising the budget.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAX_INDEX_CHUNK_BYTES = 860_000;

const assets = join(process.cwd(), 'dist', 'assets');
let entries;
try {
	entries = readdirSync(assets);
} catch {
	console.error('[bundle-size] FAIL: dist/assets is missing — did `vite build` run?');
	process.exit(1);
}

const indexFiles = entries.filter((f) => /^index-.*\.js$/.test(f));
if (indexFiles.length !== 1) {
	console.error(`[bundle-size] FAIL: expected exactly one index-*.js chunk, found ${indexFiles.length}: ${indexFiles.join(', ') || '(none)'}`);
	process.exit(1);
}

const chunks = entries
	.filter((f) => f.endsWith('.js'))
	.map((f) => ({ name: f, size: statSync(join(assets, f)).size }))
	.sort((a, b) => b.size - a.size);

console.log('[bundle-size] top chunks:');
for (const c of chunks.slice(0, 8)) {
	console.log(`[bundle-size]   ${(c.size / 1024).toFixed(0).padStart(5)} KB  ${c.name}`);
}

const index = chunks.find((c) => c.name === indexFiles[0]);
if (index.size > MAX_INDEX_CHUNK_BYTES) {
	console.error(
		`[bundle-size] FAIL: critical index chunk is ${index.size} bytes — budget is ${MAX_INDEX_CHUNK_BYTES}. ` +
		`If this is deliberate, raise MAX_INDEX_CHUNK_BYTES in scripts/check-bundle-size.mjs with a comment on why.`,
	);
	process.exit(1);
}
console.log(`[bundle-size] PASS: index chunk ${index.size} bytes <= ${MAX_INDEX_CHUNK_BYTES}`);
