# Linting with Biome

`npm run lint` runs `biome check .` (Biome 2.x) over the whole repo. The
gate is **lint-only**: the formatter is off by design (below). The repo
lints clean — zero errors, zero warnings — and errors fail the gate;
warnings are non-blocking, so fix new ones in the same change rather
than letting them accumulate as debt.

## Why Biome

Biome is a single native binary (devDependency, no ESLint/Prettier
machinery), runs the whole repo in ~100 ms, and covers JS/TS/CSS/JSON/HTML.

The config is `biome.jsonc` (comments are allowed there and carry the
per-rule rationale). Pitfall: a **`biome.json` with comments fails to
parse** (strict JSON) and the run then falls back to defaults — validate
any config change with `npx biome rage` and check
"Status: Loaded successfully" before trusting a lint run.

## Scope

- Included: everything except `dist/`, `node_modules/`, `.cc3-master/`
  (built outputs / baselines) and `public/legacy/` (the frozen 2.048
  legacy script set: dungeon, excanvas. Served as-is at runtime, not
  type-checked, written in 2014 style — linting it is pure noise).
- `tests/**` and the root `*.config.js` files use single-quoted style
  (override in biome.jsonc); `src/**` uses tabs + double quotes, matching
  each area's existing style.
- JSON files are exempt from formatting so the committed baselines
  (`tests/balance-baseline.json`, `tests/upgrades-baseline.json`) stay
  stable diffs. Both are also excluded from the check entirely
  (`files.includes` in biome.jsonc): they are generated data, and
  `tests/upgrades-baseline.json` (3.7 MiB) exceeds Biome's default 1 MiB
  `files.maxSize`.

## Why the formatter is off for the gate

The engine is a verbatim port of the 2.048 content: ~7,300 source lines
exceed 120 characters and Biome's schema caps `lineWidth` at 320, so a
formatting gate means a ~170k-line reformat of frozen content (measured:
91k insertions / 70k deletions). That would bury every future diff and
break the line-level correspondence with the 2.048 source the port is
kept faithful to. If a full reformat is ever wanted, it must be its own
commit with the fingerprint test (`tests/upgrades-fingerprint.spec.js`)
proving behavior didn't move.

The formatter options in `biome.jsonc` (tabs, double quotes in src,
single in tests, `lineWidth: 320`, no trailing commas, semicolons) are
kept so new CC3 code can be formatted on purpose:

    npx biome format --write src/engine/content/cats.ts

## Why specific rules are off

The `recommended` preset is on (default in v2). Every disabled rule has
an inline comment in `biome.jsonc` right next to it — that is the
authoritative rationale (it cannot drift from the config). In one line:
off means "the existing ported code predates the rule and changing it
risks behavior", never "the finding is uninteresting". The big ones:

- `noExplicitAny`: the ~630 `any` annotations are tracked any-debt
  (audit 2026-09-12); re-enable as the debt is paid down.
- `noInnerDeclarations` / `noRedeclare` / `noAssignInExpressions` /
  `noInvalidUseBeforeDeclaration`: the verbatim port depends on `var`
  hoisting, same-scope redeclaration, chained assignment, and
  function-declaration hoisting (e.g. the factory-then-call pattern).
- `noDuplicateElseIf`: `systems/ticker.ts` has two identical `<1e13`
  thresholds — a 2.048 source bug (the "news station" ticker is
  unreachable in the original too), preserved verbatim on purpose.
- `noPrecisionLoss`: the game intentionally deals in
  `> Number.MAX_SAFE_INTEGER` cookie counts (`tests/overflow.spec.js`).
- `noUnusedVariables` / `noUnusedFunctionParameters` (scoped to `src/**`
  via an override): the port's idioms are false positives for Biome's
  analysis — write-only counters (`bought++`) and same-name
  var/parameter bindings (`var building = Game.Objects[building]`, one
  hoisted binding that tsc resolves but Biome reads as a shadow). tsc's
  `noUnusedLocals` / `noUnusedParameters` (strict, on in tsconfig) is
  the gate for that axis in `src/**`; the Biome rules stay on for
  `tests/**` and the root config files.
- `noApproximativeNumericConstant`: the port keeps the 2.048 numeric
  literals verbatim (config.ts's 3.1415926… π approximation); swapping
  in `Math.PI` would change game values.
- `noDocumentCookie`: the save system is built on `document.cookie`
  (the 2.048 mechanism); there is no alternative that applies.
- One `// biome-ignore lint/complexity/useDateNow` in
  `src/engine/main.ts` sits on the `Date.now` polyfill: the shim
  *defines* `Date.now`, so its body must use the
  `new Date().getTime()` fallback.

- CSS/HTML rules (`noUnknownProperty`, `useGenericFontNames`,
  `noEmptyBlock`, `useValidAnchor`, …): frozen ported stylesheet/markup
  (KHTML vendor prefixes, Georgia/Comic Sans stacks, placeholder rules,
  JS-driven anchors without `href`).

## The one rule pinned to error: `useParseIntRadix`

It is enabled at `error` severity (above its `info` default) because an
unradixed `parseInt` is a real mis-parse risk (hex-prefixed strings
parse as base-16), and the fix is mechanical: the 229 unradixed sites
from the verbatim port are now `parseInt(x, 10)` (2026-09-12). Its
autofix is marked *unsafe* — Biome cannot prove an argument is not
hex — so applying it needs `npx biome check --write --unsafe .`;
with the rest of the repo lint-clean that applies only this rule's
fixes, but review the diff afterward (every change must be exactly a
`, 10` inside one `parseInt` call). The intentional base-16/base-2
parses in `utils/encoding.ts` already carry their radix and are
unaffected.
