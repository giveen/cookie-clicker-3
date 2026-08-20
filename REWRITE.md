# Cookie Clicker 3 — Architectural Rewrite Status

_Last updated: 2026-08-20 (Phase 3 in progress — slice 1: Game core class)._

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

**Current state: Phase 2 complete; Phase 3 in progress (slice 1 of 4).**
The engine's tier table, all 19 vanilla building declarations, all 786
vanilla upgrade declarations, all 501 vanilla achievement declarations, and
the foolObjects joke-business map + its localization loop live in the typed
content layer, and every line of CC3's own code (glue, extras,
localization, QA) type-checks under `tsc` strict. Phase 3 now replaces the
runtime-built `var Game = {}` and the function-expression ctors with real
typed classes in `src/engine/core/`: the `Game` singleton is a real class
instance (slice 1), followed by `Building` (slice 2), `Upgrade` (slice 3)
and `Achievement` (slice 4). The game builds and passes all 15 Playwright
QA probes at every commit.

## Branch / commit state

| Branch  | HEAD      | Meaning                                                        |
| ------- | --------- | -------------------------------------------------------------- |
| `master`| `dafffc6` | The finished, deployable CC3 (deploy gate). Untouched by the rewrite. |
| `rewrite` (work) | `641af6a` | The rewrite, built on top of the 1:1 conversion.        |

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

### Phase 3 — core classes (in progress)

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

## Architecture notes / invariants to preserve

- The engine (`src/engine/main.ts`, currently 12,770 lines after Phase 3
  slice 1) is a module that no longer builds `Game` itself: the singleton
  is the `GameCore` instance exported by `src/engine/core/game.ts`, and
  the engine imports it and mutates it exactly as it mutated the old
  `var Game = {}`. It remains `@ts-nocheck` until Phases 3–4 restructure
  it; it can receive imports (it already imports `content/tiers`,
  `content/buildings`, `content/upgrades`, `content/achievements`,
  `content/foolObjects`, and `core/game`).
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

### Phase 3 — core classes (in progress)

Replace the runtime-built `var Game = {}` and the function-expression ctors
with real typed classes in `src/engine/core/`; `types.ts` becomes the
implementation, not just the description. Core modules import **nothing** —
every engine global they read (`Game`, `loc`, `l`, `EN`, `choose`, `cap`,
`LBeautify`, `PlaySound`, `Beautify`, `toFixed`, `FindLocStringByPart`, the
`order`/`pool`/`power` bridge vars, …) resolves through the ambient
`globals.d.ts` declarations to the window shim, so there are no import
cycles. Bodies keep their original indentation (header line replaced, no
re-indent) so diff-verify stays meaningful.

| Slice | Content | Source (pre-slice line refs) |
| ----- | ------- | ---------------------------- |
| ~~1~~ | **`GameCore`** — the `Game` singleton (index-signature shell; the named systems surface is Phase 4) | `src/engine/core/game.ts` (new) |
| 2 | **`Building`** — the `Game.Object` ctor (740 lines, per-instance closures) → `core/building.ts`; `Game.Object = Building` in the engine; `types.ts` aliases the class, `Game.Object: typeof Building` | engine 7,661–8,400 |
| 3 | **`Upgrade`** — ctor + 13 prototype methods → `core/upgrade.ts`; the interleaved `Game.storeBuyAll` / `Game.vault=[]` statements stay in the engine in place; the non-capturing `Game.TieredUpgrade` / `Game.SynergyUpgrade` factories move to core | engine 8,666–8,935 (ctor 8,666–8,701, prototypes 8,702–8,935), factories 9,105–9,149 |
| 4 | **`Achievement`** — ctor + `getType`/`toggle` → `core/achievement.ts`; the four non-capturing factories (`TieredAchievement`, `ProductionAchievement`, `BankAchievement`, `CpsAchievement`) move to core; `types.ts` names `BankAchievement`/`CpsAchievement` | `content/achievements.ts` 45–70, 71, 106–117; factories 129–171 |

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
