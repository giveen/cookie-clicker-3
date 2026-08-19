/**
 * types.ts — the typed surface of the Cookie Clicker 3 engine.
 *
 * The 2.048 engine (src/engine/main.ts) is a 16k-line 2022-era script: one
 * runtime-built `Game` object plus a bag of globals. This file defines the
 * TypeScript surface that all CC3-owned code (entry, config, extras, language
 * modules, build tooling) compiles against — and, in the phased rewrite, the
 * surface the class-based engine is built to.
 *
 * Conventions:
 *  - The legacy engine uses numbers where modern code uses booleans
 *    (`bought: 0/1`, `ready: 1`). Those are typed as `number`, not `boolean`,
 *    so the types describe the real engine, not an idealized one.
 *  - Index signatures (`[key: string]: any`) mark the genuinely dynamic
 *    corners of the legacy engine (objects built at runtime, string-keyed
 *    maps, ad-hoc mod properties). Named members are typed and checked; the
 *    index signature only covers what the engine really treats dynamically.
 */

/* ====================================================================== */
/* Language data (src/engine/loc/*.ts)                                    */
/* ====================================================================== */

/**
 * Gettext/PO-catalog header metadata, stored under the reserved `""` key of
 * every loc table (language tag + the plural-forms expression the engine's
 * plural lookup evaluates).
 */
export interface LanguageHeader {
	language: string;
	'plural-forms': string;
	[key: string]: string;
}

/** A value in a loc table: a plain string, `string[]` plural forms (selected
 * by count at lookup time), or the PO header under `""`. */
export type LanguageString = string | string[] | LanguageHeader;

/**
 * One localized language module. `id` is the engine language code (e.g. 'EN'),
 * `name` the display name, and `strings` the translation table.
 */
export interface LanguageData {
	id: string;
	name: string;
	strings: Record<string, LanguageString>;
}

/* ====================================================================== */
/* Content primitives                                                     */
/* ====================================================================== */

/**
 * A building's sprite sheet description. `pic`/`bg` are resolved directly, or
 * from `base` (`base + '.webp'` / `base + 'Background.webp'`) by the engine.
 * `xV`/`yV` are the tile grid dimensions; `x`/`y` the offset of the first
 * frame; `rows`/`frames` the animation layout.
 */
export interface Art {
	pic?: string;
	bg?: string;
	base?: string;
	xV: number;
	yV: number;
	w: number;
	h: number;
	x: number;
	y: number;
	rows: number;
	frames: number;
	[key: string]: unknown;
}

/**
 * A store upgrade. `buildingTie`/`buildingTie1`/`buildingTie2` reference the
 * building(s) the upgrade applies to (set by the Tiered/Synergy/Grandma
 * wrappers). `tier` is the tier key (numeric tier, or 'synergy1'/'synergy2'
 * /'fortune').
 */
export interface Upgrade {
	id: number;
	name: string;
	dname: string;
	desc: string;
	baseDesc: string;
	ddesc?: string;
	basePrice: number;
	price: number;
	priceLumps: number;
	icon: number | number[];
	iconFunction: number | (() => number[]);
	buyFunction?: (() => void) | 0;
	unlockFunction?: (() => boolean) | 0;
	unlocked: number;
	bought: number;
	order: number;
	pool: string;
	tier?: number | string;
	buildingTie?: Building | Upgrade;
	buildingTie1?: Building;
	buildingTie2?: Building;
	descFunc?: () => string;
	priceFunc?: () => number;
	unshackleUpgrade?: string;
	vanilla: number;
	[key: string]: any;
}

/** A store achievement. `won` is 0/1 (legacy numeric-boolean). */
export interface Achievement {
	id: number;
	name: string;
	dname: string;
	desc: string;
	baseDesc: string;
	ddesc?: string;
	icon: number | number[];
	won: number;
	order: number;
	pool: string;
	buildingTie?: Building;
	tier?: number;
	threshold?: number;
	vanilla: number;
	[key: string]: any;
}

/** A building (the engine's `Game.Object` content primitive). */
export interface Building {
	id: number;
	name: string;
	dname: string;
	displayName: string;
	single: string;
	plural: string;
	bsingle: string;
	bplural: string;
	actionName?: string;
	extraName?: string;
	extraPlural?: string;
	desc: string;
	baseDesc?: string;
	ddesc?: string;
	basePrice: number;
	price: number;
	bulkPrice: number;
	baseCps: number;
	/** CpS value, or a function evaluated as `me.cps(me)` for dynamic buildings. */
	cps: number | ((me: Building) => number);
	storedCps: number;
	storedTotalCps: number;
	totalCookies: number;
	amount: number;
	bought: number;
	highest: number;
	free: number;
	level: number;
	locked: number;
	unlocked: number;
	vanilla: number;
	n: number;
	icon: number;
	iconColumn: number;
	art: Art;
	iconFunc?: () => [number, number];
	buyFunction?: ((this: Building) => void) | 0;
	canvas: HTMLCanvasElement | null;
	ctx: CanvasRenderingContext2D | null;
	pics: unknown[];
	mouseOn: boolean;
	mousePos: number[];
	muted: number;
	tieredUpgrades: Record<number | string, Upgrade>;
	tieredAchievs: Record<number | string, Achievement>;
	productionAchievs: { pow: number; achiev: Achievement }[];
	synergies: Upgrade[];
	fortune: number | Upgrade;
	grandma?: Upgrade;
	levelAchiev10?: Achievement;
	minigameUrl: string | 0;
	minigameName: string | 0;
	onMinigame: boolean;
	minigameLoaded: boolean;
	minigameLoading: boolean;
	minigame?: { onResize?: () => void };
	eachFrame: number;
	buy(amount?: number): number | undefined;
	sell(amount?: number, silent?: number): number | undefined;
	getPrice(n: number): number;
	getSumPrice(amount: number): number;
	switchMinigame(on: number | boolean): void;
	refresh(): void;
	redraw(): void;
	mute(n: number): void;
	getBounds(): { left: number; top: number; width: number; height: number };
	[key: string]: any;
}

/** A buff entry in `Game.buffs` (e.g. 'Frenzy'). `arg1` is the primary argument. */
export interface Buff {
	name?: string;
	arg1?: number;
	arg2?: number;
	[key: string]: any;
}

/** An on-screen shimmer (golden/white/dark cookie). `pop()` dismisses it. */
export interface Shimmer {
	l?: HTMLElement;
	force?: string;
	forceObj?: Record<string, unknown>;
	wrath?: number;
	noWrath?: number;
	pop(event?: unknown): void;
	[key: string]: any;
}

/**
 * A Grandmapocalypse wrinkler crawling the cookie. `phase` 0 = gone, 2 = fully
 * visible (sucking 5% of CpS via `Game.cpsSucked`); `sucked` accumulates the
 * swallowed cookies refunded (+10%) on the pop (`hp <= 0.5`).
 */
export interface Wrinkler {
	phase: number;
	close: number;
	sucked: number;
	hp: number;
	[key: string]: any;
}

/**
 * A tier definition from `Game.Tiers`. Numeric tiers 1-14 are the standard
 * content tiers; `'synergy1'`/`'synergy2'`/`'fortune'` are special tiers. The
 * engine appends `.upgrades` to each tier as tiered content is declared.
 */
export interface Tier {
	name: string;
	/** Building level at which the tier unlocks (-1 = special/always). */
	unlock: number;
	/** Building level at which the tier's achievements unlock (standard tiers only). */
	achievUnlock?: number;
	/** Row in the icon sheet for this tier's content icons. */
	iconRow: number;
	color: string;
	/** 1 for the special (synergy/fortune) tiers. */
	special?: number;
	/** Upgrade name required to unlock a special tier. */
	req?: string;
	price: number;
	/** Filled by the engine as tiered upgrades are declared for this tier. */
	upgrades?: Upgrade[];
	/** Upgrade name that "unshackles" the tier (extra production), if any. */
	unshackleUpgrade?: string;
	[key: string]: any;
}

/**
 * A third-party mod (registered via `Game.registerMod`). The engine wires
 * `init`/`create`/`draw`/`check` as lifecycle hooks and `save`/`load` into the
 * save format. `init` is reset to `0` after it runs once.
 */
export interface Mod {
	id?: string;
	name?: string;
	version?: string;
	init?: (() => void) | 0;
	create?: (game: Game) => void;
	draw?: (game: Game) => void;
	check?: (game: Game) => void;
	save?: () => string;
	load?: (str: string) => void;
	[key: string]: any;
}

/** Player preferences (`Game.prefs`). Legacy sparse object: numeric 0/1 flags. */
export interface Prefs {
	particles: number;
	numbers: number;
	autosave: number;
	autoupdate: number;
	milk: number;
	fancy: number;
	warn: number;
	cursors: number;
	focus: number;
	popups: number;
	format: number;
	notifs: number;
	monospace?: boolean | number;
	screenreader?: number;
	[key: string]: any;
}

/* ====================================================================== */
/* The Game object                                                        */
/* ====================================================================== */

/**
 * The engine's `Game` object — runtime-built in 2.048, typed here as the
 * canonical surface. Named members are the checked contract; the index
 * signature covers the rest of the legacy runtime surface (methods assigned
 * dynamically, ad-hoc state) so typed callers can still reach it honestly.
 */
export interface Game {
	/* --- identity / environment --- */
	version: number;
	beta: number;
	mobile: number;
	touchEvents: boolean;
	https: number;
	season: string;
	baseSeason: string;
	clickStr: string;
	vanilla: number;

	/* --- lifecycle / timing --- */
	ready: number | boolean;
	visible: boolean;
	T: number;
	drawT: number;
	loopT: number;
	fps: number;
	currentFps: number;
	previousFps: number;
	time: number;
	lastDate: number;
	lastActivity: number;
	accumulatedDelay: number;
	delayTimeouts: number;
	catchupLogic: number;
	fpsStartTime: number;
	frameNumber: number;
	toSave: boolean;

	/* --- economy state --- */
	cookies: number;
	cookiesd: number;
	cookiesEarned: number;
	lumps: number;
	heavenlyChips: number;
	prestige: number;
	resets: number;
	cookiesPs: number;
	cpsSucked: number;
	recalculateGains: number;
	priceIncrease: number;
	buyMode: number;
	buyBulk: number;
	elderWrath: number;
	wrinklersPopped: number;
	noteId: number;
	cookieClicks: number;

	/* --- ascend / prestige --- */
	OnAscend: number;
	AscendTimer: number;
	AscendBreakpoint: number;
	AscendDuration: number;
	ascensionMode: number;
	SpecialGrandmaUnlock: number;

	/* --- layout / DOM --- */
	l: HTMLElement | null;
	wrapper: HTMLElement | null;
	bounds: number[] | 0;
	scale: number;
	minLayoutW: number;
	cssClasses: string[];

	/* --- content maps --- */
	Objects: Record<string, Building>;
	ObjectsById: Building[];
	ObjectsN: number;
	Upgrades: Record<string, Upgrade>;
	UpgradesN: number;
	Achievements: Record<string, Achievement>;
	AchievementsN: number;
	AchievementsOwned: number;
	BuildingsOwned: number;
	Tiers: Record<number | string, Tier>;
	buffs: Record<string, Buff>;
	shimmers: Shimmer[];
	/** The `#shimmers` DOM layer (`l('shimmers')`); truthy once the DOM is built. */
	shimmersL: HTMLElement | null;
	wrinklers: Wrinkler[];
	prefs: Prefs;

	/* --- seasonal specials (Santa + Dragon tabs) --- */
	specialTabs: string[];
	santaLevel: number;
	dragonLevel: number;

	/* --- modding --- */
	mods: Record<string, Mod>;
	sortedMods: Mod[];
	modSaveData: Record<string, string>;

	/* --- lifecycle methods --- */
	Init(): void;
	Loop(): void;
	Load(): void;
	LoadSave(): void;
	Resume(): void;
	WriteSave(type?: number): string;
	ImportSaveCode(save: string): boolean;
	ExportSaveCode(): string;
	CalculateGains(): void;
	ClickCookie(e: MouseEvent | null, amount?: number): void;
	Notify(title: string, desc: string, pic?: [number, number] | string, quick?: number, noLog?: boolean): void;
	Ascend(force?: number): void;
	Reincarnate(force?: number): void;
	LoadMinigames(): void;
	scriptLoaded(me: Building): void;
	isMinigameReady(me: Building): boolean;
	BuildStore(): void;
	resize(): void;
	addClass(what: string): void;
	updateClasses(): void;
	getFps(): number;

	/* --- shimmers / wrinklers --- */
	shimmer: new (type: string, obj?: unknown, noCount?: number) => Shimmer;
	SpawnWrinkler(me: Wrinkler): void;

	/* --- seasonal specials --- */
	UpdateSpecial(): void;
	UpgradeSanta(): void;
	UpgradeDragon(): void;

	/* --- content / unlock API --- */
	Unlock(name: string): void;
	UnlockTiered(me: Building): void;
	Win(name: string): void;
	GetTieredCpsMult(me: Building): number;
	magicCpS(name: string): number;
	Has(upgrade: string | Upgrade): boolean;
	SetTier(building: string | Building, tier: number | string): void;
	GetIcon(building: string, tier: number | string): number[];
	CountsAsAchievementOwned(pool: string): boolean;
	CountsAsBuildingOwned(me: Building): boolean;
	modifyBuildingPrice(me: Building, price: number): number;

	/* --- mod registration --- */
	registerMod(id: string, mod: Mod): boolean;
	registerHook(hook: string, func: () => void): void;

	/* --- content constructors (modding API) --- */
	Object: new (
		name: string,
		commonName: string,
		desc: string,
		icon: number,
		iconColumn: number,
		art: Art,
		price: number,
		cps: number | ((me: Building) => number),
		buyFunction?: (this: Building) => void,
	) => Building;
	Upgrade: new (name: string, desc: string, price: number, icon: number | number[], buyFunction?: () => void) => Upgrade;
	Achievement: new (name: string, desc: string, icon: number | number[]) => Achievement;
	TieredUpgrade: (name: string, desc: string, building: string, tier: number) => Upgrade;
	SynergyUpgrade: (name: string, desc: string, building1: string, building2: string, tier: number | string) => Upgrade;
	GrandmaSynergy: (name: string, desc: string, building: string) => Upgrade;
	TieredAchievement: (name: string, desc: string, building: string, tier: number) => Achievement;
	ProductionAchievement: (name: string, building: string, tier: number, q?: string, mult?: number) => Achievement;

	/* --- misc engine surface --- */
	tooltip: { hide(): void };
	ClosePrompt(): void;
	CloseNote(id: number): void;

	/* The 2.048 engine assigns methods and state at runtime beyond this named
	 * surface; the index signature keeps those reachable for typed callers
	 * without pretending they don't exist. */
	[key: string]: any;
}

/* ====================================================================== */
/* Window-boundary engine functions (published on `window`)               */
/* ====================================================================== */

/** `loc(id, params, baseline)` — localize a string; `params` fills `%1..%n`. */
export type LocFn = (
	id: string,
	params?: number | number[] | Record<string, number | string>,
	baseline?: unknown,
) => string;

/** `Beautify(val, floats)` / `LBeautify(val, floats)` — number formatting. */
export type BeautifyFn = (val: number, floats?: number | boolean) => string;

/** `PlaySound(url, vol, pitchVar)` — audio playback. */
export type PlaySoundFn = (url: string, vol?: number, pitchVar?: number) => void;

/**
 * `AddEvent(el, ev, func)` — legacy event binding (addEventListener, with an
 * attachEvent fallback). Returns `[el, ev, func]` for `RemoveEvent`, or `false`.
 */
export type AddEventFn = (el: EventTarget, ev: string, func: (e?: any) => void) => [EventTarget, string, (e?: any) => void] | false;

/** `l(id)` — `document.getElementById` shorthand. */
export type LFn = (what: string) => HTMLElement | null;

/** `AddLanguage(id, name, strings, mod)` — register a language (loc files);
 * `strings` is the full table including the `""` PO header. */
export type AddLanguageFn = (
	id: string,
	name: string,
	strings: Record<string, LanguageString>,
	mod?: boolean,
) => boolean;

/** `LocalizeUpgradesAndAchievs()` — re-run the dname/ddesc localization pass. */
export type LocalizeContentFn = () => void;

/* ====================================================================== */
/* CC3-specific types (owned by this project, not the 2.048 engine)       */
/* ====================================================================== */

/**
 * CC3's reduced-motion instrumentation stats, kept on `window.__cc3Anim` and
 * read by the QA suite. The 2.048 engine knows nothing about it.
 */
export interface Cc3AnimStats {
	motion: boolean;
	noMotionClass: boolean;
	counter: {
		active: boolean;
		frames: number;
		anchors: number;
		writes: number;
	};
	ascendFlashes: number;
	notesSeen: number;
}
