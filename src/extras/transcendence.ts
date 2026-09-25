/* Transcendence — a second prestige layer for Cookie Clicker 3.
 *
 * Eternal Essence (EE) is earned by performing a Transcendence, which
 * resets everything from layer 1 (heavenly upgrades, prestige, buildings,
 * sugar lumps) in exchange for a log-based currency. A respec-able Doctrine
 * tree of 12 transformative nodes is bought with EE and changes how the game
 * is played. Milestones at lifetime-EE thresholds gate what survives the next
 * Transcendence.
 *
 * Design doc:   docs/second-prestige-layer.md
 * Asset audit:  docs/asset-audit.md
 *
 * Follows the CC3 extras pattern (dailyCrumb.ts, crackingCookie.ts):
 *   - IIFE with Game.registerMod(MOD_ID, {init, save, load}, true)
 *   - State persisted in the mod-save-data section (no vanilla format changes)
 *   - window.__cc3Transcendence test/inspection surface for QA
 */

(function () {
	if (window.__cc3Transcendence) return;

	/* ================================================================
	 * CONSTANTS
	 * ================================================================ */

	const MOD_ID = 'CC3Transcendence';

	/** Unlock gate: the full ascend meter (1e29 cookiesReset) or 10k prestige. */
	const GATE_COOKIES = 1e29;
	const GATE_PRESTIGE = 10000;

	/** EE formula: floor(log₁₀(cookiesTotal / 1e¹²) − offset). */
	const EE_LOG_BASE = 10;
	const EE_OFFSET = 8;

	/* The 13 Doctrine nodes. parents[] references node ids to build the DAG.
	 * Icon slots are *existing* art from the icons.webp sprite sheet —
	 * see the asset audit for rationale. */
	const DOCTRINE = [
		// ── Glutton's Path (click-focused) ──
		{
			id: 1, name: 'Persistent Hand', branch: 'glutton',
			desc: 'Clicking the cookie gains +0.5% of your CpS per 100 Cursors owned.',
			icon: [0, 13], cost: 1, parents: [],
		},
		{
			id: 2, name: 'Echoing Click', branch: 'glutton',
			desc: 'Each click triggers 0.5 seconds of passive CpS.',
			icon: [0, 0], cost: 3, parents: [1],
		},
		{
			id: 3, name: 'Cascade', branch: 'glutton',
			desc: 'Golden cookie clicks have a 10% chance to spawn another golden cookie.',
			icon: [22, 6], cost: 8, parents: [2],
		},

		// ── Idler's Path (production-focused) ──
		{
			id: 4, name: 'Lazy Oven', branch: 'idler',
			desc: '+5% offline CpS per Idler node owned (including this one).',
			icon: [17, 0], cost: 1, parents: [],
		},
		{
			id: 5, name: 'Warm Embers', branch: 'idler',
			desc: 'The shimmering veil starts on by default and costs 50% less to reactivate.',
			icon: [21, 14], cost: 3, parents: [4],
		},
		{
			id: 6, name: 'Ambient Baking', branch: 'idler',
			desc: 'Wrinklers spawn 20% faster and hold 10% more cookies.',
			icon: [15, 12], cost: 8, parents: [5],
		},

		// ── Fatebinder's Path (golden-cookie / wrath-focused) ──
		{
			id: 7, name: "Fortune's Favor", branch: 'fatebinder',
			desc: 'Golden cookies appear 10% more often and last 10% longer.',
			icon: [23, 6], cost: 1, parents: [],
		},
		{
			id: 8, name: "Elder's Whisper", branch: 'fatebinder',
			desc: 'Wrath cookies can still spawn in Ascetic runs.',
			icon: [29, 8], cost: 3, parents: [7],
		},
		{
			id: 9, name: 'Strange Attractor', branch: 'fatebinder',
			desc: 'Natural golden cookies have a 5% chance to be a cluster (spawns n more).',
			icon: [27, 6], cost: 8, parents: [8],
		},
		{
			id: 10, name: 'Double Dip', branch: 'fatebinder',
			desc: 'Golden cookie effects have a 15% chance to double on expiry (trigger again).',
			icon: [24, 7], cost: 15, parents: [9],
		},

		// ── Rebuilder's Path (economy-shaping) ──
		{
			id: 11, name: 'Frugal Start', branch: 'rebuilder',
			desc: 'Buildings are 2% cheaper per Transcendence performed (max -20%).',
			icon: [21, 7], cost: 1, parents: [],
		},
		{
			id: 12, name: 'Measured Growth', branch: 'rebuilder',
			desc: 'Upgrades are 2% cheaper per Transcendence performed (max -20%).',
			icon: [18, 7], cost: 3, parents: [11],
		},
		{
			id: 13, name: 'Legacy Echo', branch: 'rebuilder',
			desc: 'Start each run with 1 free building of the type you owned the most of last run.',
			icon: [17, 7], cost: 8, parents: [12],
		},
	];

	/** Milestone thresholds (lifetime EE → unlock). */
	const MILESTONES = [
		{ threshold: 1, name: 'First Light',
			desc: 'Keep 1 cosmetic heavenly upgrade (milk/bg/sound selector) across Transcendence.' },
		{ threshold: 10, name: 'Inner Fire',
			desc: 'Start each run with 3 free Cursors.' },
		{ threshold: 25, name: 'Steady Hand',
			desc: 'Keep 1 heavenly upgrade of your choice across Transcendence.' },
		{ threshold: 50, name: "Elder's Grace",
			desc: 'Start each run with 5 free Grandmas.' },
		{ threshold: 100, name: 'Relentless',
			desc: 'Keep building levels across Transcendence.' },
		{ threshold: 250, name: 'Unbroken',
			desc: 'Keep sugar lumps across Transcendence.' },
		{ threshold: 500, name: 'Timeless',
			desc: 'Keep 2 heavenly upgrades of your choice across Transcendence.' },
		{ threshold: 1000, name: 'Omega',
			desc: 'Keep all permanent-upgrade slots. Doctrine effects work in Born-again runs.' },
	];

	/** Achievement data. */
	const ACHIEVEMENTS = [
		{ name: 'First Glimpse', desc: 'Perform your first Transcendence.', icon: [1, 26] },
		{ name: 'The Long View', desc: 'Perform 10 Transcendences.', icon: [2, 26] },
		{ name: 'Steady as She Goes', desc: 'Earn the Steady Hand milestone.', icon: [3, 26] },
		{ name: 'Eternal', desc: 'Perform 100 Transcendences.', icon: [4, 26] },
		{ name: 'Omega', desc: 'Earn the Omega milestone.', icon: [5, 26] },
	];

	/* ================================================================
	 * STATE
	 * ================================================================ */

	const state = {
		ee: 0,                        // spendable Eternal Essence
		eeSpent: 0,                   // lifetime EE spent on Doctrine nodes
		eeEarned: 0,                  // lifetime EE earned (determines milestones)
		transcendences: 0,            // number of Transcendences performed
		totalPrestigeAllTime: 0,      // running total of prestige ever earned (updated on ascension)
		milestones: [] as number[],   // threshold values that have been reached
		doctrine: [] as number[],     // ids of bought Doctrine nodes
		keptUpgrades: [] as string[], // prestige upgrade names kept by Steady Hand / Timeless milestone
		keptCosmetic: '' as string,   // cosmetic upgrade name kept by First Light milestone
	};

	/** Cosmetic prestige upgrades eligible for the First Light milestone keep-slot. */
	const COSMETIC_UPGRADE_NAMES: readonly string[] = [
		'Classic dairy selection', 'Fanciful dairy selection',
		'A world filled with cookies', 'Milk selector',
	];

	/* Internal tracking for prestige deltas. */
	let _prestigeSeen = 0;

	/* ================================================================
	 * EE FORMULA
	 * ================================================================ */

	function computeEE(cookiesTotal: number): number {
		if (cookiesTotal <= 0) return 0;
		// Relative epsilon fixes log() floating-point drift (e.g. log10(1e18)
		// computes to 17.999999999999996 and would floor to 9 instead of 10).
		const raw = Math.log(cookiesTotal / 1e12) / Math.log(EE_LOG_BASE) - EE_OFFSET;
		return Math.max(0, Math.floor(raw + 1e-9 * Math.max(1, Math.abs(raw))));
	}

	/* ================================================================
	 * GATE CHECK
	 * ================================================================ */

	function canTranscend(): boolean {
		const G = window.Game;
		if (!G) return false;
		return G.cookiesReset >= GATE_COOKIES || state.totalPrestigeAllTime >= GATE_PRESTIGE;
	}

	/* ================================================================
	 * DOCTRINE HELPERS
	 * ================================================================ */

	function doctrineHas(id: number): boolean {
		return state.doctrine.indexOf(id) !== -1;
	}

	/* ================================================================
	 * MILESTONE HELPERS
	 * ================================================================ */

	function hasMilestone(threshold: number): boolean {
		return state.milestones.indexOf(threshold) !== -1;
	}

	function checkMilestones(): void {
		let changed = false;
		for (const m of MILESTONES) {
			if (state.eeEarned >= m.threshold && !hasMilestone(m.threshold)) {
				state.milestones.push(m.threshold);
				changed = true;
			}
		}
		if (changed) {
			state.milestones.sort((a, b) => a - b);
		}
	}

	/* ================================================================
	 * TRANSCENDENCE FLOW
	 * ================================================================ */

	/* Track the most-owned building type before a reset (for Legacy Echo). */
	let _lastMostOwnedBuilding = 0;

	/* What the last completion announced (dialog HTML or toast body). */
	let _lastAnnouncement = '';

	/* Double Dip (node 10): buff-expiry tracking.
	 * Maps the golden-cookie effect name (as used in popFunc) to the Game.buffs
	 * key that the engine creates for it. Effects that don't produce a trackable
	 * buff (chain, storm, building special) are mapped to ''. */
	const DD_BUFF_MAP: Record<string, string> = {
		'frenzy': 'Frenzy',
		'multiply cookies': 'Elder frenzy',
		'click frenzy': 'Click frenzy',
		'blood frenzy': 'Blood frenzy',
		'dragonflight': 'Dragonflight',
		'dragon harvest': 'Dragon Harvest',
		// Non-buff effects — not trackable, skip
		'chain cookie': '', 'cookie storm': '', 'cookie storm drop': '',
		'building special': '', 'free sugar lump': '', 'everything must go': '',
		'cursed finger': '', 'clot': '', 'ruin cookies': '',
		'blab': '', 'zoomies': '', 'hairball': '',
	};
	let _ddPending: { choice: string; buffName: string } | null = null;
	let _ddBuffWasSeen = false;

	/* The crumbling-cookie ascend intro is driven by Game.AscendTimer in
	 * drawBackground.ts (the `else` of `if (Game.AscendTimer==0)` at line 173)
	 * and animated by Game.UpdateAscendIntro. Rather than duplicating the
	 * effect, Transcendence reuses it wholesale: it temporarily swaps
	 * Game.UpdateAscendIntro so the intro plays identically, but the
	 * completion runs the transcendence (EE + reset) instead of the vanilla
	 * ascension (heavenly chips + ascend screen). */
	let _origUpdateAscendIntro: (() => void) | null = null;
	let _transcendIntroRunning = false;

	/** Entry point. With bypass (QA probes, fast path) skip the animation. */
	function doTranscend(bypass?: boolean): void {
		const G = window.Game;
		if (!G || !canTranscend()) return;
		if (!bypass) {
			startTranscendIntro();
			return;
		}
		doTranscendCore();
	}

	/** Play the crumbling-cookie intro (same setup as Ascend(1)), then run
	 *  the actual transcendence at the end of the animation. */
	function startTranscendIntro(): void {
		const G = window.Game;
		if (!G || _transcendIntroRunning) return;

		// Take over the ascend intro updater for the duration of the intro.
		_origUpdateAscendIntro = G.UpdateAscendIntro;
		G.UpdateAscendIntro = transcendIntro;
		_transcendIntroRunning = true;

		// Replicate Ascend(1)'s visual setup so the cookie crumbles the same
		// way: zoom in from 0.2, add the ascendIntro class, kill shimmers.
		G.OnAscend = 0; G.removeClass('ascending');
		G.addClass('ascendIntro');
		G.AscendTimer = 1;
		G.killShimmers();
		const toggleBox = document.getElementById('toggleBox');
		if (toggleBox) { toggleBox.style.display = 'none'; toggleBox.innerHTML = ''; }
		G.choiceSelectorOn = -1;
		G.ToggleSpecialMenu(0);
		G.AscendOffX = 0; G.AscendOffY = 0; G.AscendOffXT = 0; G.AscendOffYT = 0;
		G.AscendZoomT = 1; G.AscendZoom = 0.2;
		G.jukebox.reset();
		PlayCue('preascend');
	}

	/** Stands in for Game.UpdateAscendIntro while the intro runs: same sounds
	 *  and timer, but the completion transcends instead of ascending. */
	function transcendIntro(): void {
		const G = window.Game;
		if (!G) return;
		if (G.AscendTimer === 1) PlaySound('snd/charging.mp3');
		if (G.AscendTimer === Math.floor(G.AscendBreakpoint)) PlaySound('snd/thud.mp3');
		G.AscendTimer++;
		if (G.AscendTimer > G.AscendDuration) {
			// End of the animation — hand the updater back and transcend.
			G.AscendTimer = 0;
			G.removeClass('ascendIntro');
			if (_origUpdateAscendIntro) G.UpdateAscendIntro = _origUpdateAscendIntro;
			_origUpdateAscendIntro = null;
			_transcendIntroRunning = false;

			// Fanfare, mirroring UpdateAscendIntro's completion cues.
			PlayCue('ascend');
			PlayMusicSound('snd/cymbalRev.mp3');
			if (typeof App === 'undefined' || G.volumeMusic === 0) PlaySound('snd/choir.mp3');

			doTranscendCore();
		}
	}

	/** The actual reset + EE grant. Runs at the end of the intro (or
	 *  immediately when the intro is bypassed). */
	function doTranscendCore(): void {
		const G = window.Game;
		if (!G || !canTranscend()) return;

		// 1. Compute EE earned from this Transcendence
		const eeGain = computeEE(G.cookiesReset + G.cookiesEarned);
		if (eeGain <= 0) {
			G.Notify('Transcendence', 'Not enough cookies to gain Eternal Essence.', [19, 7], 4);
			return;
		}

		// 2. Record the most-owned building before reset (for Legacy Echo)
		let bestId = 0, bestAmt = 0;
		for (const idStr in G.ObjectsById) {
			const o = G.ObjectsById[idStr];
			if (o.amount > bestAmt) { bestAmt = o.amount; bestId = o.id; }
		}
		_lastMostOwnedBuilding = bestId;

		// 2b. Snapshot First Light cosmetic (auto-select first owned cosmetic upgrade)
		if (hasMilestone(1) && !state.keptCosmetic) {
			for (const name of COSMETIC_UPGRADE_NAMES) {
				if (G.Has && G.Has(name)) { state.keptCosmetic = name; break; }
			}
		}

		// 3. Hard reset — clears buildings, non-prestige upgrades, buffs, seasons, etc.
		// (Reset(1) also clears prestige upgrades because hard=1 bypasses the
		//  pool='prestige' gate at reset.ts line 116.)
		G.Reset(1);

		// 4. Reset prestige state
		G.prestige = 0;
		G.heavenlyChips = 0;
		G.heavenlyChipsSpent = 0;
		G.heavenlyCookies = 0;

		// 4b. Restore kept prestige upgrades (Steady Hand / Timeless milestone).
		// They were selected by the picker before doTranscend() was called, or are
		// empty when QA-bypassing. Only restore if the milestone has been earned.
		if (hasMilestone(25) && state.keptUpgrades.length > 0) {
			for (const uName of state.keptUpgrades) {
				const u = G.Upgrades && G.Upgrades[uName];
				if (u && (u.pool === 'prestige' || u.pool === 'toggle')) {
					u.bought = 1;
					if (typeof u.buyFunc === 'function') { try { u.buyFunc(); } catch (_) {/* ignore side-effect errors */} }
				}
			}
		}
		// Restore First Light cosmetic upgrade (always auto-selected, no picker needed)
		if (hasMilestone(1) && state.keptCosmetic) {
			const u = G.Upgrades && G.Upgrades[state.keptCosmetic];
			if (u && u.pool === 'prestige') {
				u.bought = 1;
				if (typeof u.buyFunc === 'function') { try { u.buyFunc(); } catch (_) {/* ignore */} }
			}
		}
		// Clear kept lists so they're freshly set by the picker on the next Transcendence
		state.keptUpgrades = [];
		state.keptCosmetic = '';

		// 5. Conditionally clear building levels and sugar lumps
		if (!hasMilestone(100)) {
			for (const idStr in G.ObjectsById) {
				G.ObjectsById[idStr].level = 0;
			}
		}
		if (!hasMilestone(250)) {
			G.lumps = -1;
			G.lumpsTotal = -1;
			G.lumpT = Date.now();
			G.lumpRefill = 0;
		}

		// 6. Update state
		state.ee += eeGain;
		state.eeEarned += eeGain;
		state.transcendences++;
		_prestigeSeen = 0; // prestige was reset
		checkMilestones();

		// 7. Apply milestone bonuses
		if (hasMilestone(10)) {
			G.Objects['Cursor'].getFree(3);
		}
		if (hasMilestone(50)) {
			G.Objects['Grandma'].getFree(5);
		}

		// 8. Apply Legacy Echo (free building of most-owned type from last run)
		if (doctrineHas(13) && _lastMostOwnedBuilding > 0) {
			const o = G.ObjectsById[_lastMostOwnedBuilding];
			if (o) o.getFree(1);
		}

		// 9. Check achievements
		checkAchievements();

		// 10. Announce the per-reset payoff in a centered prompt dialog (like
		// the daily crumb's collect popup) — the reset and EE grant already
		// happened, so the dialog is pure announcement. Falls back to the old
		// toast when another dialog is open (never clobber it) or an
		// ascend/reincarnate animation is running.
		const body =
			'<div class="block">+' + eeGain + ' Eternal Essence (lifetime: ' + state.eeEarned + ')</div>' +
			'<div class="block">Transcendences: ' + state.transcendences + '</div>';
		const canPrompt = !G.promptOn && !G.OnAscend && G.AscendTimer <= 0 && !G.ReincarnateTimer;
		if (canPrompt) {
			_lastAnnouncement = '<h3>Transcendence complete!</h3>' + body;
			G.Prompt(
				_lastAnnouncement,
				[
					['Open Doctrine Tree', 'Game.ClosePrompt();PlaySound(\'snd/tick.mp3\');window.__cc3Transcendence.showDoctrineTree();'],
					['Continue', 'Game.ClosePrompt();PlaySound(\'snd/tick.mp3\');']
				]
			);
		} else {
			_lastAnnouncement = '+' + eeGain + ' Eternal Essence (lifetime: ' + state.eeEarned + ').<br>Transcendences: ' + state.transcendences;
			G.Notify(
				'Transcendence complete!',
				_lastAnnouncement,
				[19, 7],
				6
			);
		}
		G.recalculateGains = 1;
		G.storeToRefresh = 1;
	}

	/* ================================================================
	 * DOCTRINE PURCHASE
	 * ================================================================ */

	function purchaseDoctrineNode(nodeId: number): boolean {
		const G = window.Game;
		if (!G) return false;
		const node = DOCTRINE.find((n) => n.id === nodeId);
		if (!node) return false;
		if (doctrineHas(nodeId)) return false;
		if (state.ee < node.cost) return false;

		// Check parent gating
		for (const pid of node.parents) {
			if (!doctrineHas(pid)) return false;
		}

		state.ee -= node.cost;
		state.eeSpent += node.cost;
		state.doctrine.push(nodeId);

		// Apply immediate effects & sound
		PlaySound('snd/shimmerClick.mp3');
		G.recalculateGains = 1;
		updateTopBarWidget();
		return true;
	}

	/* ================================================================
	 * RESPEC
	 * ================================================================ */

	function respecDoctrine(): void {
		if (state.doctrine.length === 0) return;
		const refund = state.doctrine.reduce((sum, id) => {
			const n = DOCTRINE.find((d) => d.id === id);
			return sum + (n ? n.cost : 0);
		}, 0);
		state.ee += refund;
		state.eeSpent -= refund;
		state.doctrine = [];
		const G = window.Game;
		if (G) {
			PlaySound('snd/tick.mp3');
			G.recalculateGains = 1;
		}
		updateTopBarWidget();
	}

	/* ================================================================
	 * GAME HOOKS
	 * ================================================================ */

	/** CpS hook: apply Doctrine production bonuses. */
	function cpsHook(cps: number): number {
		const G = window.Game;
		if (!G) return cps;
		// Born-again disables Doctrine unless the Omega milestone is earned
		if (G.ascensionMode === 1 && !hasMilestone(1000)) return cps;

		let mult = 1;

		// Lazy Oven: +5% offline CpS per Idler node owned
		let idlerCount = 0;
		for (const id of state.doctrine) {
			const n = DOCTRINE.find((d) => d.id === id);
			if (n && n.branch === 'idler') idlerCount++;
		}
		if (idlerCount > 0) {
			mult *= (1 + 0.05 * idlerCount);
		}

		return cps * mult;
	}

	/** CookiesPerClick hook: Persistent Hand (+0.5% of CpS per 100 Cursors). */
	function cookiesPerClickHook(cpc: number): number {
		const G = window.Game;
		if (!G) return cpc;
		if (G.ascensionMode === 1 && !hasMilestone(1000)) return cpc;
		if (doctrineHas(1)) {
			const cursors = G.Objects['Cursor'] ? G.Objects['Cursor'].amount : 0;
			const bonusPer100 = Math.floor(cursors / 100);
			if (bonusPer100 > 0) {
				cpc += G.cookiesPs * 0.005 * bonusPer100;
			}
		}
		return cpc;
	}

	/** Click hook: every click on the big cookie. */
	function clickHook(): void {
		const G = window.Game;
		if (!G) return;
		// Echoing Click: each click triggers 0.5 seconds of passive CpS
		if (doctrineHas(2)) {
			// Skip Born-again unless Omega
			if (G.ascensionMode === 1 && !hasMilestone(1000)) return;
			const bonus = G.cookiesPs * 0.5;
			if (bonus > 0) {
				G.cookies += bonus;
				G.cookiesEarned += bonus;
			}
		}
	}

	/** Reset hook: record prestige delta and most-owned building before reset. */
	function resetHook(_hard: boolean): void {
		const G = window.Game;
		if (!G) return;
		// Track running total of prestige ever earned
		if (G.prestige > _prestigeSeen) {
			state.totalPrestigeAllTime += (G.prestige - _prestigeSeen);
			_prestigeSeen = G.prestige;
		}
		// Record most-owned building for Legacy Echo
		if (doctrineHas(13)) {
			let bestId = 0, bestAmt = 0;
			for (const idStr in G.ObjectsById) {
				const o = G.ObjectsById[idStr];
				if (o.amount > bestAmt) { bestAmt = o.amount; bestId = o.id; }
			}
			_lastMostOwnedBuilding = bestId;
		}
	}

	/** Reincarnate hook: apply bonuses after ascension. */
	function reincarnateHook(): void {
		const G = window.Game;
		if (!G) return;

		// Close Doctrine view if open when reincarnating
		closeDoctrineTree(true);

		// Legacy Echo: grant 1 free building of the most-owned type from the previous run
		if (doctrineHas(13) && _lastMostOwnedBuilding > 0) {
			const o = G.ObjectsById[_lastMostOwnedBuilding];
			if (o) o.getFree(1);
		}

		// Milestone: free cursors / grandmas
		if (hasMilestone(10)) {
			G.Objects['Cursor'].getFree(3);
		}
		if (hasMilestone(50)) {
			G.Objects['Grandma'].getFree(5);
		}

		// Warm Embers (node 5): shimmering veil starts on by default after reincarnate.
		// Deferred one tick so the store has rebuilt its upgrade objects before we toggle.
		if (doctrineHas(5)) {
			window.setTimeout(function () {
				const G2 = window.Game;
				if (!G2 || !G2.Has || !G2.Has('Shimmering veil')) return;
				// 'Shimmering veil [on]'.bought === 1 means the veil is currently ON.
				// If it's off, buy the [on] upgrade to turn it on.
				const veilOn = G2.Upgrades && G2.Upgrades['Shimmering veil [on]'];
				if (veilOn && !veilOn.bought) {
					veilOn.buy(1);
					G2.recalculateGains = 1;
				}
			}, 0);
		}
	}

	/** Check hook: periodic checks. */
	function checkHook(): void {
		const G = window.Game;
		if (!G) return;

		// Safety: if the intro was interrupted (AscendTimer zeroed by an
		// external path — Esc, reincarnate, load), hand the updater back.
		if (_transcendIntroRunning && G.AscendTimer === 0) {
			if (_origUpdateAscendIntro) G.UpdateAscendIntro = _origUpdateAscendIntro;
			_origUpdateAscendIntro = null;
			_transcendIntroRunning = false;
		}

		// Track prestige running total
		trackPrestige();

		// Double Dip (node 10): watch for buff expiry and echo the effect
		_ddCheck();

		// Update the Transcend button on the ascend screen
		if (G.OnAscend) {
			updateTranscendButton();
		}

		// Update top bar celestial widget
		updateTopBarWidget();

		// Check for the unlock condition (only once per visit)
		checkUnlock();

		// Check achievements
		checkAchievements();
	}

	/** Create hook: declare achievements (runs once per page load). */
	function createHook(): void {
		declareAchievements();
	}

	/* ================================================================
	 * PRESTIGE TRACKING
	 * ================================================================ */

	function trackPrestige(): void {
		const G = window.Game;
		if (!G) return;
		if (G.prestige > _prestigeSeen) {
			state.totalPrestigeAllTime += (G.prestige - _prestigeSeen);
			_prestigeSeen = G.prestige;
		}
	}

	/* ================================================================
	 * COST DISCOUNT (Game.eff patching)
	 * ================================================================
	 * Frugal Start (node 11) and Measured Growth (node 12) reduce building
	 * and upgrade costs. The engine computes these via Game.eff('buildingCost')
	 * and Game.eff('upgradeCost'). We patch Game.eff to apply the discounts. */

	let _origEff: ((name: string, def?: number) => number) | null = null;

	function patchEff(): void {
		const G = window.Game;
		if (!G || _origEff) return;
		_origEff = G.eff.bind(G);
		G.eff = function (name: string, def?: number) {
			let v = _origEff!(name, def);
			// Skip Doctrine boosts in Born-again runs unless the Omega milestone
			// has been earned (which unlocks "Born Eternal" — Doctrine works in ascensionMode=1).
			const bornAgain = G.ascensionMode === 1 && !hasMilestone(1000);

			// ── Rebuilder's Path ──
			// Frugal Start (node 11): buildings up to 20% cheaper
			if (name === 'buildingCost' && doctrineHas(11) && !bornAgain) {
				v *= Math.max(0.8, 1 - 0.02 * state.transcendences);
			}
			// Measured Growth (node 12): upgrades up to 20% cheaper
			if (name === 'upgradeCost' && doctrineHas(12) && !bornAgain) {
				v *= Math.max(0.8, 1 - 0.02 * state.transcendences);
			}

			// ── Idler's Path ──
			// Ambient Baking (node 6): wrinklers spawn 20% faster and hold 10% more cookies
			if (!bornAgain && doctrineHas(6)) {
				if (name === 'wrinklerSpawn') v *= 1.2;
				if (name === 'wrinklerEat') v *= 1.1;
			}
			// Warm Embers (node 5): Elder Pledge / veil reactivation costs 50% less
			if (name === 'veilActivateCost' && !bornAgain && doctrineHas(5)) v *= 0.5;

			// ── Fatebinder's Path ──
			// Fortune's Favor (node 7): golden cookies appear 10% more often and last 10% longer
			if (!bornAgain && doctrineHas(7)) {
				if (name === 'goldenCookieFreq') v *= 1.1;
				if (name === 'goldenCookieDur')  v *= 1.1;
			}

			return v;
		};
	}

	/* ================================================================
	 * SHIMMER HOOKS: Cascade (3), Elder's Whisper (8),
	 *                Strange Attractor (9), Double Dip (10)
	 * ================================================================
	 * All four hook into the engine's existing CCSE-compatible
	 * customShimmerTypes['golden'] extension points:
	 *   customListPush  — injection point 1, before effect selection
	 *   customBuff      — injection point 2, after effect selection
	 * Neither modifies core engine files. */

	/** Track a golden-cookie effect for Double Dip expiry detection. */
	function _ddTrackEffect(choice: string): void {
		const buffName = DD_BUFF_MAP[choice];
		if (buffName === undefined || buffName === '') return;
		_ddPending = { choice, buffName };
		_ddBuffWasSeen = false;
	}

	/** Called from checkHook every tick: detects buff expiry for Double Dip. */
	function _ddCheck(): void {
		if (!_ddPending) return;
		const G = window.Game;
		if (!G || !G.buffs) return;
		const exists = (_ddPending.buffName in G.buffs);
		if (exists) {
			_ddBuffWasSeen = true;
		} else if (_ddBuffWasSeen) {
			// The tracked buff just expired — roll the Double Dip echo.
			const choice = _ddPending.choice;
			_ddPending = null;
			_ddBuffWasSeen = false;
			if (doctrineHas(10) && !(G.ascensionMode === 1 && !hasMilestone(1000)) && Math.random() < 0.15) {
				window.setTimeout(function () {
					if (!window.Game) return;
					const s = new (window.Game.shimmer as any)('golden');
					s.force  = choice;
					s.spawned = 1;
				}, 100);
			}
		}
	}

	/** Wire up the four Doctrine shimmer nodes into Game.customShimmerTypes.
	 *  Safe to call multiple times (idempotent: checks before pushing). */
	function setupShimmerHooks(): void {
		const G = window.Game;
		if (!G) return;
		if (!(G as any).customShimmerTypes) (G as any).customShimmerTypes = {};
		const cst = (G as any).customShimmerTypes as Record<string, Record<string, any[]>>;
		if (!cst['golden']) cst['golden'] = {};
		const gt = cst['golden'];

		// ── customListPush: Elder's Whisper (8) ──────────────────────────
		// Force wrath cookies to appear in Born-again (ascensionMode=1) runs,
		// where Game.elderWrath is always 0 so wrath cookies never naturally spawn.
		if (!gt.customListPush) gt.customListPush = [];
		gt.customListPush.push(function (me: any, _list: string[]): void {
			const G2 = window.Game;
			if (!G2 || !doctrineHas(8)) return;
			if (G2.ascensionMode !== 1 || hasMilestone(1000)) return; // not Born-again, or Omega
			// 20% probability — matches the rough wrath rate at max elderWrath
			if (Math.random() < 0.20) me.wrath = 1;
		});

		// ── customBuff: Cascade (3), Strange Attractor (9), Double Dip (10) ──
		// customBuff runs inside popFunc after the effect choice is resolved,
		// before the main effect switch. Returning `buff` unchanged leaves normal
		// effect handling intact; we only add side effects here.
		if (!gt.customBuff) gt.customBuff = [];
		gt.customBuff.push(function (me: any, buff: any, choice: string): any {
			const G2 = window.Game;
			if (!G2) return buff;
			if (G2.ascensionMode === 1 && !hasMilestone(1000)) return buff; // Born-again guard

			// Cascade (3): 10% chance to spawn a bonus natural golden cookie
			if (doctrineHas(3) && Math.random() < 0.1) {
				window.setTimeout(function () {
					if (!window.Game) return;
					const s = new (window.Game.shimmer as any)('golden');
					s.spawned = 1;
				}, 150);
			}

			// Strange Attractor (9): 5% chance to spawn a cluster of 2–3 extra cookies
			if (doctrineHas(9) && !me.wrath && Math.random() < 0.05) {
				const extra = 2 + Math.floor(Math.random() * 2);
				for (let i = 0; i < extra; i++) {
					(function (delay: number) {
						window.setTimeout(function () {
							if (!window.Game) return;
							const s = new (window.Game.shimmer as any)('golden');
							s.spawned = 1;
						}, delay);
					})(200 + i * 350);
				}
			}

			// Double Dip (10): register this pop so _ddCheck can echo it on expiry
			if (doctrineHas(10)) _ddTrackEffect(choice);

			return buff;
		});
	}

	/* ================================================================
	 * UI: TRANSCEND BUTTON (on the ascend screen)
	 * ================================================================ */

	function updateTranscendButton(): void {
		const G = window.Game;
		if (!G || !G.OnAscend) return;
		const btn = document.getElementById('transcendButton');
		if (!btn) return;
		const eeGain = computeEE(G.cookiesReset + G.cookiesEarned);
		const canDo = canTranscend() && eeGain > 0;
		btn.style.display = canDo ? 'block' : 'none';
		if (canDo) {
			btn.innerHTML = '<span class="fancyText" style="font-size:16px;">Transcend</span><br>' +
				'<small>+' + eeGain + ' EE</small>';
		}
	}

	function addTranscendButton(): void {
		const G = window.Game;
		if (!G) return;
		const container = document.getElementById('ascendBox');
		if (!container) return;
		if (document.getElementById('transcendButton')) return;

		const btn = document.createElement('a');
		btn.id = 'transcendButton';
		btn.className = 'option framed large';
		btn.style.cssText = 'display:none;font-size:20px;margin-top:4px;cursor:pointer;';
		btn.onclick = function () {
			PlaySound('snd/tick.mp3');
			const eeGain = computeEE(G.cookiesReset + G.cookiesEarned);
			if (eeGain <= 0) return;
			const msg = 'Are you ready to Transcend into the Second Prestige Layer?<div class="line"></div>' +
				'You will sacrifice everything from the mortal realm: all <b>prestige levels</b>, <b>heavenly chips</b>, and <b>heavenly upgrades</b> will be wiped clean.<br>You will have to grind your way back from scratch, empowered by the cosmos.<div class="line"></div>' +
				'You will gain <b>+' + eeGain + ' Eternal Essence</b> (lifetime: ' + (state.eeEarned + eeGain) + ').<br>' +
				'Transcendences: ' + (state.transcendences + 1) + '<br>' +
				'Your unlocked Doctrine Tree perks and milestones will remain permanently active.';
			G.Prompt(
				'<h3>Transcend</h3><div class="block">' + msg + '</div>',
				[
					['Transcend', 'Game.ClosePrompt();window.__cc3Transcendence.startTranscendWithPicker();'],
					['Cancel', 0],
				]
			);
		};
		container.appendChild(btn);
	}

	/* ================================================================
	 * UI: DOCTRINE TREE TOGGLE
	 * ================================================================ */

	function addDoctrineToggle(): void {
		const G = window.Game;
		if (!G) return;
		const container = document.getElementById('ascendBox');
		if (!container) return;
		if (document.getElementById('doctrineToggle')) return;

		const toggle = document.createElement('a');
		toggle.id = 'doctrineToggle';
		toggle.className = 'option framed small';
		toggle.style.cssText = 'font-size:11px;margin-top:4px;cursor:pointer;';
		toggle.textContent = 'Doctrine';
		toggle.onclick = function () {
			PlaySound('snd/tick.mp3');
			showDoctrineTree();
		};
		container.appendChild(toggle);
	}

	/* ================================================================
	 * UI: TOP BAR CELESTIAL WIDGET
	 * ================================================================
	 * Displays spendable EE in the top comments bar (above Legacy) and
	 * gives direct access to the 3D celestial sphere during live gameplay.
	 * Only shows up when the player can actually afford a Doctrine node
	 * or can afford to Transcend (earns >= 1 EE). */

	/** Whether the player can afford any currently available doctrine node. */
	function canAffordDoctrine(): boolean {
		return DOCTRINE.some(function (node) {
			if (doctrineHas(node.id)) return false;
			if (state.ee < node.cost) return false;
			for (const pid of node.parents) {
				if (!doctrineHas(pid)) return false;
			}
			return true;
		});
	}

	/** Whether the player can afford Transcendence (meets gate and earns >= 1 EE). */
	function canAffordTranscend(): boolean {
		const G = window.Game;
		if (!G) return false;
		const eeGain = computeEE(G.cookiesReset + G.cookiesEarned);
		return canTranscend() && eeGain > 0;
	}

	/** Whether the player can afford either Transcendence or a Doctrine purchase. */
	function canAffordCelestial(): boolean {
		return canAffordDoctrine() || canAffordTranscend();
	}

	function updateTopBarWidget(): void {
		const G = window.Game;
		if (!G) return;
		const comments = document.getElementById('comments');
		if (!comments) return;

		const canAfford = canAffordCelestial();
		let btn = document.getElementById('transcendTopBarBtn');
		if (!canAfford) {
			if (btn) btn.style.display = 'none';
			return;
		}

		if (!btn) {
			btn = document.createElement('div');
			btn.id = 'transcendTopBarBtn';
			btn.className = 'panelButton';
			btn.style.cssText =
				'position:absolute;bottom:62px;right:0px;cursor:pointer;z-index:100;' +
				'background:radial-gradient(ellipse at 50% 50%, rgba(130,60,230,0.88) 0%, rgba(20,5,40,0.95) 100%);' +
				'border:1px solid rgba(255,215,0,0.6);border-radius:4px 0 0 4px;' +
				'padding:4px 8px;font-size:11px;color:#ffd700;box-shadow:0 0 10px rgba(160,80,255,0.4);' +
				'transition:box-shadow 0.2s, border-color 0.2s;text-align:center;user-select:none;';
			btn.onclick = function () {
				PlaySound('snd/tick.mp3');
				showDoctrineTree();
			};
			btn.onmouseenter = function () {
				if (G.tooltip && G.tooltip.draw) {
					const eeGain = computeEE(G.cookiesReset + G.cookiesEarned);
					const canT = canTranscend() && eeGain > 0;
					let content = '';
					if (state.ee > 0) {
						content += 'Spendable EE: <b>' + state.ee + '</b>' + (canAffordDoctrine() ? ' <span style="color:#86efac;">(Upgrades available!)</span>' : '') + '<br>';
					}
					if (canT) {
						content += '<div style="color:#86efac;margin-top:2px;">Transcendence ready: <b>+' + eeGain + ' EE</b></div>';
					}
					content += 'Doctrine Nodes: <b>' + state.doctrine.length + '/' + DOCTRINE.length + '</b>';
					const desc = '<div style="min-width:180px;text-align:center;font-size:11px;padding:6px;">' +
						'<b style="color:#ffd700;">Celestial Doctrine Tree</b><div class="line"></div>' +
						content +
						'<div class="line"></div>' +
						'<small>Click to open the 3D celestial sphere.</small></div>';
					G.tooltip.draw(this, desc, 'bottom-right');
				}
			};
			btn.onmouseleave = function () {
				if (G.tooltip && G.tooltip.hide) G.tooltip.hide();
			};
			comments.appendChild(btn);
		}

		btn.style.display = 'block';
		const eeGain = computeEE(G.cookiesReset + G.cookiesEarned);
		if (state.ee > 0 && eeGain > 0 && canTranscend()) {
			btn.innerHTML = '<span style="color:#f8c0ff;">✦</span> ' + state.ee + ' <small style="font-size:9px;color:#86efac;">(+' + eeGain + ') EE</small>';
		} else if (state.ee > 0) {
			btn.innerHTML = '<span style="color:#f8c0ff;">✦</span> ' + state.ee + ' <small style="font-size:9px;color:#ddd;">EE</small>';
		} else {
			btn.innerHTML = '<span style="color:#f8c0ff;">✦</span> +' + eeGain + ' <small style="font-size:9px;color:#ddd;">EE</small>';
		}
	}

	/* ================================================================
	 * UI: STATS SCREEN INTEGRATION
	 * ================================================================ */

	function appendStats(): void {
		const G = window.Game;
		if (!G) return;
		const menu = document.getElementById('menu');
		if (!menu || document.getElementById('cc3TranscendStats')) return;
		if (!canTranscend() && state.eeEarned === 0 && state.transcendences === 0) return;

		const wrap = document.createElement('div');
		wrap.id = 'cc3TranscendStats';
		wrap.className = 'selectable';

		const nextGain = computeEE(G.cookiesReset + G.cookiesEarned);
		let milestoneList = '';
		if (state.milestones.length > 0) {
			milestoneList = '<div class="listing"><b>Milestones unlocked:</b> ' +
				state.milestones.map((th) => {
					const m = MILESTONES.find((item) => item.threshold === th);
					return m ? `<span title="${m.desc}" style="color:#c084fc;">${m.name}</span>` : `${th} EE`;
				}).join(', ') + '</div>';
		}

		wrap.innerHTML =
			'<div class="section" style="margin-top:16px;">Transcendence (Second Prestige Layer)</div>' +
			'<div class="subsection">' +
			'<div class="title">Celestial Sphere & Eternal Essence</div>' +
			'<div class="listing"><b>Eternal Essence:</b> <span style="color:#ffd700;font-weight:bold;">' + state.ee + '</span> <small>(lifetime earned: ' + state.eeEarned + ')</small></div>' +
			'<div class="listing"><b>Transcendences performed:</b> ' + state.transcendences + '</div>' +
			'<div class="listing"><b>Current run EE gain:</b> +' + nextGain + ' EE</div>' +
			'<div class="listing"><b>Doctrine nodes unlocked:</b> ' + state.doctrine.length + ' / ' + DOCTRINE.length + '</div>' +
			milestoneList +
			'<div style="margin-top:8px;">' +
			'<a id="statsOpenDoctrineBtn" class="option framed small" style="cursor:pointer;font-size:11px;" onclick="PlaySound(\'snd/tick.mp3\');window.__cc3Transcendence.showDoctrineTree();">Open 3D Doctrine Tree</a>' +
			'</div>' +
			'</div>';

		menu.appendChild(wrap);
	}

	/* ================================================================
	 * UPGRADE PICKER (Steady Hand / Timeless milestones)
	 * ================================================================
	 * Appears between the Transcend confirmation prompt and the actual
	 * transcendence: lets the player choose 1 or 2 prestige upgrades to
	 * preserve across the reset. First Light's cosmetic slot is
	 * auto-filled (no picker needed). */

	/** Entry point called by the Transcend button's Yes handler.
	 *  Snapshots the First Light cosmetic, then shows the upgrade picker
	 *  (if milestones warrant it) before invoking doTranscend(). */
	function startTranscendWithPicker(): void {
		const G = window.Game;
		if (!G) return;

		// First Light (1 EE): auto-snapshot the first owned cosmetic upgrade.
		// (Stored in state here so doTranscendCore can restore it after reset.)
		state.keptCosmetic = '';
		if (hasMilestone(1)) {
			for (const name of COSMETIC_UPGRADE_NAMES) {
				if (G.Has && G.Has(name)) { state.keptCosmetic = name; break; }
			}
		}

		// Steady Hand (25 EE) → 1 slot; Timeless (500 EE) → 2 slots.
		const slots = hasMilestone(500) ? 2 : hasMilestone(25) ? 1 : 0;
		if (slots > 0) {
			showUpgradePicker(slots, function (chosen: string[]) {
				state.keptUpgrades = chosen;
				doTranscend();
			});
		} else {
			state.keptUpgrades = [];
			doTranscend();
		}
	}

	/** Show a modal overlay listing owned prestige upgrades, letting the
	 *  player select up to `slots` of them to survive the Transcendence. */
	function showUpgradePicker(slots: number, onConfirm: (chosen: string[]) => void): void {
		const G = window.Game;
		if (!G) { onConfirm([]); return; }

		// Collect eligible prestige upgrades (exclude cosmetics — those are auto-kept)
		const eligible: string[] = [];
		for (const uName in G.Upgrades) {
			const u = G.Upgrades[uName];
			if (u && u.pool === 'prestige' && u.bought &&
				!(COSMETIC_UPGRADE_NAMES as readonly string[]).includes(uName)) {
				eligible.push(uName);
			}
		}
		if (eligible.length === 0) { onConfirm([]); return; }

		const chosen = new Set<string>();

		// ── Build DOM ─────────────────────────────────────────────────
		const overlay = document.createElement('div');
		overlay.id = 'transcendPicker';
		overlay.style.cssText =
			'position:fixed;top:0;left:0;width:100%;height:100%;' +
			'background:rgba(0,0,0,0.78);z-index:10001;' +
			'display:flex;align-items:center;justify-content:center;' +
			'font-family:serif;';

		const box = document.createElement('div');
		box.style.cssText =
			'background:#12121e;border:2px solid rgba(255,215,0,0.35);' +
			'padding:24px;max-width:620px;width:92vw;max-height:82vh;' +
			'display:flex;flex-direction:column;color:#ddd;box-sizing:border-box;';

		const title = document.createElement('h3');
		title.style.cssText = 'margin:0 0 6px;color:#ffd700;font-size:17px;';
		title.textContent = slots === 1
			? 'Keep 1 heavenly upgrade across Transcendence'
			: 'Keep up to 2 heavenly upgrades across Transcendence';

		const subtitle = document.createElement('div');
		subtitle.style.cssText = 'margin-bottom:10px;font-size:12px;color:#999;';
		subtitle.textContent =
			'You own ' + eligible.length + ' heavenly upgrade' +
			(eligible.length === 1 ? '' : 's') + '. ' +
			'Click to select ' + (slots === 1 ? 'one' : 'up to two') + ' to preserve.';

		const list = document.createElement('div');
		list.style.cssText =
			'overflow-y:auto;flex:1;display:flex;flex-wrap:wrap;' +
			'gap:5px;padding:8px;border:1px solid rgba(255,255,255,0.08);' +
			'max-height:380px;';

		const counter = document.createElement('div');
		counter.style.cssText = 'margin:10px 0 6px;font-size:13px;color:#bbb;';

		const btnRow = document.createElement('div');
		btnRow.style.cssText = 'display:flex;gap:8px;margin-top:4px;';

		const confirmBtn = document.createElement('button');
		confirmBtn.style.cssText =
			'flex:1;padding:10px;background:#3a2e05;border:1px solid #ffd700;' +
			'color:#ffd700;font-family:serif;font-size:14px;cursor:pointer;';
		confirmBtn.textContent = 'Confirm & Transcend';

		const skipBtn = document.createElement('button');
		skipBtn.style.cssText =
			'padding:10px 18px;background:transparent;border:1px solid rgba(255,255,255,0.2);' +
			'color:#888;font-family:serif;font-size:12px;cursor:pointer;';
		skipBtn.textContent = 'Skip';

		function updateUI(): void {
			counter.textContent = 'Selected: ' + chosen.size + ' / ' + slots;
			confirmBtn.disabled = false; // always allow confirming (even 0 selected)
			list.querySelectorAll<HTMLElement>('[data-upname]').forEach(function (el) {
				const name = el.dataset['upname'] || '';
				el.style.borderColor   = chosen.has(name) ? '#ffd700' : 'rgba(255,255,255,0.14)';
				el.style.background    = chosen.has(name) ? 'rgba(255,215,0,0.14)' : 'rgba(255,255,255,0.04)';
			});
		}

		// Populate list
		for (const uName of eligible) {
			const item = document.createElement('div');
			item.dataset['upname'] = uName;
			item.style.cssText =
				'padding:7px 11px;border:1px solid rgba(255,255,255,0.14);' +
				'background:rgba(255,255,255,0.04);cursor:pointer;' +
				'min-width:140px;flex:1 0 auto;font-size:12px;line-height:1.3;' +
				'transition:border-color 0.12s,background 0.12s;';
			item.title = (G.Upgrades[uName] as any)?.ddesc || uName;
			item.textContent = uName;
			item.onclick = function () {
				if (chosen.has(uName)) {
					chosen.delete(uName);
				} else if (chosen.size < slots) {
					chosen.add(uName);
				}
				updateUI();
			};
			list.appendChild(item);
		}

		confirmBtn.onclick = function () {
			PlaySound('snd/tick.mp3');
			overlay.remove();
			onConfirm(Array.from(chosen));
		};
		skipBtn.onclick = function () {
			PlaySound('snd/tickOff.mp3');
			overlay.remove();
			onConfirm([]);
		};

		btnRow.appendChild(confirmBtn);
		btnRow.appendChild(skipBtn);
		box.appendChild(title);
		box.appendChild(subtitle);
		box.appendChild(list);
		box.appendChild(counter);
		box.appendChild(btnRow);
		overlay.appendChild(box);
		document.body.appendChild(overlay);
		updateUI();
	}

	/* 3D Celestial Branch Configuration:
	 * Distributes branches across distinct 3D orbital sectors and vertical inclinations,
	 * preventing plane crowding and enabling endless multi-layer expansion. */
	interface Branch3DConfig {
		baseAngle: number; // Azimuth in radians around the central Sun
		phi: number;       // Celestial elevation angle in radians (vertical inclination / Z separation)
		fan: number[];     // Lateral angular spread per tier [tier0, tier1, tier2, tier3, ...]
		color: string;     // Celestial branch glow color
		glow: string;      // Semi-transparent luminous glow
	}

	const BRANCH_3D: Record<string, Branch3DConfig> = {
		glutton: {
			baseAngle: -Math.PI * 0.28, // ~-50 deg (North-East quadrant)
			phi: 28 * Math.PI / 180,    // Ascending celestial elevation (+Z)
			fan: [0, 0.08, -0.06, 0.02],
			color: '#ff9a28',
			glow: 'rgba(255,154,40,0.65)'
		},
		idler: {
			baseAngle: Math.PI * 0.22,  // ~+40 deg (South-East quadrant)
			phi: 14 * Math.PI / 180,    // Upper diagonal elevation (+Z)
			fan: [0, 0.08, -0.06, 0.02],
			color: '#38bdf8',
			glow: 'rgba(56,189,248,0.65)'
		},
		fatebinder: {
			baseAngle: Math.PI * 0.72,  // ~+130 deg (South-West quadrant)
			phi: -28 * Math.PI / 180,   // Descending abyssal elevation (-Z)
			fan: [0, -0.08, 0.06, -0.02],
			color: '#c084fc',
			glow: 'rgba(192,132,252,0.65)'
		},
		rebuilder: {
			baseAngle: -Math.PI * 0.78, // ~-140 deg (North-West quadrant)
			phi: -14 * Math.PI / 180,   // Lower diagonal elevation (-Z)
			fan: [0, -0.08, 0.06, -0.02],
			color: '#4ade80',
			glow: 'rgba(74,222,128,0.65)'
		}
	};

	/* Orbit radii as fractions of the system half-size (set dynamically).
	 * Inner orbits hold cheaper nodes, outer hold expensive ones. */
	const ORBIT_FRACTIONS = [0.29, 0.52, 0.75, 0.98];
	const ORBIT_BY_COST: Record<number, number> = { 1: 0, 3: 1, 8: 2, 15: 3 };

	/* 3D View and Pan/zoom state for the full-screen view. */
	let _rotX = 58;  // Tilt angle in degrees (pitch)
	let _rotZ = 0;   // Orbit rotation angle in degrees (yaw)
	let _viewOffX = 0, _viewOffY = 0, _viewZoom = 1;
	let _viewDragging = false, _didDrag = false;
	let _viewDragStartX = 0, _viewDragStartY = 0;
	let _viewDragRotX = 58, _viewDragRotZ = 0;
	let _viewDragOffX = 0, _viewDragOffY = 0;
	let _isPanning = false;

	/** Inject the full-screen Doctrine view CSS once. */
	function _injectSolarCSS(): void {
		if (document.getElementById('doctrineSolarCSS')) return;
		const s = document.createElement('style');
		s.id = 'doctrineSolarCSS';
		s.textContent = `
#doctrineFullView {
  position:fixed; top:0; left:0; width:100vw; height:100vh;
  z-index:100000005;
  background:radial-gradient(ellipse at 50% 40%, #0d0d22 0%, #030308 100%);
  display:flex; flex-direction:column;
  overflow:hidden; user-select:none;
  color:#fff; font-family:serif;
}
/* Eased enter/exit (fade + gentle zoom-out), same treatment as the heavenly
   tree's browse view. The view is a fixed overlay — nothing scrolls, so no
   pinning is needed, just a soft entrance. The hidden pre-state is the base
   rule below; .in flips it visible via transition. body.noMotion never sees
   the hidden state (the JS adds .in synchronously, and .noAnim/QA paths can
   force the end state). */
body:not(.noMotion) #doctrineFullView:not(.in) { opacity:0; transform:scale(1.06); }
body:not(.noMotion) #doctrineFullView.in { opacity:1; transform:scale(1); transition:opacity 200ms ease-out, transform 200ms ease-out; }
body:not(.noMotion) #doctrineFullView.out { opacity:0; transform:scale(1.03); transition:opacity 180ms ease-in, transform 180ms ease-in; }
#doctrineTopBar {
  width:100%; height:48px; display:flex; align-items:center;
  background:rgba(0,0,0,0.65); flex-shrink:0;
  border-bottom:1px solid rgba(255,255,255,0.08);
  z-index:10; padding:0 36px 0 20px; box-sizing:border-box;
}
#doctrineBackBtn {
  font-size:14px; cursor:pointer; color:#999;
  transition:color 0.15s; padding:8px 14px;
  white-space:nowrap;
}
#doctrineBackBtn:hover { color:#fff; }
#doctrineHint {
  font-size:11px; color:#778; margin-left:8px; white-space:nowrap;
  user-select:none; pointer-events:none;
}
@media (max-width: 820px) {
  #doctrineHint { display:none; }
}
#doctrineInfo {
  flex:1; text-align:center; font-size:13px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  padding:0 16px;
}
#doctrineInfo b { color:#ffd700; }
#doctrineResetBtn {
  font-size:12px; cursor:pointer; color:#888;
  transition:color 0.15s, border-color 0.15s;
  padding:5px 12px; border:1px solid rgba(255,255,255,0.12);
  border-radius:4px; white-space:nowrap; margin-right:10px;
}
#doctrineResetBtn:hover { color:#fff; border-color:rgba(255,255,255,0.35); }
#doctrineRespecBtn {
  font-size:12px; cursor:pointer; color:#888;
  transition:color 0.15s, border-color 0.15s;
  padding:5px 14px; border:1px solid rgba(255,255,255,0.12);
  border-radius:4px; white-space:nowrap; margin-right:6px;
}
#doctrineRespecBtn:hover { color:#f84; border-color:rgba(255,136,68,0.4); }
#doctrineCanvas {
  flex:1; cursor:grab; perspective:1000px; perspective-origin:50% 50%;
  overflow:hidden; position:relative; touch-action:none;
  background:
    radial-gradient(1.5px 1.5px at 15% 20%, rgba(255,255,255,0.7), transparent),
    radial-gradient(1px 1px at 35% 65%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1.5px 1.5px at 75% 25%, rgba(200,220,255,0.6), transparent),
    radial-gradient(1px 1px at 85% 80%, rgba(255,220,200,0.5), transparent),
    radial-gradient(2px 2px at 50% 15%, rgba(255,255,255,0.8), transparent),
    radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.4), transparent),
    radial-gradient(circle at 50% 50%, rgba(25,15,45,0.45) 0%, transparent 75%);
  background-size: 500px 500px, 400px 400px, 600px 600px, 450px 450px, 700px 700px, 350px 350px, 100% 100%;
}
#doctrineCanvas.dragging { cursor:grabbing; }
#doctrineViewport {
  position:absolute; top:50%; left:50%;
  transform-style:preserve-3d;
  transform:translate(-50%,-50%) translate(var(--ox,0px),var(--oy,0px)) scale(var(--zoom,1));
  pointer-events:none;
}
#doctrineSystem {
  transform-style:preserve-3d;
  transform:rotateX(var(--rotX,58deg)) rotateZ(var(--rotZ,0deg));
  position:relative; pointer-events:none;
}
.doctrine-orbit-ring {
  position:absolute; top:50%; left:50%; border-radius:50%;
  transform-style:preserve-3d; pointer-events:none;
}
.doctrine-sun {
  position:absolute; top:50%; left:50%; border-radius:50%;
  background:radial-gradient(circle at 35% 35%, #fff6a0, #ffd700 45%, #b8860b 80%, #633e00 100%);
  box-shadow:0 0 45px rgba(255,215,0,0.65), 0 0 90px rgba(255,160,0,0.25);
  display:flex; flex-direction:column;
  align-items:center; justify-content:center;
  transform-style:preserve-3d;
  transform:rotateZ(var(--invRotZ,0deg)) rotateX(var(--invRotX,-58deg));
  color:#201000; font-weight:bold; font-size:13px; cursor:default;
  line-height:1.2; pointer-events:auto;
  text-shadow:0 1px 2px rgba(255,255,255,0.6);
}
.doctrine-sun .sun-ee { font-size:20px; }
.doctrine-sun .sun-label { font-size:10px; opacity:0.85; font-weight:normal; }
.doctrine-planet {
  position:absolute;
  display:flex; flex-direction:column;
  align-items:center; justify-content:flex-start;
  transform-style:preserve-3d;
  cursor:default; pointer-events:auto;
  transition:opacity 0.2s ease;
  user-select:none;
}
/* Round spherical 3D planet body */
.planet-sphere {
  border-radius:50%;
  position:relative;
  display:flex; align-items:center; justify-content:center;
  box-shadow:inset -5px -5px 12px rgba(0,0,0,0.85), inset 2px 2px 5px rgba(255,255,255,0.4), 0 4px 12px rgba(0,0,0,0.6);
  transition:box-shadow 0.25s ease, transform 0.25s ease;
  z-index:1; flex-shrink:0;
}
/* Specular highlight shine overlay */
.planet-shine {
  position:absolute; top:3px; left:6px; width:45%; height:35%;
  border-radius:50%;
  background:radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 80%);
  pointer-events:none; z-index:3;
}
/* Branch-specific celestial planet themes */
.doctrine-planet.branch-glutton .planet-sphere {
  background:radial-gradient(circle at 32% 30%, #ffc272 0%, #ff7a18 35%, #b53800 70%, #440c00 100%);
  border:1.5px solid rgba(255, 180, 80, 0.45);
}
.doctrine-planet.branch-idler .planet-sphere {
  background:radial-gradient(circle at 32% 30%, #a4eeff 0%, #20a0d8 35%, #084880 70%, #021a36 100%);
  border:1.5px solid rgba(80, 210, 255, 0.45);
}
.doctrine-planet.branch-fatebinder .planet-sphere {
  background:radial-gradient(circle at 32% 30%, #f4b4ff 0%, #a83ce4 35%, #5a1082 70%, #220238 100%);
  border:1.5px solid rgba(220, 120, 255, 0.45);
}
.doctrine-planet.branch-rebuilder .planet-sphere {
  background:radial-gradient(circle at 32% 30%, #8efcc0 0%, #22c06a 35%, #08602c 70%, #02260e 100%);
  border:1.5px solid rgba(80, 240, 140, 0.45);
}
/* Saturn-like planetary rings for apex tier 3/4 planets */
.planet-ring {
  position:absolute; top:50%; left:50%;
  width:145%; height:40%; border-radius:50%;
  transform:translate(-50%, -50%) rotate(-25deg);
  border:2px solid rgba(220, 160, 255, 0.5);
  box-shadow:0 0 8px rgba(220, 160, 255, 0.35), inset 0 0 6px rgba(220, 160, 255, 0.2);
  pointer-events:none; z-index:0; flex-shrink:0;
}
/* 3D Luminous constellation filaments */
.doctrine-filament {
  position:absolute;
  height:1px;
  transform-style:preserve-3d;
  pointer-events:none;
  transform-origin:0% 50%;
  border-radius:1px;
}
/* The icon centered on the planet face */
.doctrine-planet .planet-icon {
  width:26px; height:26px; image-rendering:pixelated;
  background-size:auto; flex-shrink:0; position:relative; z-index:2;
  filter:drop-shadow(0 2px 4px rgba(0,0,0,0.85));
}
/* Floating label underneath */
.planet-badge {
  position:absolute; top:calc(100% + 5px); left:50%;
  transform:translateX(-50%);
  display:flex; flex-direction:column; align-items:center;
  background:none;
  border:none;
  padding:2px 4px;
  pointer-events:none; white-space:nowrap;
  max-width:130px;
}
.doctrine-planet .planet-name {
  font-size:11px; color:#e0e0e0; text-align:center;
  line-height:1.15; font-weight:600;
  text-shadow:0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.8);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  max-width:120px;
}
.doctrine-planet .planet-cost {
  font-size:10px; font-weight:bold; margin-top:1px; color:#ffd700;
  text-shadow:0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.8);
}
/* Interactive states */
.doctrine-planet.buyable {
  cursor:pointer;
}
.doctrine-planet.buyable .planet-sphere {
  box-shadow:inset -5px -5px 12px rgba(0,0,0,0.85), inset 2px 2px 5px rgba(255,255,255,0.5), 0 0 18px rgba(100,190,255,0.65);
}
.doctrine-planet.buyable:hover .planet-sphere {
  transform:scale(1.22);
  box-shadow:inset -5px -5px 12px rgba(0,0,0,0.85), inset 2px 2px 5px rgba(255,255,255,0.65), 0 0 28px rgba(100,210,255,0.9), 0 0 10px #fff;
}
.doctrine-planet.buyable:hover .planet-name {
  color:#fff;
  text-shadow:0 0 8px rgba(100,220,255,0.8), 0 1px 4px rgba(0,0,0,0.9);
}
/* Owned state */
.doctrine-planet.owned .planet-sphere {
  box-shadow:inset -5px -5px 12px rgba(0,0,0,0.85), inset 2px 2px 5px rgba(255,255,255,0.4), 0 0 18px rgba(70,240,110,0.6);
}
.doctrine-planet.owned .planet-cost {
  color:#4ef; font-weight:bold;
}
.doctrine-planet.owned:hover .planet-sphere {
  transform:scale(1.15);
  box-shadow:inset -5px -5px 12px rgba(0,0,0,0.85), inset 2px 2px 5px rgba(255,255,255,0.5), 0 0 24px rgba(70,255,120,0.8);
}
/* Locked state */
.doctrine-planet.locked {
  opacity:0.38;
  cursor:default;
}
.doctrine-planet.locked .planet-sphere {
  box-shadow:inset -5px -5px 12px rgba(0,0,0,0.95), inset 2px 2px 5px rgba(255,255,255,0.15), 0 2px 6px rgba(0,0,0,0.8);
}
`;
		document.head.appendChild(s);
	}

	/** Compute the optimal system size for the current viewport. */
	function _getSystemSize(): number {
		return Math.min(window.innerHeight * 0.88, window.innerWidth * 0.92, 1200);
	}

	/** Reset 3D view angles, pan, and zoom to defaults. */
	function resetView(): void {
		_rotX = 58;
		_rotZ = 0;
		_viewOffX = 0;
		_viewOffY = 0;
		_viewZoom = 1;
		const viewport = document.getElementById('doctrineViewport');
		if (viewport) _applyViewTransform(viewport);
	}

	/** Show the Doctrine tree as a full-screen 3D solar system view,
	 *  modelled after the heavenly upgrade tree — full-viewport takeover,
	 *  dark space background, top bar, and draggable/zoomable canvas. */
	function showDoctrineTree(): void {
		const G = window.Game;
		if (!G) return;
		const existing = document.getElementById('doctrineFullView');
		if (existing) {
			// Reopening while an eased close is still pending: cancel the removal
			// and bring the view back instead of early-returning on a dying view.
			if (existing.classList.contains('out')) {
				if ((existing as any).__cc3CloseTimer) { clearTimeout((existing as any).__cc3CloseTimer); (existing as any).__cc3CloseTimer = null; }
				existing.classList.remove('out');
				existing.classList.add('in');
			}
			return;
		}

		_injectSolarCSS();

		const view = document.createElement('div');
		view.id = 'doctrineFullView';

		// Top bar
		const top = document.createElement('div');
		top.id = 'doctrineTopBar';
		const back = document.createElement('div');
		back.id = 'doctrineBackBtn';
		back.textContent = '← Back';
		back.onclick = function () { PlaySound('snd/tickOff.mp3'); closeDoctrineTree(); };
		const hint = document.createElement('div');
		hint.id = 'doctrineHint';
		hint.textContent = 'Drag: Rotate • Shift+Drag: Pan • Scroll: Zoom';
		const info = document.createElement('div');
		info.id = 'doctrineInfo';
		const resetBtn = document.createElement('div');
		resetBtn.id = 'doctrineResetBtn';
		resetBtn.textContent = 'Reset 3D';
		resetBtn.title = 'Reset view rotation and zoom';
		resetBtn.onclick = function () { PlaySound('snd/tick.mp3'); resetView(); };
		const respec = document.createElement('div');
		respec.id = 'doctrineRespecBtn';
		respec.textContent = 'Respec';
		respec.onclick = function () { PlaySound('snd/tick.mp3'); respecAndRedraw(); };
		top.appendChild(back);
		top.appendChild(hint);
		top.appendChild(info);
		top.appendChild(resetBtn);
		top.appendChild(respec);

		const eeGain = computeEE(G.cookiesReset + G.cookiesEarned);
		if (canTranscend() && eeGain > 0) {
			const trBtn = document.createElement('div');
			trBtn.id = 'doctrineTranscendBtn';
			trBtn.textContent = '✦ Transcend (+' + eeGain + ' EE)';
			trBtn.style.cssText =
				'color:#ffd700;background:radial-gradient(ellipse at 50% 50%, rgba(130,60,230,0.88) 0%, rgba(20,5,40,0.95) 100%);' +
				'border:1px solid #ffd700;padding:4px 10px;border-radius:4px;cursor:pointer;font-weight:bold;font-size:11px;' +
				'box-shadow:0 0 8px rgba(180,80,255,0.5);margin-left:8px;user-select:none;';
			trBtn.title = 'Transcend now to claim +' + eeGain + ' Eternal Essence';
			trBtn.onclick = function () {
				PlaySound('snd/tick.mp3');
				closeDoctrineTree(true);
				doTranscend();
			};
			top.appendChild(trBtn);
		}

		view.appendChild(top);

		// Canvas with 3D orbit pan/zoom
		const canvas = document.createElement('div');
		canvas.id = 'doctrineCanvas';
		const viewport = document.createElement('div');
		viewport.id = 'doctrineViewport';
		const system = document.createElement('div');
		system.id = 'doctrineSystem';
		system.setAttribute('aria-label', 'Doctrine solar system');
		const size = _getSystemSize();
		system.style.width = size + 'px';
		system.style.height = size + 'px';
		viewport.appendChild(system);
		canvas.appendChild(viewport);
		view.appendChild(canvas);

		document.body.appendChild(view);

		_applyViewTransform(viewport);

		// Eased entrance: start hidden (CSS base state), then flip to the visible
		// state one frame later so the transition always plays. Skipped when the
		// engine is set to reduced motion.
		const noMotion = document.body && document.body.classList.contains('noMotion');
		if (!noMotion && typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(function () { requestAnimationFrame(function () { view.classList.add('in'); }); });
		} else {
			view.classList.add('in');
		}
		_renderSun(system);
		_renderSolarSystem(system);
		_updateDoctrineInfo();
		_initDoctrinePanZoom(canvas, viewport);
	}

	/** Close the Doctrine full-screen view. Eased exit on user clicks (matches
	 *  the eased entrance); instant when QA/QA-driven (the `instant` argument)
	 *  or under reduced motion. The view's removal is deferred until the exit
	 *  transition ends, but `Game.AscendBrowse`-style state has none here —
	 *  the function is re-entrant safe: a re-show while closing cancels the
	 *  pending removal. */
	function closeDoctrineTree(instant?: boolean): void {
		const view = document.getElementById('doctrineFullView');
		if (view) {
			if ((view as any).__cc3CloseTimer) { clearTimeout((view as any).__cc3CloseTimer); (view as any).__cc3CloseTimer = null; }
			const noMotion = document.body && document.body.classList.contains('noMotion');
			if (instant || noMotion || !view.classList.contains('in') || typeof requestAnimationFrame !== 'function') {
				view.remove(); //never entered, reduced motion, or QA: remove now
			} else {
				view.classList.remove('in');
				view.classList.add('out');
				(view as any).__cc3CloseTimer = setTimeout(function () {
					(view as any).__cc3CloseTimer = null;
					const v = document.getElementById('doctrineFullView');
					if (v && v.classList.contains('out')) v.remove(); //a re-show cleared .out
				}, 240);
			}
		}
		_rotX = 58; _rotZ = 0; _viewOffX = 0; _viewOffY = 0; _viewZoom = 1;
	}

	/** Set up 3D mouse-drag rotation, shift/right-drag panning, and wheel zoom on the canvas. */
	function _initDoctrinePanZoom(canvas: HTMLElement, viewport: HTMLElement): void {
		let isMouseDown = false;

		canvas.addEventListener('contextmenu', function (e: MouseEvent) {
			e.preventDefault();
		});

		canvas.addEventListener('mousedown', function (e: MouseEvent) {
			if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
			isMouseDown = true;
			_viewDragging = false;
			_didDrag = false;
			_viewDragStartX = e.clientX;
			_viewDragStartY = e.clientY;
			_viewDragRotX = _rotX;
			_viewDragRotZ = _rotZ;
			_viewDragOffX = _viewOffX;
			_viewDragOffY = _viewOffY;
			_isPanning = e.shiftKey || e.button === 1 || e.button === 2;
		});

		window.addEventListener('mousemove', function (e: MouseEvent) {
			if (!isMouseDown) return;
			const dx = e.clientX - _viewDragStartX;
			const dy = e.clientY - _viewDragStartY;
			if (!_viewDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
				_viewDragging = true;
				_didDrag = true;
				canvas.classList.add('dragging');
			}
			if (_viewDragging) {
				if (_isPanning || e.shiftKey) {
					_viewOffX = _viewDragOffX + dx / _viewZoom;
					_viewOffY = _viewDragOffY + dy / _viewZoom;
				} else {
					// 3D orbit rotation: horizontal drag rotates azimuth/yaw, vertical tilts pitch
					_rotZ = (_viewDragRotZ + dx * 0.45) % 360;
					_rotX = Math.max(25, Math.min(68, _viewDragRotX + dy * 0.35));
				}
				_applyViewTransform(viewport);
			}
		});

		window.addEventListener('mouseup', function () {
			if (!isMouseDown) return;
			isMouseDown = false;
			canvas.classList.remove('dragging');
			_viewDragging = false;
			setTimeout(function () { _didDrag = false; }, 60);
		});

		window.addEventListener('blur', function () {
			if (!isMouseDown) return;
			isMouseDown = false;
			canvas.classList.remove('dragging');
			_viewDragging = false;
			setTimeout(function () { _didDrag = false; }, 60);
		});

		canvas.addEventListener('wheel', function (e: WheelEvent) {
			e.preventDefault();
			const delta = e.deltaY > 0 ? -0.1 : 0.1;
			_viewZoom = Math.max(0.4, Math.min(2.0, _viewZoom + delta));
			_applyViewTransform(viewport);
		}, { passive: false });

		// Touch controls: single finger to rotate 3D, two fingers to pan & pinch zoom
		let touchMode: 'none' | 'rotate' | 'pinch' = 'none';
		let touchStartDist = 0;
		let touchStartZoom = 1;

		canvas.addEventListener('touchstart', function (e: TouchEvent) {
			if (e.touches.length === 1) {
				touchMode = 'rotate';
				_viewDragging = false;
				_didDrag = false;
				_viewDragStartX = e.touches[0].clientX;
				_viewDragStartY = e.touches[0].clientY;
				_viewDragRotX = _rotX;
				_viewDragRotZ = _rotZ;
			} else if (e.touches.length === 2) {
				touchMode = 'pinch';
				_viewDragging = true;
				_didDrag = true;
				const t1 = e.touches[0], t2 = e.touches[1];
				touchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
				touchStartZoom = _viewZoom;
				_viewDragStartX = (t1.clientX + t2.clientX) / 2;
				_viewDragStartY = (t1.clientY + t2.clientY) / 2;
				_viewDragOffX = _viewOffX;
				_viewDragOffY = _viewOffY;
			}
		}, { passive: true });

		canvas.addEventListener('touchmove', function (e: TouchEvent) {
			if (touchMode === 'rotate' && e.touches.length === 1) {
				const dx = e.touches[0].clientX - _viewDragStartX;
				const dy = e.touches[0].clientY - _viewDragStartY;
				if (!_viewDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
					_viewDragging = true;
					_didDrag = true;
				}
				if (_viewDragging) {
					_rotZ = (_viewDragRotZ + dx * 0.45) % 360;
					_rotX = Math.max(25, Math.min(68, _viewDragRotX + dy * 0.35));
					_applyViewTransform(viewport);
				}
			} else if (touchMode === 'pinch' && e.touches.length === 2) {
				const t1 = e.touches[0], t2 = e.touches[1];
				const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
				if (touchStartDist > 0) {
					_viewZoom = Math.max(0.4, Math.min(2.0, touchStartZoom * (dist / touchStartDist)));
				}
				const midX = (t1.clientX + t2.clientX) / 2;
				const midY = (t1.clientY + t2.clientY) / 2;
				_viewOffX = _viewDragOffX + (midX - _viewDragStartX) / _viewZoom;
				_viewOffY = _viewDragOffY + (midY - _viewDragStartY) / _viewZoom;
				_applyViewTransform(viewport);
			}
		}, { passive: true });

		canvas.addEventListener('touchend', function () {
			touchMode = 'none';
			_viewDragging = false;
			setTimeout(function () { _didDrag = false; }, 60);
		});

		window.addEventListener('keydown', function (e: KeyboardEvent) {
			if (!document.getElementById('doctrineFullView')) return;
			if (e.key === 'Escape') {
				e.preventDefault();
				closeDoctrineTree();
				return;
			}
			const step = 20 / _viewZoom;
			if (e.shiftKey) {
				// Shift + Arrow keys: pan
				switch (e.key) {
					case 'ArrowLeft': _viewOffX -= step; _applyViewTransform(viewport); break;
					case 'ArrowRight': _viewOffX += step; _applyViewTransform(viewport); break;
					case 'ArrowUp': _viewOffY -= step; _applyViewTransform(viewport); break;
					case 'ArrowDown': _viewOffY += step; _applyViewTransform(viewport); break;
				}
			} else {
				// Arrow keys: 3D orbit rotate
				switch (e.key) {
					case 'ArrowLeft': _rotZ = (_rotZ - 6) % 360; _applyViewTransform(viewport); break;
					case 'ArrowRight': _rotZ = (_rotZ + 6) % 360; _applyViewTransform(viewport); break;
					case 'ArrowUp': _rotX = Math.max(25, _rotX - 5); _applyViewTransform(viewport); break;
					case 'ArrowDown': _rotX = Math.min(68, _rotX + 5); _applyViewTransform(viewport); break;
				}
			}
		});
	}

	function _applyViewTransform(viewport: HTMLElement): void {
		viewport.style.setProperty('--zoom', String(_viewZoom));
		viewport.style.setProperty('--ox', Math.round(_viewOffX) + 'px');
		viewport.style.setProperty('--oy', Math.round(_viewOffY) + 'px');
		viewport.style.setProperty('--rotX', Math.round(_rotX) + 'deg');
		viewport.style.setProperty('--invRotX', (-Math.round(_rotX)) + 'deg');
		viewport.style.setProperty('--rotZ', Math.round(_rotZ) + 'deg');
		viewport.style.setProperty('--invRotZ', (-Math.round(_rotZ)) + 'deg');
	}

	/** Render the central sun (EE display). */
	function _renderSun(container: HTMLElement): void {
		const size = container.clientWidth || _getSystemSize();
		const sunSize = Math.max(60, Math.round(size * 0.09));
		let el = container.querySelector('.doctrine-sun') as HTMLElement;
		if (!el) {
			el = document.createElement('div');
			el.className = 'doctrine-sun';
			container.appendChild(el);
		}
		el.style.width = sunSize + 'px';
		el.style.height = sunSize + 'px';
		el.style.margin = (-sunSize / 2) + 'px';
		el.innerHTML = '<div class="sun-ee">' + state.ee + '</div><div class="sun-label">EE</div>';
	}

	/** Update the top bar info text. */
	function _updateDoctrineInfo(): void {
		const G = window.Game;
		const info = document.getElementById('doctrineInfo');
		if (!info) return;
		info.innerHTML = 'Eternal Essence: <b>' + state.ee + '</b> &nbsp;|&nbsp; Nodes: ' + state.doctrine.length + '/' + DOCTRINE.length;
		const respecBtn = document.getElementById('doctrineRespecBtn');
		if (respecBtn) respecBtn.textContent = 'Respec (' + state.doctrine.length + '/' + DOCTRINE.length + ')';
		const trBtn = document.getElementById('doctrineTranscendBtn');
		if (G && trBtn) {
			const eeGain = computeEE(G.cookiesReset + G.cookiesEarned);
			if (canTranscend() && eeGain > 0) {
				trBtn.textContent = '✦ Transcend (+' + eeGain + ' EE)';
				trBtn.style.display = 'block';
			} else {
				trBtn.style.display = 'none';
			}
		}
	}

	/** Render or re-render all planet nodes on their 3D orbits and celestial shells. */
	function _renderSolarSystem(container: HTMLElement): void {
		const size = container.clientWidth || _getSystemSize();
		const cx = size / 2, cy = size / 2;
		const radii = ORBIT_FRACTIONS.map((f) => Math.round(cx * f));

		// Remove old planets, filaments, and orbit rings
		const old = container.querySelectorAll('.doctrine-planet, .doctrine-orbit-ring, .doctrine-filament');
		for (let i = old.length - 1; i >= 0; i--) old[i].remove();

		// Draw 4 celestial tier orbit rings (golden baseline requirement for QA)
		const ringColors = [
			'rgba(255,215,80,0.12)',
			'rgba(100,200,255,0.12)',
			'rgba(210,120,255,0.12)',
			'rgba(100,255,200,0.12)'
		];
		for (const orbitIndex of [0, 1, 2, 3]) {
			const r = radii[orbitIndex];
			const ring = document.createElement('div');
			ring.className = 'doctrine-orbit-ring';
			ring.style.cssText =
				'position:absolute;top:50%;left:50%;width:' + (r * 2) + 'px;height:' + (r * 2) + 'px;' +
				'margin:' + (-r) + 'px;border-radius:50%;' +
				'border:1px solid ' + ringColors[orbitIndex] + ';' +
				'box-shadow:none;' +
				'pointer-events:none;';
			container.appendChild(ring);
		}

		// Calculate 3D spherical coordinates for all nodes in the galaxy
		const coords: Record<number, { x: number; y: number; z: number; branch: string; owned: boolean; canBuy: boolean }> = {};
		for (const node of DOCTRINE) {
			const orbitIndex = ORBIT_BY_COST[node.cost] ?? 0;
			const radius = radii[orbitIndex];
			const b = (node.branch && BRANCH_3D[node.branch]) || BRANCH_3D.glutton;
			const fanOffset = b.fan[orbitIndex] || 0;
			const angle = b.baseAngle + fanOffset;

			// Spherical coordinate projection into 3D Cartesian space
			const x = Math.round(radius * Math.cos(angle) * Math.cos(b.phi));
			const y = Math.round(radius * Math.sin(angle) * Math.cos(b.phi));
			const z = Math.round(radius * Math.sin(b.phi));

			const owned = doctrineHas(node.id);
			const canAfford = state.ee >= node.cost;
			const parentsMet = node.parents.every((pid) => doctrineHas(pid));
			const canBuy = !owned && canAfford && parentsMet;

			coords[node.id] = { x, y, z, branch: node.branch, owned, canBuy };
		}

		// Draw 3D luminous constellation filaments connecting parent and child nodes
		for (const node of DOCTRINE) {
			if (!node.parents || node.parents.length === 0) continue;
			const c2 = coords[node.id];
			if (!c2) continue;
			for (const pid of node.parents) {
				const c1 = coords[pid];
				if (!c1) continue;

				const dx = c2.x - c1.x;
				const dy = c2.y - c1.y;
				const dz = c2.z - c1.z;
				const length = Math.hypot(dx, dy, dz);
				const distXY = Math.hypot(dx, dy);
				const rotZ = (Math.atan2(dy, dx) * 180) / Math.PI;
				const pitch = (Math.atan2(dz, distXY) * 180) / Math.PI;

				const b = (node.branch && BRANCH_3D[node.branch]) || BRANCH_3D.glutton;
				const filament = document.createElement('div');
				filament.className = 'doctrine-filament';
				const isOwnedLink = c1.owned && c2.owned;
				const isAvailableLink = c1.owned && c2.canBuy;
				const opacity = isOwnedLink ? '0.70' : isAvailableLink ? '0.45' : '0.15';

				filament.style.cssText =
					'position:absolute;left:' + (cx + c1.x) + 'px;top:' + (cy + c1.y) + 'px;' +
					'width:' + length + 'px;height:1px;' +
					'transform-origin:0% 50%;' +
					'transform:translateZ(' + c1.z + 'px) rotateZ(' + rotZ + 'deg) rotateY(' + (-pitch) + 'deg);' +
					'background:' + b.glow + ';' +
					'opacity:' + opacity + ';' +
					'pointer-events:none;';
				container.appendChild(filament);
			}
		}

		// Place each 3D spherical planet node
		for (const node of DOCTRINE) {
			const pos = coords[node.id];
			if (!pos) continue;

			const owned = pos.owned;
			const canBuy = pos.canBuy;
			const parentsMet = node.parents.every((pid) => doctrineHas(pid));
			const canAfford = state.ee >= node.cost;

			// Sizing based on tier: Tier 1: 46px, Tier 2: 52px, Tier 3: 58px, Apex: 66px
			const sphereSize = node.cost >= 15 ? 66 : node.cost >= 8 ? 58 : node.cost >= 3 ? 52 : 46;

			const planet = document.createElement('div');
			planet.dataset['nodeId'] = String(node.id);
			planet.className = 'doctrine-planet' +
				(node.branch ? ' branch-' + node.branch : '') +
				(owned ? ' owned' : '') +
				(canBuy ? ' buyable' : '') +
				(!owned && !canBuy ? ' locked' : '');
			planet.style.left = (cx + pos.x) + 'px';
			planet.style.top = (cy + pos.y) + 'px';
			planet.style.setProperty('--ps', sphereSize + 'px');
			planet.style.width = sphereSize + 'px';
			planet.style.height = sphereSize + 'px';
			planet.style.margin = (-sphereSize / 2) + 'px';
			planet.style.transform = 'translateZ(' + pos.z + 'px) rotateZ(var(--invRotZ,0deg)) rotateX(var(--invRotX,-58deg))';

			// Optional celestial ring for apex & high-tier planets (cost >= 8)
			if (node.cost >= 8) {
				const ring = document.createElement('div');
				ring.className = 'planet-ring';
				planet.appendChild(ring);
			}

			// 3D Spherical planet body
			const sphere = document.createElement('div');
			sphere.className = 'planet-sphere';
			sphere.style.width = sphereSize + 'px';
			sphere.style.height = sphereSize + 'px';

			// Specular shine highlight
			const shine = document.createElement('div');
			shine.className = 'planet-shine';
			sphere.appendChild(shine);

			// Center icon
			const icon = document.createElement('div');
			icon.className = 'planet-icon';
			icon.style.cssText = 'background:url(img/icons.webp) -' + (node.icon[0] * 48) + 'px -' + (node.icon[1] * 48) + 'px;';
			sphere.appendChild(icon);

			planet.appendChild(sphere);

			// Floating badge for label and cost
			const badge = document.createElement('div');
			badge.className = 'planet-badge';

			const name = document.createElement('div');
			name.className = 'planet-name';
			name.textContent = node.name;
			badge.appendChild(name);

			const cost = document.createElement('div');
			cost.className = 'planet-cost';
			cost.textContent = owned ? '✓ Owned' : node.cost + ' EE';
			badge.appendChild(cost);

			planet.appendChild(badge);

			planet.onclick = function () {
				if (_didDrag) return;
				showNodeDetail(node.id);
			};

			if (!canBuy && !owned) {
				let reason = '';
				if (!parentsMet) {
					const missing = node.parents.filter((pid) => !doctrineHas(pid));
					reason = 'Requires: ' + missing.map((pid) => {
						const pn = DOCTRINE.find((d) => d.id === pid);
						return pn ? pn.name : '?';
					}).join(', ');
				} else if (!canAfford) {
					reason = 'Costs ' + node.cost + ' EE (you have ' + state.ee + ')';
				}
				planet.title = node.desc + (reason ? '\n' + reason : '');
			} else {
				planet.title = node.desc;
			}

			container.appendChild(planet);
		}
	}

	/** Show confirmation / detail modal for a doctrine node before purchasing. */
	function showNodeDetail(nodeId: number): void {
		const G = window.Game;
		if (!G) return;
		const node = DOCTRINE.find((d) => d.id === nodeId);
		if (!node) return;

		const owned = doctrineHas(node.id);
		const canAfford = state.ee >= node.cost;
		const parentsMet = node.parents.every((pid) => doctrineHas(pid));
		const canBuy = !owned && canAfford && parentsMet;

		const b = (node.branch && BRANCH_3D[node.branch]) || BRANCH_3D.glutton;
		const branchTitle = node.branch ? node.branch.charAt(0).toUpperCase() + node.branch.slice(1) + "'s Path" : '';

		let html = '<div style="text-align:center;padding:6px 12px;user-select:none;">';
		html += '<div style="display:inline-block;width:48px;height:48px;background:url(img/icons.webp) -' + (node.icon[0] * 48) + 'px -' + (node.icon[1] * 48) + 'px;margin-bottom:8px;border-radius:50%;box-shadow:0 0 16px ' + b.color + ';"></div>';
		html += '<h3 style="margin:0 0 4px;color:#ffd700;font-size:18px;">' + node.name + '</h3>';
		if (branchTitle) {
			html += '<div style="font-size:12px;color:' + b.color + ';margin-bottom:12px;font-style:italic;">' + branchTitle + ' • ' + node.cost + ' Eternal Essence</div>';
		}
		html += '<div class="line" style="margin:10px 0;"></div>';
		html += '<div style="font-size:14px;line-height:1.45;margin:14px 0;color:#f0f0f0;">' + node.desc + '</div>';

		if (owned) {
			html += '<div style="color:#4ade80;font-weight:bold;margin:12px 0 6px;font-size:13px;">✓ Already Owned & Active</div>';
		} else if (!parentsMet) {
			const missing = node.parents.filter((pid) => !doctrineHas(pid)).map((pid) => {
				const p = DOCTRINE.find((d) => d.id === pid);
				return p ? p.name : '?';
			});
			html += '<div style="color:#f87171;font-size:12px;margin:10px 0 4px;">Locked: Requires <b>' + missing.join(', ') + '</b></div>';
		} else if (!canAfford) {
			const need = node.cost - state.ee;
			html += '<div style="color:#fbbf24;font-size:12px;margin:10px 0 4px;">Costs <b>' + node.cost + ' EE</b> (you have ' + state.ee + ' EE, need ' + need + ' more)</div>';
		} else {
			html += '<div style="color:#4ade80;font-size:12px;margin:10px 0 4px;">Available! Balance: <b>' + state.ee + ' EE</b> → <b>' + (state.ee - node.cost) + ' EE</b></div>';
		}

		html += '</div>';

		const options: [string, any, string?][] = [];
		if (canBuy) {
			options.push([
				'Purchase (' + node.cost + ' EE)',
				function () {
					G.ClosePrompt();
					buyInTreeSolar(node.id);
				},
				'float:left;'
			]);
			options.push(['Cancel', 0, 'float:right;']);
		} else {
			options.push(['Close', 0]);
		}

		G.Prompt(html, options as any);
	}

	/** Purchase a node from the solar system UI and re-render in place. */
	function buyInTreeSolar(nodeId: number): void {
		const G = window.Game;
		if (!G) return;
		if (purchaseDoctrineNode(nodeId)) {
			PlaySound('snd/shimmerClick.mp3');
			const system = document.getElementById('doctrineSystem');
			if (system) {
				_renderSun(system);
				_renderSolarSystem(system);
				_updateDoctrineInfo();
			}
		}
	}

	/** Respec and re-render the solar system in place. */
	function respecAndRedraw(): void {
		const G = window.Game;
		if (!G) return;
		respecDoctrine();
		const system = document.getElementById('doctrineSystem');
		if (system) {
			_renderSun(system);
			_renderSolarSystem(system);
			_updateDoctrineInfo();
		}
	}

	/** Purchase + re-render (kept for the QA surface; delegates to the
	 *  solar-system re-renderer if the view is open, otherwise reopens). */
	function buyInTree(nodeId: number): void {
		const G = window.Game;
		if (!G) return;
		if (purchaseDoctrineNode(nodeId)) {
			PlaySound('snd/shimmerClick.mp3');
			const system = document.getElementById('doctrineSystem');
			if (system) {
				_renderSun(system);
				_renderSolarSystem(system);
				_updateDoctrineInfo();
			} else {
				showDoctrineTree();
			}
		}
	}

	/* ================================================================
	 * UNLOCK CHECK
	 * ================================================================ */

	let _unlockShown = false;

	function checkUnlock(): void {
		if (_unlockShown) return;
		if (!canTranscend()) return;
		const G = window.Game;
		if (!G) return;
		_unlockShown = true;
		if (state.transcendences === 0) {
			G.Notify(
				'Transcendence unlocked!',
				'You have filled the ascend meter. A new path awaits — check the Legacy tab.',
				[19, 7],
				8
			);
		}
		_addTranscendUI();
	}

	/* ================================================================
	 * UI INIT
	 * ================================================================ */

	let _uiAdded = false;

	function _addTranscendUI(): void {
		if (_uiAdded) return;
		_uiAdded = true;
		addTranscendButton();
		addDoctrineToggle();
		updateTopBarWidget();
	}

	/* ================================================================
	 * ACHIEVEMENTS
	 * ================================================================ */

	const _declared = { done: false };

	function declareAchievements(): void {
		if (_declared.done) return;
		_declared.done = true;
		const G = window.Game;
		if (!G) return;

		for (const a of ACHIEVEMENTS) {
			const ach = new G.Achievement(a.name, a.desc, a.icon);
			ach.order = 200100 + a.icon[0];
		}

		if (typeof window.LocalizeUpgradesAndAchievs === 'function') {
			window.LocalizeUpgradesAndAchievs();
		}
		G.recalculateGains = 1;
	}

	/** Check and award achievements. */
	function checkAchievements(): void {
		const G = window.Game;
		if (!G) return;
		if (state.transcendences >= 1) G.Win('First Glimpse');
		if (state.transcendences >= 10) G.Win('The Long View');
		if (hasMilestone(25)) G.Win('Steady as She Goes');
		if (state.transcendences >= 100) G.Win('Eternal');
		if (hasMilestone(1000)) G.Win('Omega');
	}

	/* ================================================================
	 * SAVE / LOAD
	 * ================================================================ */

	function save(): string {
		const data = {
			ee: state.ee,
			eeSpent: state.eeSpent,
			eeEarned: state.eeEarned,
			trans: state.transcendences,
			tpa: state.totalPrestigeAllTime,
			milestones: state.milestones,
			doctrine: state.doctrine,
			keptUpgrades: state.keptUpgrades,
			keptCosmetic: state.keptCosmetic,
		};
		return JSON.stringify(data);
	}

	function load(str: string): void {
		try {
			const data = JSON.parse(str);
			state.ee = data.ee || 0;
			state.eeSpent = data.eeSpent || 0;
			state.eeEarned = data.eeEarned || 0;
			state.transcendences = data.trans || 0;
			state.totalPrestigeAllTime = data.tpa || 0;
			state.milestones = data.milestones || [];
			state.doctrine = data.doctrine || [];
			state.keptUpgrades = data.keptUpgrades || [];
			state.keptCosmetic = data.keptCosmetic || '';
		} catch (e) {
			state.ee = 0;
			state.eeSpent = 0;
			state.eeEarned = 0;
			state.transcendences = 0;
			state.totalPrestigeAllTime = 0;
			state.milestones = [];
			state.doctrine = [];
			state.keptUpgrades = [];
			state.keptCosmetic = '';
		}

		// Sync _prestigeSeen from the loaded game state so we don't
		// double-count the delta.
		const G = window.Game;
		if (G) {
			_prestigeSeen = G.prestige;
		}
	}

	/* ================================================================
	 * INIT
	 * ================================================================ */

	function init(): void {
		const G = window.Game;
		if (!G) return;

		// Register hooks
		G.registerHook('create', createHook);
		G.registerHook('cps', cpsHook);
		G.registerHook('cookiesPerClick', cookiesPerClickHook);
		G.registerHook('click', clickHook);
		G.registerHook('reset', resetHook);
		G.registerHook('reincarnate', reincarnateHook);
		G.registerHook('check', checkHook);

		// Patch cost discounts and shimmer hooks
		patchEff();
		setupShimmerHooks();

		// Warm Embers (node 5): 50% discount on reactivating Shimmering veil
		const veilOff = G.Upgrades && G.Upgrades['Shimmering veil [off]'];
		if (veilOff && typeof veilOff.priceFunc === 'function') {
			const origPriceFunc = veilOff.priceFunc.bind(veilOff);
			veilOff.priceFunc = function () {
				let p = origPriceFunc();
				if (doctrineHas(5) && !(G.ascensionMode === 1 && !hasMilestone(1000))) {
					p *= 0.5;
				}
				return p;
			};
		}

		// Stats menu integration
		if (G.customStatsMenu) {
			G.customStatsMenu.push(function () {
				appendStats();
			});
		}

		// Check if the gate is already met (for returning players who loaded a save)
		if (canTranscend()) {
			_addTranscendUI();
		}

		// Sync prestige tracking
		_prestigeSeen = G.prestige;
	}

	/* ================================================================
	 * REGISTRATION
	 * ================================================================ */

	function register(): boolean {
		const G = window.Game;
		if (!G || typeof G.registerMod !== 'function') return false;
		G.registerMod(MOD_ID, {
			name: 'Transcendence',
			version: '1.0-cc3',
			init: init,
			save: save,
			load: load,
		}, true);
		return true;
	}

	if (!register()) {
		const t = window.setInterval(function () {
			if (register()) window.clearInterval(t);
		}, 25);
		window.addEventListener('load', function () { window.clearInterval(t); }, { once: true });
	}

	/* ================================================================
	 * QA / TEST SURFACE
	 * ================================================================ */

	window.__cc3Transcendence = {
		state,
		DOCTRINE,
		MILESTONES,
		ACHIEVEMENTS,
		computeEE,
		canTranscend,
		doTranscend,
		startTranscendWithPicker,
		showUpgradePicker,
		purchase: purchaseDoctrineNode,
		buyInTree,
		respec: respecDoctrine,
		respecAndRedraw,
		checkMilestones,
		checkAchievements,
		doctrineHas,
		hasMilestone,
		showDoctrineTree,
		closeDoctrineTree,
		showNodeDetail,
		resetView,
		getView3D: function () {
			return { rotX: _rotX, rotZ: _rotZ, zoom: _viewZoom, offX: _viewOffX, offY: _viewOffY };
		},
		_addTranscendUI,
		updateTopBarWidget,
		appendStats,
		canAffordDoctrine,
		canAffordTranscend,
		canAffordCelestial,
		save,
		load,
		/* What the last completion announced ('<h3>…</h3>…' for a dialog, the
		 * plain toast body otherwise) — lets the QA probe assert the content
		 * either way. */
		lastAnnouncement: function () { return _lastAnnouncement; },
		/* Seed a large cookiesReset for QA testing. */
		seed: function (reset: number) {
			const G = window.Game;
			if (!G) return;
			G.cookiesReset = reset;
			state.transcendences = 0;
			state.ee = 0;
			state.eeEarned = 0;
			state.milestones = [];
			state.doctrine = [];
			state.keptUpgrades = [];
			state.keptCosmetic = '';
			_unlockShown = false;
			_uiAdded = false;
		},
	};

	/* ================================================================
	 * Phase 2 complete. All 13 Doctrine nodes are implemented:
	 *   Glutton's Path:    Persistent Hand (1), Echoing Click (2), Cascade (3)
	 *   Idler's Path:      Lazy Oven (4), Warm Embers (5), Ambient Baking (6)
	 *   Fatebinder's Path: Fortune's Favor (7), Elder's Whisper (8),
	 *                      Strange Attractor (9), Double Dip (10)
	 *   Rebuilder's Path:  Frugal Start (11), Measured Growth (12), Legacy Echo (13)
	 *
	 * Phase 3 / future ideas:
	 * - Eternal Recipes: repeatable restricted runs with first-clear rewards
	 *   (modelled on existing ascensionModes in engine/main.ts:1284–1291).
	 * - Expand Doctrine from 4×3 to 4×5 nodes (12→20).
	 * - Balance pass using Game.AnalyzeEconomy with Doctrine active vs. off.
	 * - Doctrine tree DAG renderer (BuildAscendTree + Game.crate) for Phase 3.
	 * ================================================================ */
})();