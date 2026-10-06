import { expect, test } from '@playwright/test';

test('ascendNumber dynamically expands with number size on a single line without wrapping', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.goto('/?debug=1', { waitUntil: 'load' });
	const lang = page.locator('#langSelect-English');
	try {
		await lang.waitFor({ state: 'visible', timeout: 5_000 });
		await lang.click();
	} catch {}
	await page.waitForFunction(() => window.Game && window.Game.ready === 1);

	const ascendNum = page.locator('#ascendNumber');

	// 1. Small number
	await page.evaluate(() => {
		const el = document.getElementById('ascendNumber');
		el.textContent = '+1';
		el.style.display = 'block';
		if (window.__cc3Transcendence) window.__cc3Transcendence.updateTopBarWidget();
	});
	await expect(ascendNum).toBeVisible();
	const smallBox = await ascendNum.boundingBox();
	expect(smallBox).not.toBeNull();

	// 2. Exact large scientific number from user screenshot
	const largeNumber = '+9.1,023,438,575,772,94e,+25';
	const rect = await page.evaluate((val) => {
		const el = document.getElementById('ascendNumber');
		el.textContent = val;
		el.style.display = 'block';
		if (window.__cc3Transcendence) window.__cc3Transcendence.updateTopBarWidget();
		const legacy = document.getElementById('legacyButton').getBoundingClientRect();
		const ascend = el.getBoundingClientRect();
		return { legacy, ascend };
	}, largeNumber);

	const largeBox = await ascendNum.boundingBox();
	expect(largeBox).not.toBeNull();

	// The box must be significantly wider than the small number
	expect(largeBox.width).toBeGreaterThan(smallBox.width * 3);

	// The height must NOT increase (i.e. strictly on one line, around 38px including padding, not wrapping to ~55px)
	expect(largeBox.height).toBeLessThanOrEqual(smallBox.height + 2);

	// Verify whiteSpace is nowrap
	const whiteSpace = await page.evaluate(() => {
		const el = document.getElementById('ascendNumber');
		return window.getComputedStyle(el).whiteSpace;
	});
	expect(whiteSpace).toBe('nowrap');

	// Capture screenshot at exact coordinates matching the user's view
	await page.screenshot({
		path: '/home/jabbatheduck/.gemini/antigravity/brain/9f24492c-e623-41b9-827b-4d2aa381386f/ascend_number_exact_preview.png',
		clip: {
			x: Math.max(0, rect.ascend.x - 40),
			y: Math.max(0, rect.legacy.y - 15),
			width: rect.legacy.right - (rect.ascend.x - 40) + 30,
			height: 80
		}
	});

	// 3. Ultra-large number
	const ultraNumber = '+1,234,567,890,123,456,789,012,345,678,901,234';
	await page.evaluate((val) => {
		const el = document.getElementById('ascendNumber');
		el.textContent = val;
		el.style.display = 'block';
		if (window.__cc3Transcendence) window.__cc3Transcendence.updateTopBarWidget();
	}, ultraNumber);

	const ultraBox = await ascendNum.boundingBox();
	expect(ultraBox).not.toBeNull();
	expect(ultraBox.width).toBeGreaterThan(largeBox.width);
	expect(ultraBox.height).toBeLessThanOrEqual(smallBox.height + 2);

	// Verify commentsText does not overlap ascendNumber
	const commentsBox = await page.locator('#commentsText').boundingBox();
	if (commentsBox && ultraBox) {
		expect(commentsBox.x + commentsBox.width).toBeLessThanOrEqual(ultraBox.x + 5);
	}
});
