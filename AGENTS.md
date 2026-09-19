# Cookie Clicker 3 Agent Instructions (`AGENTS.md`)

This file contains repository-specific operational instructions, verification matrices, and baseline guards for AI coding agents working on **Cookie Clicker 3**.

---

## 🎯 Verification Matrix

Always run the narrowest validation command that covers your specific changes before running full regression suites or claiming a task is complete:

| Change Scope | Target Verification Command | Notes |
| --- | --- | --- |
| **TypeScript / Engine Types** | `npm run typecheck` | Runs `tsc --noEmit` in strict mode |
| **Factory Dungeon Minigame** | `npx playwright test tests/dungeon.spec.js` | Full functional test of Dungeon minigame |
| **Cookie Cow Special** | `npx playwright test tests/cow.spec.js` | Verifies Cow growth, milk math, and save state |
| **Touch & Hold-to-Buy** | `npx playwright test tests/touch-hold.spec.js` | Verifies store repeat-buy touch gestures |
| **Music & Jukebox UI** | `npx playwright test tests/music-picker.spec.js` | Verifies Web music player and track picker |
| **Upgrade Fingerprints** | `npx playwright test tests/upgrades-fingerprint.spec.js` | Asserts registered upgrade baseline |
| **Building Balance** | `npx playwright test tests/balance.spec.js` | Asserts building cost/CpS balance curves |
| **Cross-Branch Save Format** | `npm run test:compat` | Cross-branch save export/import diff test |
| **Full Regression Suite** | `npm test` | Runs the 31 QA debug probes (`tests/qa.spec.js`) |
| **Production Build** | `npm run build` | Validates Vite bundle & stamps Service Worker cache |

---

## 🔒 Ratchets & Baseline Fingerprints

- **Golden Upgrade Baseline (`tests/upgrades-baseline.json`)**:
  - The upgrade fingerprint test (`tests/upgrades-fingerprint.spec.js`) asserts that all registered upgrades match the committed baseline (1,019 upgrades).
  - **Rule**: If upgrade tests fail, diagnose and fix the root cause. Do **NOT** regenerate the baseline file unless an intentional content update was requested (use `UPGRADES_UPDATE=1 npx playwright test tests/upgrades-fingerprint.spec.js`).
- **Building Balance Baseline**:
  - Building cost and CpS balance curves are pinned by `tests/balance.spec.js`.
  - **Rule**: Re-generate only when intentionally balancing building tiers (`BALANCE_UPDATE=1 npx playwright test tests/balance.spec.js`).
- **Save Format Compatibility**:
  - The save format is byte-compatible with upstream Cookie Clicker 2.048 saves.
  - **Rule**: Any change to save encoding/decoding (`src/engine/systems/save.ts` or `src/engine/base64.ts`) must pass `npm run test:compat` without altering exported save structures.

---

## 🛡️ Generated File & Build Guards

- **`dist/` Directory**:
  - `dist/` is generated output. Never edit files inside `dist/` directly.
- **Service Worker Cache Stamping (`public/sw.js`)**:
  - The Vite build plugin (`cc3:stamp-service-worker`) rewrites the `__BUILD__` cache name placeholder in `public/sw.js` with a content hash of `dist/`.
  - **Rule**: Always run `npm run build` after making changes to verify production bundle generation and service worker cache stamping.

---

## 📐 Code Style & Integrity Guidelines

- **Strict TypeScript**: Keep `tsconfig.json` `strict: true`. All code in `src/` must pass `npm run typecheck` cleanly.
- **Documentation Preservation**: Maintain docstrings and inline JSDoc comments explaining legacy CC2 compatibility and CC3 design choices.
- **Zero Third-Party Runtime Dependencies**: Keep the app 100% self-contained—no external CDN links, no ads, no trackers, no external CSS/font requests.
