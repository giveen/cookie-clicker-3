
import { expect, test } from '@playwright/test';

test('orbital view toggle and alignment', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1');
  const lang = page.locator('#langSelect-English');
  try {
    await lang.waitFor({ state: 'visible', timeout: 4000 });
    await lang.click();
  } catch {}
  await page.waitForFunction(() => window.Game && window.Game.ready === 1);

  // 1. Open Doctrine tree
  await page.evaluate(() => {
    const T = window.__cc3Transcendence;
    T.state.ee = 100;
    T.showDoctrineTree();
  });
  await expect(page.locator('#doctrineFullView.in')).toBeVisible();

  // Verify that old pixel icons on top of planets have been removed
  await expect(page.locator('.doctrine-planet .planet-icon')).toHaveCount(0);

  // Verify Orbital View toggle button in top bar exists and is ON by default
  const toggleBtn = page.locator('#doctrineOrbitalToggleBtn');
  await expect(toggleBtn).toBeVisible();
  await expect(toggleBtn).toHaveText('Orbital View: ON');

  // 2. Click Cascade (planet 3) with toggle ON -> enters orbital view
  await page.click('.doctrine-planet[data-node-id="3"]');
  await expect(page.locator('#doctrineFullView')).toHaveClass(/\borbital-mode\b/);
  await expect(page.locator('#doctrineOrbitalHUD')).toBeVisible();
  await expect(page.locator('#doctrineOrbitalHUD')).toContainText('Cascade');
  await page.waitForTimeout(500);

  // Verify drag in orbital view maintains planet centering (doesn't throw planet off screen)
  const beforeDrag = await page.evaluate(() => {
    const p3 = document.querySelector('.doctrine-planet[data-node-id="3"]');
    return p3.getBoundingClientRect().x;
  });

  await page.mouse.move(700, 350);
  await page.mouse.down();
  await page.mouse.move(600, 350, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const afterDrag = await page.evaluate(() => {
    const p3 = document.querySelector('.doctrine-planet[data-node-id="3"]');
    return p3.getBoundingClientRect().x;
  });
  // Planet should stay centered (within small margin), NOT fly 500+ px away!
  expect(Math.abs(afterDrag - beforeDrag)).toBeLessThan(80);

  // 3. Toggle Orbital View OFF via top bar button
  await toggleBtn.click();
  await expect(toggleBtn).toHaveText('Orbital View: OFF');
  // It should automatically close orbital mode
  await expect(page.locator('#doctrineFullView')).not.toHaveClass(/\borbital-mode\b/);
  await expect(page.locator('#doctrineOrbitalHUD')).toHaveCount(0);

  // 4. Click Cascade (planet 3) with toggle OFF -> opens prompt directly!
  await page.click('.doctrine-planet[data-node-id="3"]');
  await expect(page.locator('#prompt')).toBeVisible();
  await expect(page.locator('#prompt h3')).toContainText('Cascade');
  await page.evaluate(() => window.Game.ClosePrompt());

  // 5. Toggle Orbital View back ON
  await toggleBtn.click();
  await expect(toggleBtn).toHaveText('Orbital View: ON');

  // Close doctrine tree
  await page.evaluate(() => window.__cc3Transcendence.closeDoctrineTree(true));
  await expect(page.locator('#doctrineFullView')).toHaveCount(0);
});
