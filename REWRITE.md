# Cookie Clicker 3 — Architectural Rewrite Status

_Last updated: 2026-08-20 (session checkpoint after Phase 2, slice 3)._

## TL;DR

Cookie Clicker 3 is a Vite-based port of Cookie Clicker 2.048 (zero runtime
dependencies, `base: './'`, GitHub-Actions deploy to
`giveen.github.io/cookie-clicker-3/`). The original conversion (commit
`3539634`) turned the game into TypeScript 1:1 by renaming files and keeping
the legacy engine verbatim under `@ts-nocheck`. That satisfied "the game is in
TypeScript" but not "the game is written in TypeScript".

This document tracks the **architectural rewrite**: restructuring the 16k-line
engine into idiomatic typed TypeScript modules and classes, with the hard
constraint that **runtime behavior stays identical to `master`** at every step.

**Current state: Phase 2, slice 3 complete.** The engine's tier table, all
19 vanilla building declarations, and all 786 vanilla upgrade declarations
now live in the typed content layer, and every line of CC3's own code (glue,
extras, localization, QA) type-checks under `tsc` strict. The game builds
and passes all 15 Playwright QA probes at every commit.

## Branch / commit state

| Branch  | HEAD      | Meaning                                                        |
| ------- | --------- | -------------------------------------------------------------- |
| `master`| `dafffc6` | The finished, deployable CC3 (deploy gate). Untouched by the rewrite. |
| `rewrite` (work) | `66a11ff` | The rewrite, built on top of the 1:1 conversion.        |

Rewrite history (old → new):

```
3539634  Convert the full game to TypeScript (1:1 from master)   <- the rename-based conversion
3dc68fa  Rewrite Phase 1: typed engine surface + fully typed CC3 code
b2bef7e  Rewrite Phase 2 (slice 1): extract tier table into typed content layer
1ab1ff5  Rewrite Phase 2 (slice 2): extract vanilla building content into typed module
94092c1  Rewrite: add REWRITE.md status document
66a11ff  Rewrite Phase 2 (slice 3): extract vanilla upgrade content into typed module
```

## What "1:1" means here, and how it's enforced

Behavior must be indistinguishable from `master`. Because the rewrite
deliberately changes file structure (and soon the engine itself), a bundle
byte-diff is no longer a viable check; the gates are:

1. **`npx tsc --noEmit`** — strict, zero errors.
2. **`npm run build`** — `tsc && vite build` must succeed.
3. **`npx playwright test`** — all 15 QA probes in `tests/qa.spec.js` must
   pass (~51 s). The probes cover: minigame boot + Garden seed, store buys,
   golden-cookie frenzy, save export/import round-trip, 4-minigame frame
   budget, ascend/reincarnate math, offline gain, Santa + Dragon specials,
   screen-reader mode, wrinkler spawn/suck/pop, one-column mode, icon
   resolution, the Black Hole Inverter extras mod end-to-end, the v3.0
   animation pass, and reduced-motion behavior.

For each content slice the moved code is additionally **diff-verified against
the original block**: the only allowed deltas are type annotations (erased at
compile time) and individually documented, runtime-preserving renames.

## What was done

### Phase 1 — typed engine surface (commit `3dc68fa`)

- **`src/engine/types.ts` (new, ~565 lines)** — the canonical engine API:
  `Game` (lifecycle, economy, layout, content maps, modding, shimmers,
  seasonals), `Building`, `Upgrade`, `Achievement`, `Buff`, `Shimmer`,
  `Wrinkler`, `Tier`, `Mod`, `Prefs`, `Art`, and the window-boundary function
  types (`LocFn`, `BeautifyFn`, `PlaySoundFn`, `AddEventFn`, `AddLanguageFn`,
  `LocalizeContentFn`). Named members are the checked contract; each type
  carries a `[key: string]: any` index signature marking the dynamic legacy
  runtime surface (the QA probes also park ad-hoc state there, e.g.
  `G.__qaAscend`).
- **`src/globals.d.ts` (rewritten)** — declares the boundary against
  `types.ts`: bare `Game`, bare `loc`/`choose` (published on `window` by the
  engine's `Object.assign(window, …)` shim — which is what makes them resolve
  at runtime inside ESM modules), the `Element.prototype.getBounds` polyfill,
  and the full `window` surface (`VERSION`/`BETA`/`App`, `AddLanguage`,
  `Beautify`, `PlaySound`, `AddEvent`, `l`, `Base64`, the CC3 glue loaders,
  `__cc3Anim`, `__cc3Binverter`).
- **All CC3-owned code retyped with zero `any`**: `src/main.ts` (1,250 lines:
  boot glue, save handling, animation polish pass, all 15 QA probe
  implementations), `src/extras/blackHoleInverter.ts` (the extras mod), and
  all 13 localization modules `src/engine/loc/*.ts` (now
  `satisfies LanguageData` — note there are **13** languages, not 12).
- `catch (e: any)` blocks in `src/main.ts` are a **deliberate, documented
  escape hatch**: legacy engine code may throw non-`Error` values, and
  narrowing them would change behavior.

### Phase 2 — content extraction (in progress)

Content is moved out of the engine's giant `Game.Init` body into
`src/engine/content/` as typed modules. The engine calls the module's
declarator function from `Game.Init`.

**Safety invariant (verified):** `Game.Init` runs **exactly once per page
load** — `Game.Loader.loaded = Game.Init` and `Loader.onLoad` is guarded by
`doneLoading` (engine lines ~832–836). Module-level content singletons
therefore have the same once-created/once-mutated lifetime as the original
inline literals, making verbatim extraction 1:1.

- **Slice 1 — tiers (commit `b2bef7e`).** `src/engine/content/tiers.ts`:
  `TIERS: Record<number | string, Tier>` — the 14 numeric tiers plus the
  `synergy1`/`synergy2`/`fortune` special tiers, transcribed verbatim.
  Engine does `Game.Tiers = TIERS` and keeps its
  `for (var i in Game.Tiers) { Game.Tiers[i].upgrades = []; }` loop.
- **Slice 2 — buildings (commit `1ab1ff5`).**
  `src/engine/content/buildings.ts`: `declareVanillaBuildings(Game)` holds
  the 19 `new Game.Object(…)` declarations (Cursor … Cortex baker) plus their
  interleaved `Game.last.*` assignments and `Game.SpecialGrandmaUnlock=15`.
  Every CpS/buy closure is type-checked (`function (me: Building)`,
  `function (this: Building)`). The engine's 308-line block is replaced by a
  single call.

- **Slice 3 — upgrades (commit `66a11ff`).**
   `src/engine/content/upgrades.ts` (1,951 lines):
   `declareVanillaUpgrades(Game)` holds all **786** vanilla upgrade
   declarations — 231 `new Game.Upgrade(…)`, 271 `Game.TieredUpgrade(…)`,
   34 `Game.SynergyUpgrade(…)`, 17 `Game.GrandmaSynergy(…)`, and 233
   `Game.NewUpgradeCookie(…)` calls (the factory itself moved in with them)
   — plus the interleaved `order`/`pool`/`power` bookkeeping, the loc-time
   string helpers (`getStr*`, `strKittenDesc`), and the
   `Game.GrandmaSynergy` / `Game.NewUnshackleBuilding` /
   `Game.NewUnshackleUpgradeTier` factories (declaration-time callers; the
   modding surface stays on `Game`). 1,889 lines of the engine's
   `Game.Init` (~lines 9,095–11,370) are gone; the engine keeps the STAY
   list (seasonal machinery, veil functions, permanent-slot functions,
   `playGoldenCookieChime`, the post-declaration `computeSeasons()` +
   `UpgradesByPool`/`UnlockAt`/`UpgradePositions` post-processing, which
   runs after the content call, exactly as before).
   **The order/pool/power bridge:** the three values were Init-scoped
   closure vars read by the `Game.Upgrade`/`Game.Achievement` ctors; they
   now live at engine module scope (`var order, pool, power` at the top of
   `main.ts`) and are bridged to the content module through
   `Object.defineProperty(window, …)` accessors next to the window shim.
   The ctors keep reading the unqualified names (module scope); the content
   module keeps assigning bare names (window scope) — one shared state,
   same assignment sequence, same final values. **Slice 4 (achievements)
   inherits this bridge.**

Documented runtime-preserving deviations in slice 2 (all diff-verified):
local `i`→`j` loop rename in Grandma's CpS (a `var`-scope clash only visible
once typed), unused Grandma `pic` param renamed `_i`, and the Chancemaker
art literal's pre-existing **duplicate `rows` key** deduped, keeping the
last value (JS object-literal semantics).

### Type-level findings (bugs/quirks the types caught)

- `Game.Has()` returns **numeric 0/1** (`bought`), not a boolean — vanilla
  content does arithmetic on it.
- `Art` fields are all **optional** — the engine fills defaults at draw time
  (`art.h||48`, `art.rows||1`, `art.frames||1`), and Cursor passes a bare
  `{}`.
- `Art.pic` can be a **function** (Grandma's procedural sprite picker).
- `Game.Unlock` accepts `string | string[]`.
- Chancemaker art has a duplicate `rows` key in the 2.048 original.
- The 13 loc files all carry a PO header object under key `""`
  (`LanguageHeader`), which is why `AddLanguage`'s strings param is
  `Record<string, LanguageString>`, not `Record<string, string>`.
- **tsgo enforces TS2403 harder than classic tsc**: same-scope `var`
  redeclarations must all have the *same* type, even when the first is
  `any` (classic tsc accepts `any` baselines). The legacy
  declare/redeclare pattern (`var desc=…; var desc=function(…){…}`)
  therefore needs distinct names once typed, not just annotations.
- `choose` in the original is both a function *and* (in one verbatim 2.048
  tombola line) indexed with a comma expression —
  `choose['red','orange',…,'teal']` — which evaluates to `undefined`
  at runtime (a faithful 2.048 quirk; the tombola can draw that dead
  entry exactly as master does). TS2695 (unused comma left side) is a
  source property, fixed with a documented `// @ts-ignore`; the global
  type is non-generic with a string index signature because tsgo
  infers `unknown` from `any` arrays for `<T>(arr: readonly T[]) => T`.
- `Music` is `false` forever in this build (the engine assigns
  `Music=false` and no music system loads), so the jukebox methods'
  unguarded `Music.tracks` derefs are dead — declared `any`.
- The engine attaches the classic-script `seedrandom` PRNG polyfill to
  `Math` at module eval; `Math.seedrandom` is declared via an interface
  augmentation in `globals.d.ts`.
- `Date.now()-new Date(…)` coerces the Date at runtime; the typed
  equivalent makes that explicit with a unary `+` (runtime-identical).

## Architecture notes / invariants to preserve

- The engine (`src/engine/main.ts`, currently 13,859 lines after slice 3) is a module that
  still builds `Game` at runtime as `var Game = {}` inside one giant
  `Game.Init` body. It remains `@ts-nocheck` until Phases 3–4 restructure it;
  it can receive imports (it already imports `content/tiers`,
  `content/buildings`, and `content/upgrades`).
- Content ctors are called as **plain functions** (not `new`) with **string**
  building names (`TieredUpgrade(name, desc, building, tier)`, etc.);
  `.order` is assigned post-call. Keep this call style until the ctors
  themselves are retyped in Phase 3.
- `Game.last` is set by each content ctor and used by content declarations to
  attach per-building extras — it must stay populated in declaration order.
- Numeric booleans are the engine's idiom (`bought: 0/1`, `ready: 1`).
- Minigame keys `'minigameGarden.js'`, `'minigameGrimoire.js'`,
  `'minigameMarket.js'`, `'minigamePantheon.js'` are **runtime contracts**
  between the engine's `LoadScript`/module loader and the glue — they must
  not be renamed.
- The engine's `Object.assign(window, { … })` shim is what makes bare
  globals (`loc`, `choose`, `l`, …) resolve from ESM modules; any new typed
  module reading a bare engine global needs a matching declaration in
  `src/globals.d.ts`.
- **The order/pool/power bridge** (slice 3): `var order, pool, power` at
  engine module scope + `Object.defineProperty(window, …)` accessors next
  to the shim. Content modules assign those names bare (window scope);
  engine ctors read them unqualified (module scope). One shared state,
  original assignment sequence. Content modules must **not** declare
  local `var order/pool/power` (that shadows the bridge and silently
  breaks every assignment). Slice 4 inherits the bridge as-is.

## What remains

### Phase 2 — finish content extraction (same proven pattern)

| Slice | Content | Size / location in `src/engine/main.ts` |
| ----- | ------- | ---------------------------------------- |
| ~~3~~ | ~~Upgrades~~ | **done — commit `66a11ff`** (786 declarations incl. 233 `Game.NewUpgradeCookie`; see above) |
| 4 | **Achievements**: 192 `new Game.Achievement(`, 252 `Game.TieredAchievement(`, 57 `Game.ProductionAchievement(` | ~lines 9,552–10,630 now (ctors at 9,552/9,636/9,643; `//define achievements` at 9,680) — **inherits the order/pool/power bridge** |
| 5 | `Game.foolObjects` (building → joke business name/desc/icon map) + its localization loop | immediately after the building block (~line 8900 region) |

Each slice: verbatim cut → typed wrapper function → mechanical annotations →
engine wired to the call → diff-verify against original → `tsc` + `build` +
15 QA probes → commit.

### Phase 3 — core classes

Replace the runtime-built `var Game = {}` with real typed classes:
`Game`, `Building` (Object ctor), `Upgrade`, `Achievement`, plus the
tiered/synergy/production ctors. This is the step where `src/engine/main.ts`
loses most of its `@ts-nocheck`-excused surface; `types.ts` becomes the
implementation, not just the description.

### Phase 4 — systems

Retype (and restructure) the engine's systems in dependency order:
economy/CpS (`CalculateGains`, `ComputeCps`, buffs), save/load
(`LoadSave`/`WriteSave`, `toSave`, save-code import/export — **save-format
compatibility must be preserved byte-for-byte** against `master`), shimmers +
wrinklers, ascend/reincarnate, offline gain, the Loader/asset system.

### Phase 5 — minigames

Convert `src/engine/minigameGarden.ts` (2,027 lines),
`minigameMarket.ts` (1,085), `minigameGrimoire.ts` (509),
`minigamePantheon.ts` (508) to typed modules using the same boundary types.
Keep their URL keys intact (runtime contract).

### Phase 6 — verification + docs

- Full QA suite + targeted save-format compatibility checks (export a
  `master` save, import it on `rewrite`, diff the parsed state).
- Update `README.md` (architecture section), `tsconfig.json` comments, and a
  CI note (the deploy workflow is still `master`-gated by user decision —
  merging `rewrite` into `master` and deploying is a separate, explicit step).

### Housekeeping

- Retire or repurpose `scripts/transform-engine.mjs` (regenerates engine
  files from the 2.048 source used by the original conversion) and
  `scripts/scan-implicit-globals.mjs` as the engine becomes typed modules.

## Per-slice verification protocol (copy for future sessions)

```sh
npx tsc --noEmit          # strict, 0 errors
npm run build             # tsc && vite build
npx playwright test       # 15/15 probes, ~51 s (webServer: build + preview on :4173)
# diff the moved block against the original; only annotations +
# documented runtime-preserving renames allowed
git add -A && git commit -F /tmp/msg.txt   # write message via file; bash eats backticks in -m
```

Environment: Node v22.23.2, npm 12.0.2, TypeScript 7.0.2 (`tsc --noEmit`
native; `--ignoreConfig` is needed only when checking explicit file lists
against a specific tsconfig).
