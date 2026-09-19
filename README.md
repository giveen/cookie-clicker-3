# Cookie Clicker 3

[![Play Game](https://img.shields.io/badge/PLAY-Cookie%20Clicker%203-brightgreen?style=for-the-badge&logo=cookie)](https://giveen.github.io/cookie-clicker-3/)

**Cookie Clicker 3** is a modern, high-performance Cookie Clicker experience built on [Cookie Clicker 2.048](https://github.com/DiSCooooo/Cookie-Clicker-2.048) (a port of Orteil's [Cookie Clicker](http://orteil.dashnet.org/cookieclicker/)). It is an unofficial fan project—not affiliated with or endorsed by Orteil.

The project preserves authentic game mechanics while modernizing the codebase with strictly typed TypeScript, zero-dependency Vite builds, mobile-responsive layouts, offline PWA capabilities, and an extensive suite of player-facing minigames, custom buildings, achievements, and quality-of-life enhancements.

---

## ✨ Player-Focused Features & Content

### 🏰 Minigames
- **Factory Dungeon Minigame** (`minigameDungeon.ts`): Procedural 40x40 turn-based dungeon crawler unlocked at 50 Factories. Explore rooms through fog of war, choose from 4 playable heroes (Chip, Crumb, Doe, Lucky), fight monsters, collect gear and relics, upgrade at the Relic Workshop, and clear floors using responsive D-pad controls or automated BFS pathing in normal or widescreen fullscreen mode.
- **Cat Colony** (`minigameCatColony.ts`): Breed and manage cats with custom sleeping animations, repeatable treat upgrades, and colony perks.
- **Garden** (`minigameGarden.ts`): 36 plant species with cross-breeding mutations, soil controls, tick speed adjustments, and sugar lump refills.
- **Stock Market** (`minigameMarket.ts`): 16 tradable stock assets, brokers, office upgrades, and loan options.
- **Pantheon** (`minigamePantheon.ts`): Slot 11 different gods across Diamond, Ruby, and Jade spirit slots to customize passive playstyles.
- **Grimoire** (`minigameGrimoire.ts`): 9 spell options (Conjure Baked Goods, Force the Hand of Fate, Spontaneous Edifice, etc.) with mana management and backfire outcomes.
- **Grandma's Sitting Room** (`minigameGrandmaSittingRoom.ts`): Manage Grandmapocalypse wrath stages, elder pledges, and wrinklers.

### 🐮 Custom Buildings & Specials
- **The Cookie Cow**: Adopt and grow a Cookie Cow across 11 size stages (from 1 million to 10 quadrillion cookies) for up to a +13% Kitten milk bonus.
- **Black Hole Inverter**: Custom endgame building featuring custom artwork, building tier upgrades, and fitted curve CpS pricing.
- **Cats Building**: Custom building with multi-frame animated spritesheets and sleeping cat visuals.
- **Daily Crumb**: Daily login calendar with streak bonuses, sugar lump rewards, weekday perks, and popup dialogs.
- **Cracking Cookie**: Cursor-driven mechanic where the big cookie cracks over time based on Cursor count, rewarding cookie bursts and Click Frenzy.
- **Decide Your Destiny**: Spend sugar lumps to shape future golden cookie outcomes.
- **American Season**: Festive seasonal event with fireworks and custom rocket upgrades.
- **Transcendence**: End-game ascension mechanism offering persistent rewards across hard resets.

### 🏆 Achievements & Keystone Perks
- **53+ New Achievements**: Expanded milestone tails (1,000 of everything, 25,000 buildings, 1,000 upgrades, 9,000 cats), shadow oddities, and Born Again run rewards.
- **Keystone Perks**: Complete an achievement family to unlock permanent account-wide bonuses (+5% golden cookie duration, +5% wrinkler pop refund, +5% faster sugar lump ripening, -5% spell mana cost, etc.).
- **Building Mastery**: Earn every tiered achievement of a building for a permanent +1% CpS bonus (*Master of the line*).
- **Protein & Synergistic Upgrades**: Dozens of new tiered upgrades with custom spritesheets and multi-building synergies.

### ⚡ Quality of Life & Usability
- **Click & Hold to Buy**: Press and hold any store row to continuously repeat purchases without rapid clicking.
- **Keyboard Shortcuts**: Ctrl-click to bulk buy/sell 10x, Shift-click to bulk buy/sell 100x.
- **Background Music Jukebox**: 8 web music tracks composed by Bert Cole with a built-in jukebox track picker.
- **One-Column Mobile Mode**: Automatic responsive layout for screens ≤640px with bottom tab navigation.
- **Accessibility Mode**: High-contrast, screen-reader friendly buttons for store products (`Game.prefs.screenreader`).
- **Smooth 60 FPS UI Rendering**: Display-refresh-rate animated cookie counter, smooth panel easing, and clean transitions while respecting `prefers-reduced-motion`.

---

## 🛠️ What "Modernized" Means Here

| Area | 2.048 (2022 Baseline) | Cookie Clicker 3 |
| --- | --- | --- |
| **Module System** | 890 KB single classic `<script>` + runtime script injection | Clean ES Modules; minigames and languages code-split into dynamic Vite chunks |
| **Language** | ES5 sloppy-mode JS | 100% strict-mode TypeScript compiled under `tsc --noEmit` |
| **Build System** | Static files (no build step) | Vite 6: HMR dev server, production bundling, code-splitting |
| **Save Encoding** | 2007-era WebToolkit Base64 | Native `btoa`/`atob` + `TextEncoder`/`TextDecoder` (100% save-compatible) |
| **Fonts & Assets** | External Google Fonts CDN requests | Self-hosted, local woff2 Merriweather Black subset bundled by Vite |
| **Offline / PWA** | Requires internet connection | Web app manifest + service worker with auto-stamped build hashes for offline play |
| **Motion Polish** | UI tied to 30Hz logic loop rate | 60 FPS display-rate smooth rendering, responsive modals, respects `prefers-reduced-motion` |
| **Ads & Trackers** | AdSense, Facebook pixel, cookies CDN | 100% removed—zero ads, zero tracking, zero third-party telemetry |

The save format remains **100% byte-compatible** with upstream saves (verified by `tests/save-compat.spec.js`).

---

## 📁 Project Layout

```text
index.html              App shell (DOM container and CSP meta tags)
tsconfig.json           TypeScript strict configuration
docs/                   Design docs, roadmap, changelog, and feature specs
src/
  main.ts               Application entry point, module loader, PWA registration
  config.ts             Version and app configuration flags
  globals.d.ts          Global window surface declarations
  styles/main.css       Modernized stylesheet (self-hosted fonts, responsive layouts)
  assets/fonts/         Local woff2 Merriweather Black font subsets
  engine/
    base64.ts           Native Base64 save encoding
    main.ts             Typed engine orchestrator
    core/               Typed core classes: Game, Building, Upgrade, Achievement
    content/            Typed data: tiers, buildings, upgrades, achievements, milks
    systems/            Typed systems: economy, save, backup, shimmer, wrinklers, ascend, buffs
    utils/              Pure utility functions: DOM helpers, formatting, encoding, time
    ui/                 UI modules: particles, notifications, tooltips, store, store hold
    minigame*.ts        Dynamic minigame modules (Garden, Grimoire, Market, Pantheon, Dungeon, Cat Colony)
    loc/                Language chunks (EN, FR, DE, NL, CS, PL, IT, ES, PT-BR, JA, ZH-CN, KO, RU)
public/
  img/ snd/             Game graphics, spritesheets, and audio assets
  manifest.webmanifest  PWA Web App Manifest
  sw.js                 Service Worker
```

---

## 💻 Development & Building

### Prerequisites
- Node.js 18+
- npm

### Setup & Local Dev Server
```bash
npm install
npm run dev        # Starts Vite dev server at http://localhost:5173
```

### Production Build & Type Checking
```bash
npm run typecheck  # Run strict TypeScript type check (tsc --noEmit)
npm run build      # Perform typecheck, then output bundled app to dist/
npm run preview    # Preview production dist/ locally at http://localhost:4173
```

The production build in `dist/` is relocatable (`base: './'`) and ready to be hosted on any static web server or GitHub Pages.

---

## 🧪 Testing & Debug Suite

### Running Regression Tests
The Playwright test suite validates all core game systems, minigames, save compatibility, and UI interactions:

```bash
npx playwright install chromium   # Required once per machine
npm test                          # Runs full QA test suite against production build
```

### Interactive QA Debug Probes
Load the game with `?debug=1&qa=...` to trigger automated in-page test probes:

| Query Probe | Description |
| --- | --- |
| `?debug=1&qa` | Seed level-1 minigame buildings and open the Garden |
| `?qa=cookies` | Seed cookies only for quick store purchase testing |
| `?qa=cpslatency` | Measure purchase-to-CpS latency (must reflect within 1–2 frames) |
| `?qa=golden` | Spawn and click a test Frenzy golden cookie |
| `?qa=save` | Verify save export, corruption recovery, and re-import round-trip |
| `?qa=backup` | Audit rolling save backups and restoration history |
| `?qa=sound` | Audit audio engine, sound caching, and web music playback |
| `?qa=ascend` | Drive full ascension intro and reincarnate flow |
| `?qa=offline` | Test offline cookie gains over simulated passage of time |
| `?qa=special` | Unlock seasonal specials (Santa & Dragon upgrade paths) |
| `?qa=a11y` | Test accessibility screen-reader button rendering mode |
| `?qa=content` | Run economy validation and building balance audits |
| `?qa=wrinkler` | Test wrinkler spawning, CpS drain, and popping refunds |
| `?qa=dailycrumb` | Audit Daily Crumb login calendar and claim popups |
| `?qa=cracking` | Audit Cursor big cookie cracking mechanic and Click Frenzy |
| `?qa=saveimport` | Import fresh save exports into active sessions across all built-in mods |
| `?qa=perf` | Benchmark 4-minigame frame cost against the 30-tick target |
| `?qa=onecol` | Test one-column mobile responsive layout |
| `?qa=anim` | Audit 60 FPS smooth counter, UI slide-ins, and `prefers-reduced-motion` |

---

## 🔒 Security

Cookie Clicker 3 enforces a strict `Content-Security-Policy` via `<meta>` tag in `index.html`:
- **Self-contained**: All scripts, styles, images, fonts, and sounds are served from the same origin (`default-src 'self'`). Zero external CDN dependencies, trackers, or ad scripts.
- **Resource protection**: Disallows object embeds (`object-src 'none'`) and locks down form actions (`form-action 'self'`).

---

## 📜 Credits & Legal

- **Original Game Code & Assets**: Copyright **Orteil, 2013–2022** ([Cookie Clicker](http://orteil.dashnet.org/cookieclicker/)). Included under in-source non-commercial permission.
- **2.048 Source Baseline**: [DiSCooooo / Sushi8756](https://github.com/DiSCooooo/Cookie-Clicker-2.048).
- **Web Music Composition**: **Bert Cole** (8 original background tracks).
- **Merriweather Font**: [Google Fonts / Sorkin Type](https://www.google.com/fonts) (SIL Open Font License).

Cookie Clicker 3 is an **unofficial, non-commercial fan port**. It is not affiliated with or endorsed by Orteil, carries no monetization, and is not a replacement for the official game. See [CREDITS.md](CREDITS.md) and [LICENSE](LICENSE) for complete legal notices.
