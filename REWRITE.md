# Cookie Clicker 3 — Architectural Rewrite Status

_Last updated: 2026-08-20 (Phase 3 complete — all four core classes)._

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

**Current state: Phases 2 and 3 complete; Phase 4 (systems) is next.**
The engine's tier table, all 19 vanilla building declarations, all 786
vanilla upgrade declarations, all 501 vanilla achievement declarations, and
the foolObjects joke-business map + its localization loop live in the typed
content layer, and every line of CC3's own code (glue, extras,
localization, QA) type-checks under `tsc` strict. Phase 3 replaced the
runtime-built `var Game = {}` and the function-expression ctors with real
typed classes in `src/engine/core/`: the `Game` singleton is a real class
instance (slice 1), the 740-line `Game.Object` ctor is the real
`Building` class (slice 2), the `Game.Upgrade` ctor + its 13 prototype
methods + the two non-capturing factories are the real `Upgrade` class and
its exported factory functions (slice 3), and the `Game.Achievement` ctor +
`getType`/`toggle` + the four non-capturing factories are the real
`Achievement` class and its exported factory functions (slice 4).
`types.ts` now aliases all three content primitives to their classes — the
types are the implementation, not just the description. The game builds
and passes all 15 Playwright QA probes at every commit.

## Branch / commit state

| Branch  | HEAD      | Meaning                                                        |
| ------- | --------- | -------------------------------------------------------------- |
| `master`| `dafffc6` | The finished, deployable CC3 (deploy gate). Untouched by the rewrite. |
| `rewrite` (work) | `38597d9` | The rewrite, built on top of the 1:1 conversion.        |

Rewrite history (old → new):

```
3539634  Convert the full game to TypeScript (1:1 from master)   <- the rename-based conversion
3dc68fa  Rewrite Phase 1: typed engine surface + fully typed CC3 code
b2bef7e  Rewrite Phase 2 (slice 1): extract tier table into typed content layer
1ab1ff5  Rewrite Phase 2 (slice 2): extract vanilla building content into typed module
94092c1  Rewrite: add REWRITE.md status document
66a11ff  Rewrite Phase 2 (slice 3): extract vanilla upgrade content into typed module
65040d2  Rewrite Phase 2 (slice 4): extract vanilla achievement content into typed module
9198b34  Rewrite Phase 2 (slice 5): extract foolObjects map + localization loop into typed module
641af6a  Rewrite Phase 3 (slice 1): replace var Game={} with the GameCore class instance
6ecbecc  Rewrite Phase 3 (slice 2): the Game.Object ctor is now the Building class
c044c85  Rewrite Phase 3 (slice 3): the Game.Upgrade ctor is now the Upgrade class
38597d9  Rewrite Phase 3 (slice 4): the Game.Achievement ctor is now the Achievement class
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

### Phase 2 — content extraction (complete)

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
   inherited this bridge as-is.**

- **Slice 4 — achievements (commit `65040d2`).**
   `src/engine/content/achievements.ts` (1,115 lines):
   `declareVanillaAchievements(Game)` holds all **501** vanilla achievement
   declarations — 192 `new Game.Achievement(…)`, 252 `Game.TieredAchievement(…)`,
   57 `Game.ProductionAchievement(…)` — plus the 46 `Game.BankAchievement(…)`
   and 46 `Game.CpsAchievement(…)` calls and the `order` bookkeeping. Moved
   with the declarations (assigned on `Game`, so the modding surface is
   unchanged): the `Game.Achievement` ctor + `getType`/`toggle` prototype
   methods, `Game.Win`, `Game.RemoveAchiev`, `Game.CountsAsAchievementOwned`,
   `Game.HasAchiev`, the four factories, `Game.thresholdIcons`, and the
   Bank/Cps achievement registries. 1,070 lines of the engine's `Game.Init`
   (lines 9,552–10,621 pre-slice) are gone; the engine keeps the
   `Game.Achievements*` init lines under the ACHIEVEMENTS banner and the
   post-declaration `levelAchiev10` loop + `LocalizeUpgradesAndAchievs()`,
   which run after the content call exactly as before. The original
   Init-scoped `var order=0` became a bare assignment through the bridge,
   which the (now moved) `Game.Achievement` ctor reads. Documented
   runtime-preserving deltas: `this: any` + `: any` param annotations on
   the ctor/factories (tsgo TS7006 even under contextual `any`), the
   shadowing `var building` → `obj` rename in ProductionAchievement
   (tsgo TS2403), the four write-only `var achiev=` binding drops, and one
   compile-erased `achievUnlock!` non-null assertion.

- **Slice 5 — foolObjects (commit `9198b34`).**
   `src/engine/content/foolObjects.ts` (52 lines):
   `declareVanillaFoolObjects(Game)` holds the `Game.foolObjects`
   joke-business map (20 entries: the 19 buildings → joke name/desc/icon,
   plus `'Unknown'`) and its `if (true)//if (!EN)` localization loop —
   33 lines (old 8,611–8,643, immediately after the building block), cut
   verbatim with **zero deltas**: no annotations, no renames, no dropped
   bindings; the block type-checks as-is against `Game`'s index
   signature. All the boundary work: `LocFn`'s first param widened
   `string` → `string | undefined` (faithful contract — see the type
   finding below) and a new `FindLocStringByPart: (match: string) =>
   string | undefined` ambient in `globals.d.ts` (published on window by
   the engine's shim, read bare by the module, same treatment as
   `loc`/`LBeautify`/`choose`). The engine's `Game.Init` now makes one
   call per content area: `Game.Tiers = TIERS`,
   `declareVanillaBuildings`, `declareVanillaUpgrades`,
   `declareVanillaAchievements`, `declareVanillaFoolObjects`.

Documented runtime-preserving deviations in slice 2 (all diff-verified):
local `i`→`j` loop rename in Grandma's CpS (a `var`-scope clash only visible
once typed), unused Grandma `pic` param renamed `_i`, and the Chancemaker
art literal's pre-existing **duplicate `rows` key** deduped, keeping the
last value (JS object-literal semantics).

### Phase 3 — core classes (complete)

- **Slice 1 — the `Game` singleton (commit `641af6a`).**
  `src/engine/core/game.ts` (new, 23 lines): `export class GameCore {
  [key: string]: any; }` plus `export const Game = new GameCore();`.
  The engine's `var Game={}` is replaced by a note, and the engine
  imports the singleton: every `Game.X = …` assignment, the MODDING-API
  IIFE, and the window shim's `Game` entry now target that one imported
  instance — same object identity, same assignment sequence, same
  `window.Game`. The class is deliberately an index-signature shell:
  the named systems surface (`Load`, `Launch`, `Loop`, `WriteSave`, …)
  is Phase 4's work, and `types.ts`' `Game` interface stays the
  description until then. **One documented delta (diff-verified,
  /tmp/verify-p3-game.mjs):** the `Timer.say=function(label){…}` line
  gained an explicit `;`. The original had no semicolon there and relied
  on ASI — the following `var Game={}` was a statement starter that
  forced the break. With that line gone, the next non-comment token after
  the closing `}` is `(`, so the parser reads the MODDING IIFE as a
  chained call on the `Timer.say` function expression
  (`sayFn(moddingIIFE())()` — the IIFE runs as an argument, then the
  `undefined` `sayFn` returns is called): boot crashed with
  `TypeError: (intermediate value)(intermediate value)(...) is not a
  function` and no `window.Game`. The explicit semicolon restores the
  original parse exactly (implicit ASI semicolon → explicit, same AST).
  Gates: tsc 0, build clean, 15/15 QA.

- **Slice 2 — the `Building` class (commit `6ecbecc`).**
  `src/engine/core/building.ts` (new, 852 lines): the engine's 740-line
  `Game.Object` function expression (pre-slice lines 7,663–8,402) is now
  the `Building` class. The ctor body is **verbatim** — diff-verified
  line-for-line against the pre-slice snapshot
  (`/tmp/verify-p3-building.mjs`): 737/737 body lines, 33 documented
  deltas, all type-level (13× `: any` closure-param annotations, the
  `_n`/`_bypass`/`i2`/`_ii` TS2403/TS6133 renames, the `+new Date(2013,7,8)`
  coercion, `as any`/`as number` casts, two `!` assertions, and four
  write-only local bindings commented out). The per-instance closures
  remain own-property assignments, and the `declare`d members are erased
  by both tsgo and esbuild, so the runtime instance shape is
  byte-identical to the original plain object. `types.ts` now aliases
  `Building` to the class (the 70-line interface is gone; its named
  members live on the class) and `GameSurface.Object` is
  `typeof BuildingClass`. The engine keeps the same slot:
  `Game.Object = Building` at the original line, plus an import. Five new
  ambient globals (`TopBarOffset`, `Langs`, `locId`, `writeIcon`, `Pic`).
  Documented contract deltas vs the old interface: `muted` is
  `boolean | number` (the ctor initializes `false`, the engine assigns
  0/1 — the old bare `number` never matched the ctor), `canvas`/`ctx` are
  `any` (the engine's `fillPattern` polyfill isn't in the DOM lib type),
  `getPrice(n?)` is optional (every engine call site omits `n`), and
  `baseCps` keeps its `number` contract behind one documented `as any`
  cast where the ctor mirrors `cps` 1:1.
  **The slice exposed a real bug in the window shim:** `Object.assign`
  copies `locId`/`EN`/`TopBarOffset` by value at module-eval time, before
  the language load reassigns them, so the class's `Langs[locId].w` read
  crashed boot (`Cannot read properties of undefined (reading 'w')`).
  Read-only accessors now bridge those three live engine vars next to the
  order/pool/power bridge (this also restores live `EN` for the content
  modules' non-English games). Gates: tsc 0, build clean, verify PASS,
  15/15 QA.

- **Slice 3 — the `Upgrade` class (commit `c044c85`).**
  `src/engine/core/upgrade.ts` (new, 368 lines): the engine's 34-line
  `Game.Upgrade` ctor (pre-slice lines 7,930–7,965) plus its 13 prototype
  methods (`getType`, `getPrice`, `canBuy`, `isVaulted`, `vault`, `unvault`,
  `click`, `buy`, `earn`, `unearn`, `unlock`, `lose`, `toggle`) are now the
  `Upgrade` class, and the two non-capturing factories
  (`Game.TieredUpgrade`, `Game.SynergyUpgrade`) are exported factory
  functions. The ctor body is **verbatim** (33/33 lines, 0 deltas) and the
  method bodies are verbatim except `buy()` — diff-verified
  line-for-line against the pre-slice snapshot
  (`/tmp/verify-p3-upgrade.mjs`): 8 documented `buy()` deltas
  (`cancelPurchase: any` / `selected: any` — the original reassigns a
  boolean / the for-in string index into each 0-sentinel; the numeric
  choices loop `i`→`i2` for TS2403 vs the for-in `i` above; `sortMap`
  params annotated). The prototype methods became **class methods** —
  verified unobservable: no `instanceof` / for-in / `Object.keys` / `in`
  over upgrade instances anywhere in `src`. The interleaved
  `Game.storeBuyAll` / `Game.vault=[]` statements stay in the engine in
  place; the factories are assigned `Game.TieredUpgrade=TieredUpgrade` /
  `Game.SynergyUpgrade=SynergyUpgrade`. `types.ts` replaces the 27-member
  `Upgrade` interface with the class alias, `Game.Upgrade` is
  `typeof UpgradeClass`, the factories are `typeof …Fn`. No runtime
  imports in the new module — `Game`, `loc`, `cap`, `EN`, `l`, `choose`,
  `PlaySound`, `writeIcon` and the `order`/`pool`/`power` bridge vars all
  resolve through `globals.d.ts` to the window shim (the three bridge vars
  read the live engine vars through the accessor bridge, exactly as the
  original Init-scoped reads did).
  **Contract deltas vs the old interface:** the class declares the
  ctor-assigned data the old interface left to the index signature
  (`power`, `unlockAt`, `techUnlock`, `parents`, `type`); `buildingTie` is
  typed `Building | Upgrade | 0` to match the ctor's 0 sentinel (the old
  optional type never matched it); `priceFunc` gains an optional `(me?)`
  param because the body calls `this.priceFunc(this)`; `buy(bypass?)` is
  optional because `click()` calls `this.buy()` 0-arg. The Tiered/Synergy
  factory bodies carry `!`/`as any` where they read optional-typed
  `buildingTie1`/`buildingTie2`/`tier`/`unshackleUpgrade`/`ddesc`
  unguarded (the original passes `undefined` through — `Game.Has` falses
  on it; `(this.buildingTie as any).id` because the non-optional 0-sentinel
  union can't be stripped by `!`). Gates: tsc 0, build clean, verify PASS,
  15/15 QA.

- **Slice 4 — the `Achievement` class (commit `38597d9`).**
  `src/engine/core/achievement.ts` (new, 144 lines): the `Game.Achievement`
  ctor (23-line body, verbatim, 0 deltas — including the per-instance
  `click` closure) plus its `getType`/`toggle` prototype methods are now
  the `Achievement` class, and the four non-capturing factories
  (`Game.TieredAchievement`, `Game.ProductionAchievement`,
  `Game.BankAchievement`, `Game.CpsAchievement`) are exported factory
  functions. The Phase-2 slice had parked these in
  `content/achievements.ts` (assigned on `Game` from
  `declareVanillaAchievements`); this slice moves them again, to core. The
  content module now assigns `Game.Achievement=Achievement` and the four
  `Game.X=X` factory lines at the same Init point — same
  self-registration (`Game.last`, `Game.Achievements`,
  `Game.AchievementsById`, `Game.AchievementsN`), same `order`-bridge read
  (the ctor's bare `order` resolves to the live engine var through the
  window accessors, exactly as the content module's bare read did), same
  declaration order/ids. `Game.Win` / `Game.RemoveAchiev` /
  `Game.CountsAsAchievementOwned` / `Game.HasAchiev` /
  `Game.thresholdIcons` and the Bank/Cps registries stay in the content
  module in place (the factories read them through `Game`). `types.ts`
  replaces the 17-member `Achievement` interface with the class alias —
  the class also declares the ctor data the interface left to the index
  signature (`disabled`, `type`) — and `Game.Achievement` is
  `typeof AchievementClass`, **closing the Phase-1 `any`** (tsgo rejects
  function expressions for construct signatures; a real class has none of
  those problems). The four factories are `typeof …Fn`, and
  `BankAchievement`/`CpsAchievement` are now NAMED on the Game surface
  (previously index-signature only). No runtime imports in the new module:
  `Game`, `loc`, `LBeautify`, `toFixed` and the `order` bridge var resolve
  through `globals.d.ts` to the window shim.
  **Documented deltas (all runtime-identical, diff-verified by
  `/tmp/verify-p4-achievement.mjs`):** the ctor's Phase-2 `this: any`
  header annotation is dropped (it existed because tsgo inferred a
  container `this` for the assigned function expression; a real ctor's
  `this` is the class instance), and the factory headers gain explicit
  `: any` param annotations (tsgo TS7006 convention) with `q?`/`mult?`
  made optional to match the call sites that omit them (the old GameSurface
  already typed `ProductionAchievement`'s `q`/`mult` optional; Bank/Cps
  were untyped until now — the 1-arg calls always passed `undefined`,
  which the falsy `q` checks treat as "no quote"). Gates: tsc 0, build
  clean, verify PASS (both files reconstructed exactly), 15/15 QA.

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
- **tsgo rejects function expressions for construct signatures** —
  assigning `X=function(…){…}` to a type carrying a `new` signature fails
  (tested: construct-only, hybrid call+construct, and `Function` —
  TS2322/TS2351). A ctor value *assigned from checked code* therefore
  cannot keep a construct-signature type: `Game.Achievement` is `any`
  (contract in a doc comment) until Phase 3's real class. Ctors assigned
  only inside the `@ts-nocheck` engine (`Game.Object`, `Game.Upgrade`)
  keep theirs.
- **tsgo reports TS7006 even under a contextual `any`** (named member or
  index signature): params of checked function expressions need explicit
  `: any` (the slice-3 `function(obj: any)` convention).
- **tsgo infers a container `this` for property function expressions**:
  `Game.X=function(){ return this; }` infers `this` as the `Game` object,
  so the moved `Game.Achievement` ctor needed an explicit `this: any`.
- **`loc` accepts an `undefined` id at runtime — and the code relies on it
  being falsy.** `loc` indexes its string tables with the raw key
  (`locStrings[id]`); a key that `FindLocStringByPart` reports as missing
  falls through to `return baseline||id`, i.e. `undefined` when both are
  absent. Verbatim call sites depend on that falsy result
  (`loc(FindLocStringByPart(…)) || fallback`), and the engine has one
  unguarded `loc(FindLocStringByPart(…))` call in the building refresh —
  so `LocFn`'s first param is `string | undefined`, not `string`.
- **tsgo TS2739: an index-signature-only class is not assignable to a
  named interface.** The index signature does not satisfy the interface's
  named members, so a `class X { [key: string]: any; }` cannot stand in
  for `interface X`. Phase 3's classes therefore declare the interface's
  named members (as `declare` fields / real methods) and `types.ts`
  aliases the class — no cast, no gap.
- **Target ES2022 ⇒ `useDefineForClassFields: true`**: bare class field
  declarations emit `Object.defineProperty` with `undefined` values,
  adding own-props the original plain objects never had. Phase 3 classes
  use `declare`-only fields: erased by both tsgo and esbuild, so the
  instance shape is byte-identical to the original and no tsconfig change
  is needed.
- **A class *value* is assignable to `typeof Class` / construct-signature
  properties** (scratch-verified): this closes the Phase-1 finding above —
  `Game.Achievement: any` can become `typeof Achievement`, and
  `Game.Object`/`Game.Upgrade` can be the real classes, once the classes
  exist.
- **Optional trailing ctor params** let pre-existing call sites with
  varying arities type-check unchanged (`buyFunction?: any` for
  `Game.Object`, whose 8-arg form predates the optional 9th).
- **Parse-level, not type-level, but found the same way:** the engine is
  semicolon-less classic code, and removing *any* line can shift an ASI
  boundary. Slice 1's removal of `var Game={}` deleted the statement
  starter that forced the break after `Timer.say=function(label){…}`,
  re-parsing the MODDING IIFE as a chained call on that function
  expression (boot crash, `window.Game` never set). Rule for all Phase 3
  slices: when deleting a line from the engine, check what ASI role the
  surrounding lines had; add explicit `;` where the break is load-bearing
  (same AST as the original implicit one).
- **The window shim's `Object.assign` copies primitives by value.** It runs
  once at module-eval time, so any engine `var` that is reassigned later
  (`locId` 'NONE'→'EN', `EN`, `TopBarOffset`) is captured stale on
  `window`. A `@ts-nocheck`-free module that reads such a name bare
  (i.e. via `window`) sees the eval-time value, not the live one — slice 2
  caught this as a boot crash in the `Building` class's `Langs[locId].w`
  read. Read-only `Object.defineProperty` accessors bridge the live vars
  (the same pattern as the order/pool/power bridge); `EN`'s accessor also
  restores correct non-English behavior for the Phase 2 content modules.
- **tsgo TS1031: `declare` cannot modify a class *method* element.** The
  method surface of a class whose methods are assigned per-instance in the
  ctor is carried instead as erased function-typed properties
  (`declare buy: (amount?: number) => number | undefined;`) — same
  contract, legal syntax, erased just like field `declare`s.
- **tsgo `noUnusedLocals` ignores the `_` prefix for plain locals** (it
  honors it for params and for-in targets). A verbatim body's write-only
  locals (`desc`, `h` in the building ctor) can't be silenced by renaming;
  they're commented out instead — the dropped statements are plain
  property reads/writes with no side effects, so runtime-identical
  (diff-verified as four of the 33 documented deltas).
- **tsgo TS2454 (use before assignment) is silenced by a non-null
  assertion (`selected!`)** but *not* by `as any` and not by reading the
  var through a closure (scratch-verified both ways). The building
  tooltip's `selected==i` compares a var that is only assigned inside the
  `mouseOn` branch; the original read the hoisted (possibly unassigned)
  var, and `selected!` reproduces that read exactly.
- **`Art.pic`'s declared type doesn't match its real call shape.** The
  interface says `string | ((i: string) => string)`, but the building draw
  calls it as `pic(this, i)` (two args) and `bg` as `bg(this, ctx)`; the
  verbatim body treats both as `any` rather than pretend the lib type is
  complete.
- **The legacy `0`-sentinel idiom defeats both inference and `!`.**
  `buy()` opens with `var cancelPurchase=0` / `var selected=0` and
  reassigns a **boolean** (`!this.clickFunction()`) and a **for-in string
  index** into them respectively. tsgo infers the initializer's type
  (`number`) and rejects the widening reassignment, so both are declared
  `: any`. Separately, `buildingTie` is initialized to `0` ("none") by the
  ctor, so its real type is `Building | Upgrade | 0` — the old interface's
  *optional* `Building | Upgrade` never matched the `0`. Because the `0`
  member makes the union **non-optional**, a non-null assertion (`!`)
  cannot strip it (there's no `undefined`/`null` to remove), so the
  factory closures read `(this.buildingTie as any).id` rather than
  `this.buildingTie!.id`.
- **A numeric `for` loop and a `for-in` over the same scope collide.**
  `buy()` runs `for (var i in choices)` (twice) and later
  `for (var i=0; i<choices.length; i++)`. tsgo flags the second as a
  same-scope redeclaration with an incompatible type (TS2403), so the
  numeric loop's `i` is renamed `i2` (the `i` it interpolates into the
  generated `onMouseOver` handler string is renamed too).
- **Method calls in the original are arity- and `this`-loose.** `click()`
  calls `this.buy()` with **zero** args, so `buy`'s `bypass` param must be
  optional (`buy(bypass?)`) or the class won't type-check. The class body
  calls `this.priceFunc(this)`, but the content closures assign
  `priceFunc` as a 0-arg function; the declared `priceFunc` therefore takes
  an optional `(me?)`. And the `descFunc`/`priceFunc` closures the
  factories assign read `this.buildingTie1`/`this.tier` — tsgo infers
  `this` as the `Upgrade` instance (correct), which is why those optional
  members surface as `!`/`as any` rather than plain accesses.

## Architecture notes / invariants to preserve

- The engine (`src/engine/main.ts`, currently 11,740 lines after Phase 3)
  is a module that no longer builds `Game` itself: the singleton is the
  `GameCore` instance exported by `src/engine/core/game.ts`, and the
  engine imports it and mutates it exactly as it mutated the old
  `var Game = {}`. It remains `@ts-nocheck` until Phase 4 restructures
  it; it can receive imports (it already imports `content/tiers`,
  `content/buildings`, `content/upgrades`, `content/achievements`,
  `content/foolObjects`, `core/game`, `core/building`, and
  `core/upgrade`; `content/achievements` additionally imports
  `core/achievement`).
- The content **ctors are real classes called with `new`** (`new
  Game.Object`, `new Game.Upgrade`, `new Game.Achievement`) — the Phase 3
  classes; call sites are unchanged from the 2.048 originals. The
  **factories** (`TieredUpgrade(name, desc, building, tier)`,
  `TieredAchievement(…)`, etc.) remain **plain functions** with **string**
  building names and post-call `.order` assignment — the call style is
  preserved, but they are now typed functions in `core/` (slices 3–4).
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
  `src/globals.d.ts`. It copies **by value at module-eval time**, so
  object/function globals stay live (same reference) but primitive globals
  that are reassigned later (`locId`, `EN`, `TopBarOffset`) are frozen at
  their eval-time values — those need the read-only accessor bridge
  (slice 2 added `locId`/`EN`/`TopBarOffset` next to order/pool/power).
- **The order/pool/power bridge** (slice 3): `var order, pool, power` at
  engine module scope + `Object.defineProperty(window, …)` accessors next
  to the shim. Content modules assign those names bare (window scope);
  engine ctors read them unqualified (module scope). One shared state,
  original assignment sequence. Content modules must **not** declare
  local `var order/pool/power` (that shadows the bridge and silently
  breaks every assignment). Slice 4 (achievements) inherited it: its
  `var order=0` became a bare assignment and the moved `Game.Achievement`
  ctor reads the engine's module-scope var. Slice 5 (foolObjects) needed
  no bridge at all — a data map plus a loc loop, no ctor declarations.

## What remains

### Phase 2 — content extraction (complete)

All five content slices are extracted; every entry in the original
`Game.Init` content region now lives in `src/engine/content/`.

| Slice | Content | Result |
| ----- | ------- | ------ |
| ~~1~~ | ~~Tiers~~ | **done — commit `b2bef7e`** (14 numeric + 3 special tiers) |
| ~~2~~ | ~~Buildings~~ | **done — commit `1ab1ff5`** (19 `new Game.Object`) |
| ~~3~~ | ~~Upgrades~~ | **done — commit `66a11ff`** (786 declarations incl. 233 `Game.NewUpgradeCookie`) |
| ~~4~~ | ~~Achievements~~ | **done — commit `65040d2`** (501 declarations + 46 bank + 46 cps calls) |
| ~~5~~ | ~~foolObjects + loc loop~~ | **done — commit `9198b34`** (20-entry map + `if (true)` loc loop; zero deltas) |

### Phase 3 — core classes (complete)

Replace the runtime-built `var Game = {}` and the function-expression ctors
with real typed classes in `src/engine/core/`; `types.ts` becomes the
implementation, not just the description. Core modules have **no runtime
imports** — every engine global they read (`Game`, `loc`, `l`, `EN`,
`choose`, `cap`, `LBeautify`, `PlaySound`, `Beautify`, `toFixed`,
`FindLocStringByPart`, the `order`/`pool`/`power` bridge vars, …) resolves
through the ambient `globals.d.ts` declarations to the window shim, so there
are no import cycles. (An `import type { … } from '../types'` is fine and
is used by all three content classes — `core/building.ts`,
`core/upgrade.ts`, `core/achievement.ts` — for their cross-references: it
is erased at compile time, adds no runtime edge, and cannot create a
cycle.) Bodies
keep their original indentation (header line replaced, no re-indent) so
diff-verify stays meaningful.

| Slice | Content | Source (pre-slice line refs) |
| ----- | ------- | ---------------------------- |
| ~~1~~ | **`GameCore`** — the `Game` singleton (index-signature shell; the named systems surface is Phase 4) | `src/engine/core/game.ts` (new) |
| ~~2~~ | **`Building`** — the `Game.Object` ctor (740 lines, per-instance closures) → `core/building.ts`; `Game.Object = Building` in the engine; `types.ts` aliases the class, `Game.Object: typeof Building` — **done — commit `6ecbecc`** | engine 7,661–8,400 |
| ~~3~~ | **`Upgrade`** — ctor + 13 prototype methods → `core/upgrade.ts`; the interleaved `Game.storeBuyAll` / `Game.vault=[]` statements stay in the engine in place; the non-capturing `Game.TieredUpgrade` / `Game.SynergyUpgrade` factories move to core — **done — commit `c044c85`** | engine 8,666–8,935 (ctor 8,666–8,701, prototypes 8,702–8,935), factories 9,105–9,149 |
| ~~4~~ | **`Achievement`** — ctor + `getType`/`toggle` → `core/achievement.ts`; the four non-capturing factories (`TieredAchievement`, `ProductionAchievement`, `BankAchievement`, `CpsAchievement`) move to core; `types.ts` names `BankAchievement`/`CpsAchievement` — **done — commit `38597d9`** | `content/achievements.ts` 45–70, 71, 106–117; factories 129–171 |

**Phase 3 complete.** All four slices landed (`641af6a`, `6ecbecc`,
`c044c85`, `38597d9`); `types.ts` aliases the three content primitives
(`Building`, `Upgrade`, `Achievement`) to their classes, and every
function-expression ctor in the engine is now a real class or an exported
core function. The game builds and passes 15/15 QA at each slice commit.

Fidelity decisions (canonical for all slices):

- **Classes carry the interface's named members.** An index-signature-only
  class is *not* assignable to a named interface (tsgo TS2739 — the index
  signature does not satisfy named members), so each class declares the
  named members and `types.ts` aliases the class; no assignability gap
  remains (e.g. the ctor's `Game.Objects[this.name] = this` then
  type-checks).
- **`declare`-only fields.** Target ES2022 ⇒ `useDefineForClassFields: true`
  would emit `undefined` own-props for bare field declarations, changing
  the instance shape. `declare` members are erased (tsgo *and* esbuild),
  so the runtime instance stays byte-identical to the original plain
  object; no tsconfig change.
- **Per-instance closures stay ctor assignments; legacy prototype methods
  become class methods.** Verified unobservable: no `instanceof`, no
  `for`-in / `Object.keys`, and no `in`-operator over upgrade/achievement
  instances anywhere in `src` (the legacy prototype props were enumerable
  plain assignments; class methods are non-enumerable — nothing reads that).
- **Optional trailing ctor params** (`buyFunction?: any`) keep the existing
  call sites (`19× new Game.Object(…)` in buildings, the blackHoleInverter
  building, 239× `new Game.Upgrade`, 194× `new Game.Achievement`)
  type-checking unchanged.
- **Capture-ful factories stay content-scoped.** `Game.NewUpgradeCookie`,
  `Game.NewUnshackleBuilding`, `Game.NewUnshackleUpgradeTier` and
  `Game.GrandmaSynergy` close over Init-scoped vars in
  `content/upgrades.ts`; moving them would change their closures or add
  shared mutable state. They stay exactly where they are (the modding
  surface `Game.X` is unchanged either way). The non-capturing factories
  (Tiered/Synergy upgrades, the four achievement factories) move to core.
- **The ASI boundary is now explicit** (slice 1): the original code relied
  on the `var Game={}` line to force the automatic semicolon after the
  semicolon-less `Timer.say=function(…){…}` expression; with that line
  gone the MODDING IIFE would parse as a chained call on it and crash boot.
  The `Timer.say` line now ends in an explicit `;` (same AST as the
  original's ASI semicolon).

### Phase 4 — systems

Retype (and restructure) the engine's systems in dependency order:
economy/CpS (`CalculateGains`, `ComputeCps`, buffs), save/load
(`LoadSave`/`WriteSave`, `toSave`, save-code import/export — **save-format
compatibility must be preserved byte-for-byte** against `master`), shimmers +
wrinklers, ascend/reincarnate, offline gain, the Loader/asset system.

| Slice | Content | Result |
| ----- | ------- | ------ |
| ~~1~~ | **Economy math** — `HowMuchPrestige`, `HowManyCookiesReset`, `EarnHeavenlyChips`, `GetHeavenlyMultiplier`, `ComputeCps`, `GetTieredCpsMult` → `systems/economy.ts`; engine keeps the same `Game.X` slots at the original Init positions | **done — commit `7d829c4`** (64/64 body lines verbatim; deltas: `!` on optional class surface + one `(me.fortune as any)`) |

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
