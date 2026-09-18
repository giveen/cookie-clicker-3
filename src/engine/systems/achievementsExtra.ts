/**
 * systems/achievementsExtra.ts — the CC3 achievement-expansion runtime.
 *
 * Pairs with the appended declaration block at the end of
 * content/achievements.ts (achievment ids beyond the original 640 are all
 * declared there; the ids stay stable because every CC3 block is appended,
 * never interleaved).
 *
 * This module owns three things:
 *
 *   1. Lifetime counters for achievements that vanilla has no stat for
 *      (wrath cookies clicked, shiny wrinklers popped, grimoire backfires,
 *      casino lifetime net, Sitting Room cozy streak, cat pets, stats-menu
 *      opens, golden cookies per ascension, …). They are saved as ONE
 *      appended semicolon field in the save (see systems/save.ts, field
 *      index 54 — appended, so 2.048 saves import as zeros), and reset()
 *      keeps the ones marked permanent.
 *
 *   2. checkExtraAchievements(Game): a 5-second checker (called from the
 *      engine's existing 5-second achievement block) that evaluates every
 *      condition that has no natural win site — stat ladders, collection
 *      completion, family/keystone grants, the every-50 ladder. Anything
 *      with an event-shaped moment (a click, a resolve, a purchase) wins
 *      directly at that moment instead; this checker is the fallback.
 *
 *   3. The keystone-perk helpers consumed by the economy sites:
 *      - extraAchievPerkGoldenDur()   golden-cookie effect duration
 *      - extraAchievPerkWrinkler()    wrinkler pop value
 *      - extraAchievPerkLump()        sugar-lump ripening speed
 *      - extraAchievPerkSpell()       grimoire mana discount
 *      - extraAchievPerkMinigame()    treats/yarn/relics gain
 *      - extraAchievPerkGoldenFreq()  golden-cookie spawn frequency
 *      - extraAchievMasteryMult(me)   building +1% CpS per full family
 *      - extraAchievGoldenClickMult() golden spawn-frequency ladder
 *      Each is a tiny pure function over Game.HasAchiev/counter state, in
 *      the same style as CowMilkBonus (systems/cow.ts).
 *
 * No RNG, no strings in the save other than the packed counters.
 */

import type { Game as EngineGame } from '../types';

/* ------------------------------------------------------------------ */
/* Counter state                                                       */
/* ------------------------------------------------------------------ */

/** The lifetime counter keys, in save order (field 54, ';'-joined). */
export const EXTRA_ACH_COUNTER_KEYS = [
	'wrathClicks',        // wrath cookies clicked, lifetime
	'shinyPopped',        // shiny wrinklers popped, lifetime (permanent)
	'backfires',          // grimoire backfires, lifetime
	'casinoNet',          // casino lifetime net earnings (can be negative)
	'cozyStreak',         // Sitting Room seconds held at full +6 comfort
	'catPets',            // colony cats petted, lifetime
	'statsOpens',         // stats-menu opens, lifetime
	'goldenClicksAscend', // golden cookies clicked this ascension
	'tickerClicks',       // news-ticker clicks, lifetime
	'expeditionsClean',   // consecutive hurt-free Cat Colony expeditions
	'lumpTypes',          // bitmask of harvested lump types (1=normal,2=bifurcated,4=golden,8=meaty,16=caramel)
	'decisions',          // destinies decided (Decide Your Destiny), lifetime
] as const;

export type ExtraAchCounterKey = typeof EXTRA_ACH_COUNTER_KEYS[number];

/** Which counters survive ascension (the achievements they feed do). */
const PERMANENT: Record<ExtraAchCounterKey, boolean> = {
	wrathClicks: true,
	shinyPopped: true,
	backfires: true,
	casinoNet: true,
	cozyStreak: false, // streak clock is per-run; the achievement is not
	catPets: true,
	statsOpens: true,
	goldenClicksAscend: false,
	tickerClicks: true,
	expeditionsClean: true,
	lumpTypes: true,
	decisions: true,
};

export interface ExtraAchCounters {
	wrathClicks: number;
	shinyPopped: number;
	backfires: number;
	casinoNet: number;
	cozyStreak: number;
	catPets: number;
	statsOpens: number;
	goldenClicksAscend: number;
	tickerClicks: number;
	expeditionsClean: number;
	lumpTypes: number;
	decisions: number;
}

const freshCounters = function (): ExtraAchCounters {
	return {
		wrathClicks: 0, shinyPopped: 0, backfires: 0, casinoNet: 0,
		cozyStreak: 0, catPets: 0, statsOpens: 0, goldenClicksAscend: 0,
		tickerClicks: 0, expeditionsClean: 0, lumpTypes: 0, decisions: 0,
	};
};

export const extraAchCounters: ExtraAchCounters = freshCounters();

/** Track the cookie-collection rows so the checker can count completed rows. */
export const COOKIE_ROWS: Record<string, string[]> = {
	'Classic cookies': ['Plain cookies', 'Sugar cookies', 'Oatmeal raisin cookies', 'Peanut butter cookies', 'Coconut cookies'],
	'Assorted cookies': ['White chocolate cookies', 'Macadamia nut cookies', 'Double-chip cookies', 'White chocolate macadamia nut cookies', 'All-chocolate cookies'],
	'Fancy biscuits': ['Dark chocolate-coated cookies', 'White chocolate-coated cookies', 'Eclipse cookies', 'Zebra cookies', 'Snickerdoodles', 'Stroopwafels', 'Macaroons', 'Empire biscuits', 'British tea biscuits', 'Chocolate british tea biscuits', 'Round british tea biscuits', 'Round chocolate british tea biscuits', 'Round british tea biscuits with heart motif', 'Round chocolate british tea biscuits with heart motif'],
	'Macarons': ['Rose macarons', 'Lemon macarons', 'Chocolate macarons', 'Pistachio macarons', 'Hazelnut macarons', 'Violet macarons', 'Caramel macarons', 'Licorice macarons'],
	'Brand biscuits': ['Caramoas', 'Sagalongs', 'Shortfoils', 'Win mints', 'Fig gluttons', 'Loreols', 'Jaffa cakes', "Grease's cups"],
	'Halloween cookies': ['Skull cookies', 'Ghost cookies', 'Bat cookies', 'Slime cookies', 'Pumpkin cookies', 'Eyeball cookies', 'Spider cookies'],
	'Christmas biscuits': ['Christmas tree biscuits', 'Snowflake biscuits', 'Snowman biscuits', 'Holly biscuits', 'Candy cane biscuits', 'Bell biscuits', 'Present biscuits'],
	'Fancy pastries': ['Madeleines', 'Palmiers', 'Palets', 'Sabl&eacute;s', 'Gingerbread men', 'Gingerbread trees', 'Pure black chocolate cookies', 'Pure white chocolate cookies', 'Ladyfingers', 'Tuiles', 'Chocolate-stuffed biscuits', 'Checker cookies', 'Butter cookies', 'Cream cookies'],
};

/* ------------------------------------------------------------------ */
/* Save — one appended field (index 54)                                */
/* ------------------------------------------------------------------ */

/** Pack the counters for the save's appended field (field 54).
 * Inner separator is ',' — the misc section itself is ';'-separated, so a
 * packed ';'-joined field would splatter across a dozen spl[] slots. */
export function saveExtraAchField(): string {
	var parts: string[] = [];
	for (var i = 0; i < EXTRA_ACH_COUNTER_KEYS.length; i++) {
		parts.push(String(Math.floor(extraAchCounters[EXTRA_ACH_COUNTER_KEYS[i] as ExtraAchCounterKey])));
	}
	return parts.join(',');
}

/** Restore the appended field; missing/garbled entries import as 0. */
export function loadExtraAchField(str: string | undefined): void {
	var defaults = freshCounters();
	if (!str) { Object.assign(extraAchCounters, defaults); return; }
	var parts = str.split(',');
	for (var i = 0; i < EXTRA_ACH_COUNTER_KEYS.length; i++) {
		var key = EXTRA_ACH_COUNTER_KEYS[i] as ExtraAchCounterKey;
		var raw = parseFloat(parts[i] || '');
		if (isFinite(raw) && raw >= 0) extraAchCounters[key] = Math.floor(raw);
		else extraAchCounters[key] = defaults[key];
	}
}

/** Called from Game.Reset: per-run counters zero, permanent ones survive. */
export function resetExtraAchCounters(): void {
	for (var i = 0; i < EXTRA_ACH_COUNTER_KEYS.length; i++) {
		var key = EXTRA_ACH_COUNTER_KEYS[i] as ExtraAchCounterKey;
		if (!PERMANENT[key]) extraAchCounters[key] = 0;
	}
	// goldenClicksAscend is seeded from the vanilla per-ascension stat on run start
	extraAchCounters.goldenClicksAscend = typeof Game.goldenClicksLocal === 'number' ? Game.goldenClicksLocal : 0;
}

/* ------------------------------------------------------------------ */
/* Counter bump helpers — called from the event sites                  */
/* ------------------------------------------------------------------ */

export function bumpCounter(key: ExtraAchCounterKey, amount?: number): void {
	var amt = (typeof amount === 'undefined') ? 1 : amount;
	extraAchCounters[key] += amt;
}

/** Set/clear the expeditionsClean streak from the Cat Colony resolve site. */
export function setCleanExpeditionStreak(clean: boolean): void {
	if (clean) extraAchCounters.expeditionsClean += 1;
	else extraAchCounters.expeditionsClean = 0;
}

/* ------------------------------------------------------------------ */
/* Keystone perks                                                      */
/* ------------------------------------------------------------------ */

/* Family definitions: every member must be won for the keystone perk. */

var GOLDEN_FAMILY = ['Golden cookie', 'Lucky cookie', 'A stroke of luck', 'Fortune', 'Leprechaun', "Black cat's paw", 'Early bird', 'Fading luck', 'Eldeer', 'Seven horseshoes', 'Four-leaf cookie', 'Just plain lucky'];
var WRINKLER_FAMILY = ['Itchscratcher', 'Wrinklesquisher', 'Moistburster', 'Last Chance to See'];
var LUMP_FAMILY = ['Dude, sweet', 'Sugar rush', "Year's worth of cavities", 'Hand-picked', 'Sugar sugar', 'Sweetmeats', 'Maillard reaction'];
var SPELL_FAMILY = ["Bibbidi-bobbidi-boo", "I'm the wiz", 'A wizard is you'];
var COLONY_FAMILY = ['First expedition', 'Seasoned adventurers', 'The nine-lives guild', 'Pocketful of treats', 'Fully catified'];
var SITTING_FAMILY = ['First knit', 'Yarn hoard', "Grandma's peace", 'The elders sing', 'Fully furnished'];

/** A family is complete when all its members are won. */
export function extraAchFamilyComplete(names: string[]): boolean {
	for (var i = 0; i < names.length; i++) { if (!Game.HasAchiev(names[i])) return false; }
	return true;
}

/** Golden family keystone: golden-cookie effects last +5% longer. */
export function extraAchievPerkGoldenDur(): number {
	return extraAchFamilyComplete(GOLDEN_FAMILY) ? 1.05 : 1;
}

/** Wrinkler family keystone: wrinklers pop +5% more cookies. */
export function extraAchievPerkWrinkler(): number {
	return extraAchFamilyComplete(WRINKLER_FAMILY) ? 1.05 : 1;
}

/** Lump family keystone: sugar lumps ripen 5% faster. */
export function extraAchievPerkLump(): number {
	return extraAchFamilyComplete(LUMP_FAMILY) ? 1.05 : 1;
}

/** Spell family keystone: grimoire spells cost 5% less mana. */
export function extraAchievPerkSpell(): number {
	return extraAchFamilyComplete(SPELL_FAMILY) ? 0.95 : 1;
}

/** Minigame keystones: +10% Treats (colony family) / Yarn (sitting family). */
export function extraAchievPerkMinigame(which: 'colony' | 'sitting'): number {
	if (which == 'colony') return extraAchFamilyComplete(COLONY_FAMILY) ? 1.10 : 1;
	return extraAchFamilyComplete(SITTING_FAMILY) ? 1.10 : 1;
}

var ASCEND_FAMILY = ['Sacrifice', 'Oblivion', 'From scratch', 'Nihilism', 'Dematerialize', 'Nil zero zilch', 'Transcendence', 'Obliterate', 'Negative void', 'To crumbs, you say?', 'You get nothing', 'Humble rebeginnings', 'The end of the world', "Oh, you're back", 'Lazarus', 'Smurf account', "If at first you don't succeed"];

/** Ascension family keystone: +1% heavenly-chip power. */
export function extraAchievPerkAscend(): number {
	return extraAchFamilyComplete(ASCEND_FAMILY) ? 1.01 : 1;
}

/**
 * Every-50 ladder keystone: every 50 normal achievements grants +1%
 * golden-cookie spawn frequency, up to +5% at 250. Deliberately modest:
 * milk already turns raw achievement count into CpS.
 */
export function extraAchievPerkGoldenFreq(): number {
	return Math.min(0.05, Math.floor(Game.AchievementsOwned / 50) * 0.01);
}

/**
 * Building mastery — every tiered achievement of the building won
 * (read from the engine's own me.tieredAchievs map, so the family is
 * always exactly the set the game declares, for every building incl. the
 * CC3 Cats). "Master of <building>": +1% CpS for that building.
 */
export function extraAchievMasteryMult(me: any): number {
	var tiered = me.tieredAchievs;
	if (!tiered) return 1;
	var any = false;
	for (var k in tiered) {
		void k;
		any = true;
		if (!tiered[k] || !tiered[k].won) return 1;
	}
	return any ? 1.01 : 1;
}

/* ------------------------------------------------------------------ */
/* Golden spawn-frequency ladders                                      */
/* ------------------------------------------------------------------ */

/**
 * Every-50 ladder as a spawn-frequency multiplier (1 + perk). Multiplied
 * straight into the golden type's random min/max times.
 */
export function extraAchievGoldenClickMult(): number {
	return 1 + extraAchievPerkGoldenFreq();
}

/* ------------------------------------------------------------------ */
/* The 5-second checker                                                */
/* ------------------------------------------------------------------ */

function countOwnedRow(names: string[]): number {
	var owned = 0;
	for (var i = 0; i < names.length; i++) {
		var up = Game.Upgrades[names[i]];
		if (up && up.bought) owned++;
	}
	return owned;
}

/** Win the collection achievements from the cookie-row table. */
function checkCookieRows(): void {
	var rowsComplete = 0;
	for (var rowName in COOKIE_ROWS) {
		var names = COOKIE_ROWS[rowName];
		var owned = countOwnedRow(names);
		if (owned >= names.length) {
			Game.Win('Crumb connoisseur');
			rowsComplete++;
		} else if (owned >= names.length - 1) {
			Game.Win('Almost the whole tray');
		}
	}
	if (rowsComplete >= COOKIE_ROWS_MAX) Game.Win('The complete crumb-ulary');
}

/** Number of rows the game ships (computed once from COOKIE_ROWS). */
var COOKIE_ROWS_MAX = 0;
export function initCookieRowsMax(): void {
	COOKIE_ROWS_MAX = 0;
	for (var k in COOKIE_ROWS) { void k; COOKIE_ROWS_MAX++; }
}

/** "Every lump": at least one harvest of each of the 5 lump types. */
function checkEveryLump(): void {
	if (extraAchCounters.lumpTypes === 31) Game.Win('Every lump');
}

/**
 * Evaluate every achievement with no natural win site. Runs inside the
 * engine's existing 5-second achievement block (systems/logic.ts), after
 * the vanilla checks. Safe to call at any tick frequency: Game.Win is
 * idempotent for already-won achievements.
 */
export function checkExtraAchievements(): void {
	if (!Game.Achievements || !Game.Achievements['Crumb connoisseur']) return;//content not declared yet

	/* --- Section 1: milestone tails --------------------------------- */
	var minAmount = 100000;
	var buildingsOwned = 0;
	for (var iKey in Game.Objects) {
		buildingsOwned += Game.Objects[iKey].amount;
		minAmount = Math.min(Game.Objects[iKey].amount, minAmount);
	}
	if (minAmount >= 700) Game.Win('Septcentennial');
	if (minAmount >= 800) Game.Win('Octocentennial');
	if (minAmount >= 900) Game.Win('Nonacentennial');
	if (minAmount >= 1000) Game.Win('Kilocentennial');
	if (buildingsOwned >= 25000) Game.Win('Overlord of Constructs');
	if (Game.UpgradesOwned >= 700) Game.Win('Ascendant craft');
	if (Game.UpgradesOwned >= 1000) Game.Win('Perfectionist');

	/* Cats count tails (the count hooks own up to 1000; the checker owns the rest) */
	if (Game.Objects['Cats'] && Game.Objects['Cats'].amount >= 2500) Game.Win('The cat congregation');
	if (Game.Objects['Cats'] && Game.Objects['Cats'].amount >= 9000) Game.Win('Nine thousand lives');

	/* --- Section 2: feature-gap chains ------------------------------ */
	// wrath cookies clicked (lifetime)
	if (extraAchCounters.wrathClicks >= 100) Game.Win('Wrathful');
	// simultaneous goldens beyond Four-leaf (its shadow twin covers 8)
	if (Game.shimmerTypes && Game.shimmerTypes['golden'] && Game.shimmerTypes['golden'].n >= 8) Game.Win('Clover field');
	// wrinklers
	if (Game.wrinklersPopped >= 1000) Game.Win('Wrinkler wrangler');
	if (extraAchCounters.shinyPopped >= 5) Game.Win('Shiny hunter');
	var wrinklersAttached = 0;
	if (Game.wrinklers) { for (var wKey in Game.wrinklers) { if (Game.wrinklers[wKey].phase == 2) wrinklersAttached++; } }
	if (wrinklersAttached >= 12) Game.Win('The wrinkle in time');
	// sugar lumps in storage
	if (Game.lumps >= 150) Game.Win('Lump sum');
	checkEveryLump();
	// garden
	if (Game.Objects['Farm'] && Game.Objects['Farm'].minigame && (Game.Objects['Farm'].minigame as any).harvestsTotal >= 5000) Game.Win('Pollinator');
	// grimoire
	if (extraAchCounters.backfires >= 100) Game.Win('Backdraft');
	// casino
	if (extraAchCounters.casinoNet > 0 && (Game.Objects['Chancemaker'] && Game.Objects['Chancemaker'].minigame && (Game.Objects['Chancemaker'].minigame as any).loadedCount)) Game.Win('The house always loses');
	// daily crumb (wins live at claim time too; here for imported saves)
	if (typeof (window as any).__cc3DailyCrumbState === 'object' && (window as any).__cc3DailyCrumbState) {
		var dc = (window as any).__cc3DailyCrumbState;
		if (dc.totalClaims >= 100) Game.Win('Centurion of crumbs');
		if (dc.streak >= 28) Game.Win('Crumb de la crumb');
	}
	// cracking cookie (wins live at payoff; here for imported saves)
	if (typeof (window as any).__cc3CrackingCookieState === 'object' && (window as any).__cc3CrackingCookieState) {
		if ((window as any).__cc3CrackingCookieState.totalTriggers >= 100) Game.Win('Crack shot');
		if ((window as any).__cc3CrackingCookieState.totalTriggers >= 500) Game.Win('Fracture specialist');
	}
	// cat colony
	if (Game.Objects['Cats'] && Game.Objects['Cats'].minigame) {
		var colony = (Game.Objects['Cats'].minigame as any);
		if (colony.missionsCompleted >= 1000) Game.Win('Trailblazer');
		if (colony.treatsEarnedTotal >= 50000) Game.Win('Treat tycoon');
		if (extraAchCounters.expeditionsClean >= 100) Game.Win('No cat left behind');
	}
	// sitting room
	if (Game.Objects['Grandma'] && Game.Objects['Grandma'].minigame) {
		var room = (Game.Objects['Grandma'].minigame as any);
		if (room.yarnEarned >= 10000) Game.Win('The long knit');
	}
	// grimoire spells cast beyond 'A wizard is you'
	if (Game.Objects['Wizard tower'] && Game.Objects['Wizard tower'].minigame) {
		if ((Game.Objects['Wizard tower'].minigame as any).spellsCastTotal >= 9999) Game.Win('The spell storm');
	}
	// golden cookies lifetime
	if (Game.goldenClicks >= 500) Game.Win("Fortune's regular");
	// born-again completion
	if (Game.ascensionMode == 1 && Game.cookiesEarned >= 1e9) Game.Win('Born to bake');

	/* --- Section 3: collections ------------------------------------- */
	checkCookieRows();

	/* --- Section 4: fun / shadow ------------------------------------ */
	if (extraAchCounters.catPets >= 100) Game.Win('Petting zoo');
	if (extraAchCounters.statsOpens >= 100) Game.Win('Proud of the numbers');
	if (extraAchCounters.tickerClicks >= 500) Game.Win('Tabloid addiction II');
	if (extraAchCounters.decisions >= 10) Game.Win('Decide your destiny');
	if (extraAchCounters.goldenClicksAscend >= 100) Game.Win('Golden century');
	if (extraAchCounters.cozyStreak >= 24 * 3600) Game.Win('Comfort zone');
	if ((Date.now() - Game.startDate) >= 24 * 3600 * 1000 && Game.cookieClicks == 0) Game.Win('Patience');
	var nowHour = new Date().getHours();
	if (nowHour >= 3 && nowHour < 4 && Game.cookiesPs > 0) Game.Win('Night shift');

	/* --- Section 5: keystones (won via checker; perks are live fns) -- */
	if (extraAchFamilyComplete(GOLDEN_FAMILY)) Game.Win('Golden touch');
	if (extraAchFamilyComplete(WRINKLER_FAMILY)) Game.Win('Pest control');
	if (extraAchFamilyComplete(LUMP_FAMILY)) Game.Win('Sweet tooth');
	if (extraAchFamilyComplete(SPELL_FAMILY)) Game.Win('Mana efficient');
	if (extraAchFamilyComplete(COLONY_FAMILY)) Game.Win('Colony commander');
	if (extraAchFamilyComplete(SITTING_FAMILY)) Game.Win('Home comforts');
	if (extraAchFamilyComplete(ASCEND_FAMILY)) Game.Win('Ascension architect');
	if (Game.AchievementsOwned >= 250) Game.Win('Golden god');
	// building mastery keystones — 'Master of the line' once any building
	// owns all of its tiered achievements (the per-building +1% perk is a
	// live multiplier, not an achievement)
	for (var bKey in Game.Objects) {
		var b = Game.Objects[bKey];
		if (b && b.tieredAchievs && extraAchievMasteryMult(b) > 1) { Game.Win('Master of the line'); break; }
	}
}

/* ------------------------------------------------------------------ */
/* Engine wiring                                                       */
/* ------------------------------------------------------------------ */

/** Publish on Game (called once from Init, next to the other CC3 slots). */
export function installAchievementsExtra(Game: EngineGame): void {
	initCookieRowsMax();
	(Game as any).checkExtraAchievements = checkExtraAchievements;
	(Game as any).extraAchCounters = extraAchCounters;
	(Game as any).bumpExtraAchCounter = bumpCounter;
	(Game as any).setCleanExpeditionStreak = setCleanExpeditionStreak;
	(Game as any).extraAchievPerkGoldenDur = extraAchievPerkGoldenDur;
	(Game as any).extraAchievPerkWrinkler = extraAchievPerkWrinkler;
	(Game as any).extraAchievPerkLump = extraAchievPerkLump;
	(Game as any).extraAchievPerkSpell = extraAchievPerkSpell;
	(Game as any).extraAchievPerkMinigame = extraAchievPerkMinigame;
	(Game as any).extraAchievPerkAscend = extraAchievPerkAscend;
	(Game as any).extraAchievPerkGoldenFreq = extraAchievPerkGoldenFreq;
	(Game as any).extraAchievMasteryMult = extraAchievMasteryMult;
	(Game as any).extraAchievGoldenClickMult = extraAchievGoldenClickMult;
	(Game as any).saveExtraAchField = saveExtraAchField;
	(Game as any).loadExtraAchField = loadExtraAchField;
	(Game as any).resetExtraAchCounters = resetExtraAchCounters;
}
