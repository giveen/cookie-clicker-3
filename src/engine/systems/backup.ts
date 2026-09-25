/**
 * systems/backup.ts — CC3 rolling save backups (not in 2.048).
 *
 * The engine keeps exactly one save in localStorage (Game.SaveTo). If a bad
 * state is written over it — a mis-clicked import, a bug, a mod mishap — the
 * previous state is gone. This module keeps a rolling history of the last N
 * successful saves (each the same escaped save string the engine stores and
 * ImportSaveCode accepts), dedupes consecutive identical saves, prunes the
 * oldest entries past the cap, and exposes list/restore so the Options menu
 * can offer "restore an older backup" without leaving the game.
 *
 * Storage: one localStorage key per game (`CookieClickerGameBackups` /
 * `CookieClickerGameBetaBackups`), holding a JSON array of
 * `{ timestamp, save }` entries. `save` is the exact escaped string the main
 * save slot holds, so restoring is a plain ImportSaveCode + WriteSave.
 *
 * All functions are safe no-ops when localStorage is unavailable (private
 * mode, storage quota, storage disabled) — a backup that cannot be written is
 * never allowed to break a save.
 */
import type { Game } from '../types';

/** How many historical saves to keep. */
export const BACKUP_LIMIT = 10;
/** Ignore saves that differ only by less than this many bytes from the last
 * backup (identical strings are skipped entirely; this guards against
 * near-identical churn). */
export const BACKUP_MIN_DIFFERENCE = 8;

export interface SaveBackup {
	timestamp: number;
	save: string;
	label?: string;
	isManual?: boolean;
	bakeryName?: string;
	cookies?: number;
	cps?: number;
	prestige?: number;
	buildingsOwned?: number;
	version?: number;
}

export function backupKey(game: Game): string {
	return game.SaveTo + 'Backups';
}

/**
 * Safely parse a raw save string to extract summary metadata without modifying Game state.
 */
export function ExtractSaveSummary(saveData: string): Partial<SaveBackup> {
	if (!saveData || typeof saveData !== 'string') return {};
	try {
		var str = unescape(saveData);
		str = str.split('!END!')[0];
		str = b64_to_utf8(str);
		if (!str) return {};
		var parts = str.split('|');
		var version = parseFloat(parts[0]) || 0;
		var stats = (parts[2] || '').split(';');
		var bakeryName = stats[3] || 'Bakery';
		var cookiesPart = (parts[4] || '').split(';');
		var cookies = parseFloat(cookiesPart[0]) || 0;
		var prestige = parseFloat(cookiesPart[25]) || 0;
		var cps = parseFloat(cookiesPart[51]) || 0;

		var buildingsOwned = 0;
		var buildingsPart = (parts[5] || '').split(';');
		for (var i = 0; i < buildingsPart.length; i++) {
			if (buildingsPart[i]) {
				var bData = buildingsPart[i].split(',');
				buildingsOwned += parseInt(bData[0], 10) || 0;
			}
		}

		return {
			version: version,
			bakeryName: bakeryName,
			cookies: cookies,
			prestige: prestige,
			cps: cps,
			buildingsOwned: buildingsOwned
		};
	} catch (e: any) {
		return {};
	}
}

/**
 * Monotonic per-session clock: Date.now() can return the same millisecond
 * for consecutive saves (the 60s autosave, a manual save, a capture — all
 * in one tick), which would make two backups share a timestamp and break
 * restore-by-timestamp. The wall clock seeds the counter; each capture
 * bumps it, so every entry is strictly ordered even within one millisecond.
 */
export function nextBackupTimestamp(game: Game): number {
	const now = Date.now();
	const last = (game as any).__cc3BackupClock || 0;
	const timestamp = now > last ? now : last + 1;
	(game as any).__cc3BackupClock = timestamp;
	return timestamp;
}

export function readBackups(game: Game): SaveBackup[] {
	const raw = localStorageGet(backupKey(game));
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((entry) => entry && typeof entry.timestamp === 'number' && typeof entry.save === 'string')
			.sort((a, b) => a.timestamp - b.timestamp);
	} catch (e: any) {
		return [];
	}
}

function writeBackups(game: Game, backups: SaveBackup[]): boolean {
	try {
		localStorageSet(backupKey(game), JSON.stringify(backups));
		return true;
	} catch (e: any) {
		return false;
	}
}

/**
 * Record a successful save into the rolling history. Called from
 * systems/save.ts WriteSave right after the main slot is written.
 */
export function CaptureSave(game: Game, saveData: string, label?: string, isManual?: boolean): void {
	if (!saveData || saveData.length < BACKUP_MIN_DIFFERENCE) return;
	const backups = readBackups(game);
	const last = backups[backups.length - 1];
	if (!isManual && last && last.save === saveData) return; // no change since the last backup

	var meta = ExtractSaveSummary(saveData);
	backups.push({
		timestamp: nextBackupTimestamp(game),
		save: saveData,
		label: label || (isManual ? 'Manual Snapshot' : 'Autosave'),
		isManual: !!isManual,
		bakeryName: meta.bakeryName || game.bakeryName,
		cookies: typeof meta.cookies === 'number' ? meta.cookies : game.cookies,
		cps: typeof meta.cps === 'number' ? meta.cps : game.cookiesPsRawHighest,
		prestige: typeof meta.prestige === 'number' ? meta.prestige : game.prestige,
		buildingsOwned: typeof meta.buildingsOwned === 'number' ? meta.buildingsOwned : game.BuildingsOwned,
		version: meta.version || Game.version
	});

	// Keep all manual snapshots, but cap autosaves to BACKUP_LIMIT
	var autosaves = backups.filter((b) => !b.isManual);
	var manuals = backups.filter((b) => b.isManual);
	while (autosaves.length > BACKUP_LIMIT) autosaves.shift();
	var merged = autosaves.concat(manuals).sort((a, b) => a.timestamp - b.timestamp);

	writeBackups(game, merged);
}

/** Create a protected manual snapshot with a custom or default name. */
export function CreateManualSnapshot(game: Game, label?: string): boolean {
	var saveStr = game.WriteSave(1);
	if (!saveStr) return false;
	CaptureSave(game, saveStr, label || 'Manual Snapshot', true);
	return true;
}

/** Delete a specific backup by timestamp. */
export function DeleteBackup(game: Game, timestamp: number): boolean {
	var backups = readBackups(game);
	var next = backups.filter((b) => b.timestamp !== timestamp);
	if (next.length === backups.length) return false;
	writeBackups(game, next);
	return true;
}

/** The current history, newest first (for display). */
export function ListBackups(game: Game): SaveBackup[] {
	return readBackups(game).slice().reverse();
}

/** Human-readable timestamp for the menu (e.g. "08/22 14:33:05"). */
export function FormatBackupTime(timestamp: number): string {
	const date = new Date(timestamp);
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Restore the game to a saved backup. The backup is imported through the same
 * ImportSaveCode path a pasted export uses, then written back to the main
 * save slot (which also records a fresh backup of the restored state).
 */
export function RestoreBackup(game: Game, timestamp: number): boolean {
	if (!Number.isFinite(timestamp)) return false;
	const backups = readBackups(game);
	const backup = backups.find((entry) => entry.timestamp === timestamp);
	if (!backup || !backup.save) return false;
	const ok = game.ImportSaveCode(backup.save);
	if (ok) game.WriteSave();
	return ok;
}

/** A file-safe name for a backup download, e.g. `MyBakeryBackup-0822-1433.txt`. */
export function BackupFileName(game: Game, timestamp: number): string {
	const date = new Date(timestamp);
	const pad = (value: number) => String(value).padStart(2, '0');
	const name = game.bakeryName.replace(/[^a-zA-Z0-9]+/g, '');
	return name + 'Backup-' + pad(date.getMonth() + 1) + pad(date.getDate()) + '-' + pad(date.getHours()) + pad(date.getMinutes()) + '.txt';
}

/**
 * Download a backup as a .txt save file — the same format the "Save to
 * file" button produces, so the file imports like any other export. Mirrors
 * FileSave's App guard (embedded hosts handle downloads themselves).
 */
export function DownloadBackup(game: Game, timestamp: number): boolean {
	if (App) return false;
	if (!Number.isFinite(timestamp)) return false;
	const backups = readBackups(game);
	const backup = backups.find((entry) => entry.timestamp === timestamp);
	if (!backup || !backup.save) return false;
	const blob = new Blob([backup.save], { type: 'text/plain;charset=utf-8' });
	saveAs(blob, BackupFileName(game, timestamp));
	return true;
}

/**
 * Analyze an imported legacy or CC2 save string and return diagnosis info.
 */
export function AnalyzeLegacySave(saveData: string): {
	valid: boolean;
	version: number;
	legacyType: string;
	bakeryName: string;
	cookies: number;
	prestige: number;
	buildings: number;
	notes: string[];
	cleanedSave: string;
} {
	var notes: string[] = [];
	if (!saveData || typeof saveData !== 'string') {
		return { valid: false, version: 0, legacyType: 'None', bakeryName: '', cookies: 0, prestige: 0, buildings: 0, notes: ['No save data provided'], cleanedSave: '' };
	}

	var trimmed = saveData.trim();
	var unescaped = unescape(trimmed);
	if (unescaped.indexOf('%') !== -1) {
		try { unescaped = decodeURIComponent(unescaped); } catch(e) {}
	}
	var raw = unescaped.split('!END!')[0];

	// Check if base64 encoded
	var decoded = '';
	try {
		decoded = b64_to_utf8(raw);
	} catch (e) {
		decoded = '';
	}

	// Classic CC 1.x or non-base64 check
	if (!decoded || decoded.indexOf('|') === -1) {
		if (raw.indexOf('|') !== -1) {
			// Might be already uncompressed CC2 string
			decoded = raw;
			notes.push('Detected unencoded save text format.');
		} else {
			return {
				valid: false,
				version: 0,
				legacyType: 'Unknown / Ancient',
				bakeryName: '',
				cookies: 0,
				prestige: 0,
				buildings: 0,
				notes: ['Could not decode save string. It may be an ancient Cookie Clicker classic 0.12 save or corrupted text.'],
				cleanedSave: ''
			};
		}
	}

	var parts = decoded.split('|');
	var version = parseFloat(parts[0]) || 0;
	if (isNaN(version) || parts.length < 5) {
		return {
			valid: false,
			version: version,
			legacyType: 'Invalid structure',
			bakeryName: '',
			cookies: 0,
			prestige: 0,
			buildings: 0,
			notes: ['Save string does not contain the minimum required data sections.'],
			cleanedSave: ''
		};
	}

	var legacyType = 'Cookie Clicker 2.x standard';
	if (version < 1.0) {
		legacyType = 'Cookie Clicker Classic (<1.0)';
		notes.push('Classic saves (<1.0) cannot be imported directly into modern engines without manual progression reconstruction.');
	} else if (version < 2.0) {
		legacyType = 'Cookie Clicker 1.x Legacy';
		notes.push('v1.x legacy save detected. Upgrades and prestige formulas will be automatically adapted.');
	} else if (version <= 2.048) {
		legacyType = 'Cookie Clicker 2.048 (Upstream)';
		notes.push('100% compatible with Cookie Clicker 3 engine.');
	} else if (version > Game.version) {
		legacyType = 'Future version (v.' + version + ')';
		notes.push('Save appears to be from a newer or modded version.');
	}

	var stats = (parts[2] || '').split(';');
	var bakeryName = stats[3] || 'Bakery';
	var cookiesPart = (parts[4] || '').split(';');
	var cookies = parseFloat(cookiesPart[0]) || 0;
	var prestige = parseFloat(cookiesPart[25]) || 0;

	var buildings = 0;
	var buildingsPart = (parts[5] || '').split(';');
	for (var i = 0; i < buildingsPart.length; i++) {
		if (buildingsPart[i]) {
			var bData = buildingsPart[i].split(',');
			buildings += parseInt(bData[0], 10) || 0;
		}
	}

	// Check for corrupted NaN or Infinity values
	if (isNaN(cookies) || !isFinite(cookies)) {
		notes.push('Warning: Cookie ledger contains corrupted non-finite numbers (NaN/Infinity). CC3 clamp repair will heal this.');
	}

	return {
		valid: version >= 1.0,
		version: version,
		legacyType: legacyType,
		bakeryName: bakeryName,
		cookies: cookies,
		prestige: prestige,
		buildings: buildings,
		notes: notes,
		cleanedSave: trimmed
	};
}

/** Open the dedicated Backup & Legacy Save Manager modal dialog. */
export function OpenBackupManager(game: Game, defaultTab?: 'backups' | 'legacy'): void {
	var activeTab = defaultTab === 'legacy' ? 'legacy' : 'backups';

	var buildContent = function(): string {
		var backups = ListBackups(game);
		var str = '<id BackupManager><div style="width:100%;box-sizing:border-box;text-align:left;font-size:12px;">';
		
		// Header Tabs
		str += '<div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.2);margin-bottom:14px;gap:8px;">';
		str += '<a id="bmTabBackups" class="option smallFancyButton" style="width:auto;text-align:center;padding:6px 14px;font-size:12px;' + (activeTab === 'backups' ? 'color:#ffd700;font-weight:bold;border-color:#ffd700;' : '') + '" onclick="Game.__bmSwitchTab(\'backups\');PlaySound(\'snd/tick.mp3\');">Snapshots & Backups (' + backups.length + ')</a>';
		str += '<a id="bmTabLegacy" class="option smallFancyButton" style="width:auto;text-align:center;padding:6px 14px;font-size:12px;' + (activeTab === 'legacy' ? 'color:#ffd700;font-weight:bold;border-color:#ffd700;' : '') + '" onclick="Game.__bmSwitchTab(\'legacy\');PlaySound(\'snd/tick.mp3\');">Legacy / CC2 Save Loader</a>';
		str += '</div>';

		if (activeTab === 'backups') {
			str += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
			str += '<div style="color:rgba(255,255,255,0.7);font-size:11px;">Keep track of autosaves, restore previous states, or create protected snapshots before major decisions.</div>';
			str += '<a class="option smallFancyButton" style="width:auto;text-align:center;font-weight:bold;color:#73f21e;border-color:#73f21e;padding:4px 10px;white-space:nowrap;" onclick="Game.__bmCreateSnapshot();PlaySound(\'snd/tick.mp3\');">+ Take Snapshot</a>';
			str += '</div>';

			if (backups.length === 0) {
				str += '<div style="padding:30px 10px;text-align:center;color:rgba(255,255,255,0.5);">No backups saved yet. Backups are automatically recorded on every save.</div>';
			} else {
				str += '<div style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px;">';
				for (var i = 0; i < backups.length; i++) {
					var b = backups[i];
					var isManual = !!b.isManual;
					var badgeColor = isManual ? '#73f21e' : '#4bb8f0';
					var badgeText = isManual ? (b.label || 'Snapshot') : 'Autosave';
					var cookiesFmt = typeof b.cookies === 'number' ? Beautify(b.cookies) : '-';
					var cpsFmt = typeof b.cps === 'number' ? Beautify(b.cps) : '-';
					var prestFmt = typeof b.prestige === 'number' ? Beautify(b.prestige) : '-';
					var bldFmt = typeof b.buildingsOwned === 'number' ? Beautify(b.buildingsOwned) : '-';

					str += '<div style="background:rgba(0,0,0,0.5);border:1px solid ' + (isManual ? 'rgba(115,242,30,0.4)' : 'rgba(255,255,255,0.15)') + ';border-radius:4px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;gap:12px;">';
					str += '<div style="flex:1;min-width:0;">';
					str += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">';
					str += '<span style="font-size:9px;font-weight:bold;color:' + badgeColor + ';border:1px solid ' + badgeColor + ';padding:1px 5px;border-radius:3px;">' + badgeText + '</span>';
					str += '<span style="font-weight:bold;color:#fff;font-size:12px;">' + (b.bakeryName || game.bakeryName) + '</span>';
					str += '<span style="color:rgba(255,255,255,0.5);font-size:10px;">' + FormatBackupTime(b.timestamp) + '</span>';
					str += '</div>';
					str += '<div style="font-size:10px;color:rgba(255,255,255,0.7);display:flex;gap:14px;flex-wrap:wrap;">';
					str += '<span>Cookies: <b style="color:#f2d58a;">' + cookiesFmt + '</b></span>';
					str += '<span>Raw CpS: <b style="color:#fff;">' + cpsFmt + '</b></span>';
					str += '<span>Prestige: <b style="color:#73f21e;">' + prestFmt + '</b></span>';
					str += '<span>Buildings: <b style="color:#fff;">' + bldFmt + '</b></span>';
					str += '</div>';
					str += '</div>';

					// Action buttons
					str += '<div style="display:flex;gap:6px;flex-shrink:0;">';
					str += '<a class="option smallFancyButton" style="width:auto;text-align:center;padding:4px 10px;font-size:10px;" onclick="Game.__bmRestore(' + b.timestamp + ');PlaySound(\'snd/tick.mp3\');">Restore</a>';
					str += '<a class="option smallFancyButton" style="width:auto;text-align:center;padding:4px 10px;font-size:10px;" onclick="Game.DownloadBackup(' + b.timestamp + ');PlaySound(\'snd/tick.mp3\');">Export</a>';
					str += '<a class="option smallFancyButton warning" style="width:20px;text-align:center;padding:4px 0;font-size:11px;color:#f21e3c;" onclick="Game.__bmDelete(' + b.timestamp + ');PlaySound(\'snd/tick.mp3\');">&times;</a>';
					str += '</div>';
					str += '</div>';
				}
				str += '</div>';
			}
		} else {
			// Legacy Save Loader Tab
			str += '<div style="color:rgba(255,255,255,0.7);font-size:11px;margin-bottom:10px;">Import, diagnose, and safely load saves from upstream Cookie Clicker 2.048, earlier v2.x versions, or legacy text formats.</div>';
			str += '<div style="margin-bottom:8px;"><textarea id="bmLegacyInput" style="width:100%;height:90px;font-size:10px;box-sizing:border-box;background:#111;color:#eee;border:1px solid #444;padding:6px;border-radius:4px;" placeholder="Paste legacy or Cookie Clicker 2 save text here..."></textarea></div>';
			str += '<div style="display:flex;gap:8px;margin-bottom:12px;">';
			str += '<a class="option smallFancyButton" style="width:auto;text-align:center;padding:4px 12px;font-size:11px;" onclick="Game.__bmInspectLegacy();PlaySound(\'snd/tick.mp3\');">Inspect Save</a>';
			str += '<a class="option smallFancyButton" style="width:auto;text-align:center;padding:4px 12px;font-size:11px;position:relative;">Load from File<input id="bmLegacyFileInput" type="file" style="cursor:pointer;opacity:0;position:absolute;left:0;top:0;width:100%;height:100%;" onchange="Game.__bmLoadLegacyFile(event);" /></a>';
			str += '</div>';
			str += '<div id="bmLegacyReport" style="background:#111;border:1px solid #333;border-radius:4px;padding:10px;min-height:90px;font-size:11px;color:rgba(255,255,255,0.8);">';
			str += '<div style="color:rgba(255,255,255,0.4);text-align:center;padding:24px 0;">Paste a save code and click "Inspect Save" to preview its contents and verify compatibility before loading.</div>';
			str += '</div>';
		}

		str += '</div>';
		return str;
	};

	// Attach temporary helper methods to Game for modal interaction
	(game as any).__bmSwitchTab = function(tab: 'backups' | 'legacy') {
		activeTab = tab;
		var contentL = l('promptContentBackupManager');
		if (contentL) {
			contentL.innerHTML = buildContent();
			game.UpdatePrompt();
		}
	};

	(game as any).__bmCreateSnapshot = function() {
		var name = prompt('Enter a label for this snapshot (e.g. "Before Ascension", "Minigame Test"):', 'Manual Snapshot');
		if (name !== null) {
			CreateManualSnapshot(game, name.trim() || 'Manual Snapshot');
			var contentL = l('promptContentBackupManager');
			if (contentL) {
				contentL.innerHTML = buildContent();
				game.UpdatePrompt();
			}
			game.Notify('Snapshot Created', 'Saved snapshot: ' + (name.trim() || 'Manual Snapshot'), [1, 33]);
		}
	};

	(game as any).__bmRestore = function(timestamp: number) {
		if (confirm('Are you sure you want to restore this save? Your current active game state will be replaced (an autosave of the current state will be kept).')) {
			var ok = RestoreBackup(game, timestamp);
			if (ok) {
				game.ClosePrompt();
				game.Notify('Backup Restored', 'Game successfully restored to backup.', [1, 33]);
			} else {
				alert('Failed to restore backup. Save data may be incompatible.');
			}
		}
	};

	(game as any).__bmDelete = function(timestamp: number) {
		if (confirm('Delete this backup entry?')) {
			DeleteBackup(game, timestamp);
			var contentL = l('promptContentBackupManager');
			if (contentL) {
				contentL.innerHTML = buildContent();
				game.UpdatePrompt();
			}
		}
	};

	(game as any).__bmInspectLegacy = function() {
		var input = l('bmLegacyInput') as HTMLTextAreaElement;
		var reportL = l('bmLegacyReport');
		if (!input || !reportL) return;
		var text = input.value.trim();
		if (!text) {
			reportL.innerHTML = '<span style="color:#f21e3c;">Please paste a save code first.</span>';
			return;
		}

		var rep = AnalyzeLegacySave(text);
		var rStr = '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">';
		rStr += '<div>';
		rStr += '<div style="font-size:13px;font-weight:bold;color:#ffd700;">' + rep.legacyType + ' (v.' + rep.version + ')</div>';
		rStr += '<div style="font-size:11px;color:#fff;">Bakery: <b>' + rep.bakeryName + '</b></div>';
		rStr += '</div>';
		if (rep.valid) {
			rStr += '<a class="option smallFancyButton" style="padding:6px 14px;color:#73f21e;border-color:#73f21e;font-weight:bold;" onclick="Game.__bmApplyLegacy();PlaySound(\'snd/tick.mp3\');">Migrate & Load Save</a>';
		}
		rStr += '</div>';

		rStr += '<div style="display:flex;gap:16px;background:rgba(255,255,255,0.05);padding:6px 10px;border-radius:4px;margin-bottom:8px;font-size:10px;">';
		rStr += '<span>Cookies: <b style="color:#f2d58a;">' + Beautify(rep.cookies) + '</b></span>';
		rStr += '<span>Prestige: <b style="color:#73f21e;">' + Beautify(rep.prestige) + '</b></span>';
		rStr += '<span>Buildings: <b style="color:#fff;">' + Beautify(rep.buildings) + '</b></span>';
		rStr += '</div>';

		if (rep.notes.length > 0) {
			rStr += '<div style="font-size:10px;color:rgba(255,255,255,0.7);line-height:1.4;">';
			for (var n = 0; n < rep.notes.length; n++) {
				rStr += '<div>&bull; ' + rep.notes[n] + '</div>';
			}
			rStr += '</div>';
		}

		(game as any).__bmPendingLegacy = rep.cleanedSave;
		reportL.innerHTML = rStr;
		game.UpdatePrompt();
	};

	(game as any).__bmApplyLegacy = function() {
		var code = (game as any).__bmPendingLegacy;
		if (!code) return;
		if (confirm('Load this legacy save into Cookie Clicker 3? Current unsaved state will be backed up.')) {
			// Create a snapshot before applying
			CreateManualSnapshot(game, 'Pre-Legacy Import Snapshot');
			var ok = game.ImportSaveCode(code);
			if (ok) {
				game.WriteSave();
				game.ClosePrompt();
				game.Notify('Legacy Save Loaded', 'Welcome back! Your legacy save was successfully migrated to CC3.', [1, 33]);
			} else {
				alert('Error loading legacy save string.');
			}
		}
	};

	(game as any).__bmLoadLegacyFile = function(e: any) {
		if (e.target.files.length === 0) return;
		var file = e.target.files[0];
		var reader = new FileReader();
		reader.onload = function(evt: any) {
			var input = l('bmLegacyInput') as HTMLTextAreaElement;
			if (input && evt.target.result) {
				input.value = evt.target.result;
				(game as any).__bmInspectLegacy();
			}
		};
		reader.readAsText(file);
	};

	game.Prompt(buildContent(), [loc("Close")], 0, 'backupPrompt');
}

/** The Options-menu markup for the backup entry point. */
export function BackupListHtml(game: Game): string {
	const backups = ListBackups(game);
	const latest = backups[0];
	const latestFmt = latest ? FormatBackupTime(latest.timestamp) : 'None';
	
	return (
		'<div class="listing">' +
		'<a class="option smallFancyButton" onclick="Game.OpenBackupManager(\'backups\');PlaySound(\'snd/tick.mp3\');">' + loc("Manage backups & snapshots") + '</a>' +
		'<a class="option smallFancyButton" onclick="Game.OpenBackupManager(\'legacy\');PlaySound(\'snd/tick.mp3\');">' + loc("Import legacy / CC2 save") + '</a>' +
		'<label>' + loc("Backups stored: %1 (latest: %2)", [String(backups.length), latestFmt]) + '</label>' +
		'</div>'
	);
}

/** Rebuild the backups listing inside the Options menu (called on menu draw). */
export function RefreshBackupList(game: Game): void {
	const target = l('backupList');
	if (!target) return;
	target.innerHTML = BackupListHtml(game);
}
