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

	/* Bare engine globals the typed content modules read unqualified (the
	 * engine publishes them on window via its Object.assign(window, …) shim,
	 * which is also what makes them resolve at runtime inside ESM modules). */
	const loc: LocFn;
	/* Non-generic on purpose: the content passes `any`-typed arrays (Game
	 * index signature), and one verbatim 2.048 tombola line indexes `choose`
	 * with a comma expression (`choose['red','orange',…]` — a faithful 2.048
	 * quirk that resolves to `undefined` at runtime); the index signature
	 * keeps that expression type-checkable. (Tested: generic `<T>(arr:
	 * readonly T[]) => T` infers `unknown` from `any` arrays under tsgo.) */
	const choose: { (arr: readonly any[]): any; [key: string]: any };
	const App: number;
	const Beautify: BeautifyFn;
	const BeautifyInText: (str: string) => string;
	/* Localized number formatter: returns {n: floored value, b: beautified}. */
	const LBeautify: (val: number, floats?: number | boolean) => { n: number; b: string };
	const cap: (str: string) => string;
	const EN: number;
	/* A music system loaded at runtime (tracks, …), or false when none is
	 * loaded — the engine keeps it `false` in the current build, so the
	 * content's `if (Music)` guards stay dead exactly as in master. `any`:
	 * the jukebox methods dereference `Music.tracks` without a guard, the
	 * way the original untyped code did. */
	const Music: any;
	const PlaySound: PlaySoundFn;
	const getUpgradeName: (name: string) => string;
	const tinyIcon: (icon: number | number[], css?: string) => string;
	/* Engine shorthand for document.getElementById. `any`: the verbatim
	 * content dereferences the returned element (`.value`, `.innerHTML`)
	 * without null guards or input-casts, as the original code did. */
	const l: (id: string) => any;
	const triggerAnim: (element: any, anim: string) => void;

	/* Shared vanilla-content bookkeeping, live-bridged (slice 3). The content
	 * modules (content/upgrades.ts; later content/achievements.ts) read and
	 * write order/pool/power as bare globals; engine/main.ts keeps the real
	 * state in module-level vars and bridges the window properties onto them
	 * with accessors, so the engine's Game.Upgrade / Game.Achievement ctors —
	 * which read these names unqualified, exactly as they read the original
	 * Init-scoped closure vars — and the content modules observe one shared
	 * state. Declared `let` because the content assigns to them. */
	let order: number;
	let pool: string;
	let power: number;

	/* The engine attaches the classic-script seedrandom PRNG polyfill to
	 * Math at module eval (it rewrites Math.random with a seedable one);
	 * the vanilla content calls Math.seedrandom(…) at Init time. */
	interface Math {
		seedrandom(seed?: any, hard?: any): void;
	}

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
