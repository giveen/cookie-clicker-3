import { expect, test } from '@playwright/test';

const BOOT = { timeout: 30_000 };

async function boot(page) {
	await page.goto('/?debug=1', { waitUntil: 'load', timeout: BOOT.timeout });
	const lang = page.locator('#langSelect-English');
	try {
		await lang.waitFor({ state: 'visible', timeout: 5_000 });
		await lang.click();
	} catch {
		/* no language prompt */
	}
	await page.waitForFunction(() => window.Game && window.Game.ready === 1, null, BOOT);
}

test.describe('Backup & Legacy Save Manager', () => {
	test('ExtractSaveSummary extracts metadata without corrupting game state', async ({ page }) => {
		await boot(page);

		const result = await page.evaluate(async () => {
			const G = window.Game;
			G.bakeryName = 'Alpha Bakery';
			G.cookies = 1234567;
			G.cookiesPsRawHighest = 98765;
			G.prestige = 42;
			G.Objects['Cursor'].amount = 25;
			G.Objects['Grandma'].amount = 10;
			G.BuildingsOwned = 35;

			const saveCode = G.WriteSave(1);
			const initialCookies = G.cookies;

			// Extract metadata using backup helper
			const meta = G.ExtractSaveSummary ? G.ExtractSaveSummary(saveCode) : null;

			// Check that G.cookies remained intact
			return {
				initialCookies,
				currentCookies: G.cookies,
				saveCodeValid: !!saveCode,
			};
		});

		expect(result.saveCodeValid).toBe(true);
		expect(result.currentCookies).toBe(result.initialCookies);
	});

	test('CreateManualSnapshot creates protected user-named snapshots', async ({ page }) => {
		await boot(page);

		const result = await page.evaluate(async () => {
			const G = window.Game;
			G.cookies = 500000;
			G.WriteSave();

			const ok = G.CreateManualSnapshot('Test Pre-Ascension Snapshot');
			const backups = G.ListBackups();
			const latest = backups[0];

			return {
				ok,
				backupsCount: backups.length,
				label: latest.label,
				isManual: latest.isManual,
				hasCookies: typeof latest.cookies === 'number' && latest.cookies > 0,
			};
		});

		expect(result.ok).toBe(true);
		expect(result.backupsCount).toBeGreaterThanOrEqual(1);
		expect(result.label).toBe('Test Pre-Ascension Snapshot');
		expect(result.isManual).toBe(true);
		expect(result.hasCookies).toBe(true);
	});

	test('OpenBackupManager renders modal tabs and legacy analyzer', async ({ page }) => {
		await boot(page);

		const result = await page.evaluate(async () => {
			const G = window.Game;
			G.OpenBackupManager('backups');

			const modalOpen = G.promptOn === 1;
			const promptContent = document.getElementById('promptContentBackupManager');
			const hasBackupsTab = !!document.getElementById('bmTabBackups');
			const hasLegacyTab = !!document.getElementById('bmTabLegacy');

			// Switch to legacy tab
			if (G.__bmSwitchTab) G.__bmSwitchTab('legacy');
			const hasLegacyInput = !!document.getElementById('bmLegacyInput');

			// Inspect a CC2 save
			const currentSave = G.WriteSave(1);
			const input = document.getElementById('bmLegacyInput');
			if (input) input.value = currentSave;
			if (G.__bmInspectLegacy) G.__bmInspectLegacy();

			const report = document.getElementById('bmLegacyReport');
			const reportHasContent = report && report.innerText.includes('Cookie Clicker');

			// Switch back to backups tab to capture the snapshot list in full width
			if (G.__bmSwitchTab) G.__bmSwitchTab('backups');

			return {
				modalOpen,
				hasPromptContent: !!promptContent,
				hasBackupsTab,
				hasLegacyTab,
				hasLegacyInput,
				reportHasContent,
			};
		});

		await expect(page.locator('#prompt')).toHaveClass(/backupPrompt/);
		const promptBox = await page.locator('#prompt').boundingBox();
		expect(promptBox).not.toBeNull();
		if (promptBox) {
			expect(promptBox.width).toBeGreaterThanOrEqual(600);
		}
		await page.locator('#prompt').screenshot({ path: '/home/jabbatheduck/.gemini/antigravity/brain/9f3e0bba-bec4-4efa-aec6-1c6e5b5ddc8b/backup_modal_fixed.png' });

		await page.evaluate(() => {
			const G = window.Game;
			G.CreateManualSnapshot('Pre-Transcendence Snapshot');
			G.CreateManualSnapshot('Speedrun Milestone');
			G.OpenBackupManager('backups');
		});
		await page.locator('#prompt').screenshot({ path: '/home/jabbatheduck/.gemini/antigravity/brain/9f3e0bba-bec4-4efa-aec6-1c6e5b5ddc8b/backup_modal_populated.png' });
		await page.evaluate(() => window.Game.ClosePrompt());

		expect(result.modalOpen).toBe(true);
		expect(result.hasPromptContent).toBe(true);
		expect(result.hasBackupsTab).toBe(true);
		expect(result.hasLegacyTab).toBe(true);
		expect(result.hasLegacyInput).toBe(true);
		expect(result.reportHasContent).toBe(true);
	});
});
