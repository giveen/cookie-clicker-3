/* Cookie Clicker 3 — the ported engine's global surface.
 *
 * The engine (src/engine/main.ts, a 1:1 port of the 2.048 classic script) is
 * @ts-nocheck, but the modern glue code (src/main.ts, config.ts,
 * engine/base64.ts, extras/) talks to it through `window` and one bare
 * global. This declares that boundary so the glue stays type-checked
 * without pretending the legacy engine itself is typed.
 *
 * The engine's runtime contract is defined by the legacy code, not by us, so
 * the values are deliberately loose (any). Tightening these would be a
 * behavior-adjacent change the 1:1 conversion must not make.
 */
export {};

declare global {
	/* The engine's global object: published on window by engine/main.ts and
	 * read bare (unqualified) by the extras mods, the way the original
	 * classic-script game read its globals. */
	const Game: any;

	interface Window {
		/* --- config.ts (must be on window before the engine evaluates) --- */
		VERSION: number;
		BETA: number;
		App: number;

		/* --- engine core surface (engine/main.ts) --- */
		Game: any;
		AddLanguage: (id: string, name: string, strings: Record<string, unknown>) => void;
		Beautify: (...args: any[]) => string;
		loc: (...args: any[]) => string;
		PlaySound: (...args: any[]) => void;
		AddEvent: (...args: any[]) => void;
		/* engine shorthand: document.getElementById */
		l: (id: string) => HTMLElement | null;
		LocalizeUpgradesAndAchievs: () => void;

		/* --- engine/base64.ts --- */
		Base64: { encode(input: string): string; decode(input: string): string };

		/* --- glue module loaders (defined in src/main.ts, called by the engine) --- */
		loadLangModule?: (file: string, done: () => void, fail?: (err: unknown) => void) => void;
		loadMinigameModule?: (url: string) => Promise<unknown>;

		/* --- CC3 flags --- */
		/* The polish stats object published by src/main.ts's animation pass
		 * (motion / counter / ascendFlashes / …); shape is presentation-side. */
		__cc3Anim?: any;
		__cc3Binverter?: unknown;
	}
}
