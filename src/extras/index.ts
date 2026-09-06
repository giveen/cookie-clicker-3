/* extras/index.ts — the single deferred chunk for all CC3 built-in content
 * mods. Loaded via src/main.ts's window.cc3ContentReady and awaited by the
 * engine's launch bootstrap (engine/main.ts) before Game.Launch: the mods
 * declare their buildings/upgrades/achievements at registration, so the
 * first LoadSave must see them (e.g. the casino's Chancemaker). */
import './blackHoleInverter';
import './decideDestiny';
import './americanSeason';
import './casino';
import './tutorial';
import './dailyCrumb';
import './crackingCookie';
import './transcendence';
