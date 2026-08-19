/* Cookie Clicker 3 — the typed global boundary.
 *
 * The engine (src/engine/main.ts, a port of the 2.048 classic script) is a
 * runtime-built `Game` object plus a bag of globals. The modern glue code
 * (src/main.ts, config.ts, engine/base64.ts, extras/) talks to it through
 * `window` and one bare global. This file declares that boundary against the
 * canonical engine surface defined in src/engine/types.ts, so the glue stays
 * fully type-checked.
 *
 * Where the legacy engine extends the DOM at runtime (Element.prototype
 * .getBounds) or assigns to bare globals (Game), that is declared here too.
 */
import type {
	AddEventFn,
	AddLanguageFn,
	BeautifyFn,
	Cc3AnimStats,
	Game as GameSurface,
	LocFn,
	LocalizeContentFn,
	PlaySoundFn,
} from './engine/types';

declare global {
	/* The engine's global object: published on window by engine/main.ts and
	 * read bare (unqualified) by the extras mods, the way the original
	 * classic-script game read its globals. Typed as the canonical Game
	 * surface (named members checked; dynamic legacy surface via index sig). */
	const Game: GameSurface;

	/* The engine polyfills Element.prototype.getBounds (scaled, plain-object
	 * rect) at module eval; declare that DOM extension. */
	interface Element {
		getBounds(): {
			x: number;
			y: number;
			width: number;
			height: number;
			top: number;
			bottom: number;
			left: number;
			right: number;
		};
	}

	interface Window {
		/* --- config.ts (must be on window before the engine evaluates) --- */
		VERSION: number;
		BETA: number;
		App: number;

		/* --- engine core surface (engine/main.ts) --- */
		Game: GameSurface;
		AddLanguage: AddLanguageFn;
		Beautify: BeautifyFn;
		loc: LocFn;
		PlaySound: PlaySoundFn;
		AddEvent: AddEventFn;
		/* engine shorthand: document.getElementById */
		l: (id: string) => HTMLElement | null;
		LocalizeUpgradesAndAchievs: LocalizeContentFn;

		/* --- engine/base64.ts --- */
		Base64: { encode(input: string): string; decode(input: string): string };

		/* --- glue module loaders (defined in src/main.ts, called by the engine) --- */
		loadLangModule?: (file: string, done: () => void, fail?: (err: unknown) => void) => void;
		loadMinigameModule?: (url: string) => Promise<unknown>;

		/* --- CC3 flags --- */
		/* The polish stats object published by src/main.ts's animation pass
		 * (motion / counter / ascendFlashes / …). */
		__cc3Anim?: Cc3AnimStats;
		/* Set by extras/blackHoleInverter.ts once it has registered. */
		__cc3Binverter?: number;
	}
}
