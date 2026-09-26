import { expect, test } from '@playwright/test';

test('dyson swarm post-transcendence building, store blackout, canvas display, and upgrades', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1');
  const lang = page.locator('#langSelect-English');
  try {
    await lang.waitFor({ state: 'visible', timeout: 4000 });
    await lang.click();
  } catch {}
  await page.waitForFunction(() => window.Game && window.Game.ready === 1);

  // 1. Verify before transcendence: Dyson Swarm is hidden from the store
  const isHiddenBefore = await page.evaluate(() => {
    const ds = window.Game.Objects['Dyson Swarm'];
    if (!ds || !ds.l) return true;
    const style = window.getComputedStyle(ds.l);
    return style.display === 'none' || ds.l.classList.contains('toggledOff');
  });
  expect(isHiddenBefore).toBe(true);

  await page.screenshot({ path: '/home/jabbatheduck/.gemini/antigravity/brain/9f24492c-e623-41b9-827b-4d2aa381386f/dyson_store_before_transcend.png' });

  // 2. Perform or simulate first Transcendence with progress up to Black Hole Inverter
  await page.evaluate(() => {
    const T = window.__cc3Transcendence;
    T.state.transcendences = 1;
    T.state.ee = 50;
    // Set cookiesEarned to BHI basePrice so all previous buildings are unlocked,
    // making Dyson Swarm the next locked building in line (lastLocked = 1)
    const bhi = window.Game.Objects['Black hole inverter'];
    window.Game.cookiesEarned = bhi ? bhi.basePrice : 5.5e23;
    window.Game.cookies = 0;
    // Re-trigger store refresh & draw
    window.Game.storeToRefresh = 1;
    window.Game.drawT = 0;
    window.Game.RefreshStore();
    window.Game.Draw();
  });
  await page.waitForTimeout(300);

  // 3. Verify it now appears below Black Hole Inverter as blacked-out (locked)
  const lockedState = await page.evaluate(() => {
    const ds = window.Game.Objects['Dyson Swarm'];
    const bhi = window.Game.Objects['Black hole inverter'];
    return {
      exists: !!ds,
      id: ds.id,
      storeOrder: ds.storeOrder,
      bhiStoreOrder: bhi ? (bhi.storeOrder ?? bhi.id) : null,
      isLocked: ds.l.classList.contains('locked'),
      hasUnlocked: ds.l.classList.contains('unlocked'),
      title: ds.l.querySelector('.lockedTitle')?.textContent?.trim(),
      display: window.getComputedStyle(ds.l).display,
    };
  });

  expect(lockedState.exists).toBe(true);
  expect(lockedState.storeOrder).toBeGreaterThan(lockedState.bhiStoreOrder);
  expect(lockedState.display).not.toBe('none');
  expect(lockedState.isLocked).toBe(true);
  expect(lockedState.hasUnlocked).toBe(false);
  expect(lockedState.title).toBe('???');

  await page.evaluate(() => {
    window.Game.Objects['Dyson Swarm']?.l?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: '/home/jabbatheduck/.gemini/antigravity/brain/9f24492c-e623-41b9-827b-4d2aa381386f/dyson_store_locked_blackout.png' });

  // 4. Grant cookies to afford Dyson Swarm (>= 1 Octillion = 1e27)
  await page.evaluate(() => {
    window.Game.Earn(2e27);
    window.Game.cookies = 2e27;
    window.Game.storeToRefresh = 1;
    window.Game.drawT = 0;
    window.Game.RefreshStore();
    window.Game.Draw();
  });
  await page.waitForTimeout(300);

  // Verify it unlocks with available store icon and real name
  const unlockedState = await page.evaluate(() => {
    const ds = window.Game.Objects['Dyson Swarm'];
    return {
      isLocked: ds.l.classList.contains('locked'),
      hasUnlocked: ds.l.classList.contains('unlocked'),
      isEnabled: ds.l.classList.contains('enabled'),
      productName: ds.l.querySelector('.productName')?.textContent?.trim(),
    };
  });
  expect(unlockedState.hasUnlocked).toBe(true);
  expect(unlockedState.isEnabled).toBe(true);
  expect(unlockedState.productName).toContain('Dyson Swarm');

  await page.evaluate(() => {
    window.Game.Objects['Dyson Swarm']?.l?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: '/home/jabbatheduck/.gemini/antigravity/brain/9f24492c-e623-41b9-827b-4d2aa381386f/dyson_store_unlocked.png' });

  // 5. Purchase Dyson Swarms and verify canvas drawing
  await page.evaluate(() => {
    const ds = window.Game.Objects['Dyson Swarm'];
    ds.buy(1);
  });
  const amountAfterBuy = await page.evaluate(() => window.Game.Objects['Dyson Swarm'].amount);
  expect(amountAfterBuy).toBe(1);

  // Buy up to 10 to see full canvas sprites
  await page.evaluate(() => {
    window.Game.Earn(1e29);
    window.Game.cookies = 1e29;
    const ds = window.Game.Objects['Dyson Swarm'];
    ds.buy(9);
  });
  const amount10 = await page.evaluate(() => window.Game.Objects['Dyson Swarm'].amount);
  expect(amount10).toBe(10);

  // Wait for canvas draw tick
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/home/jabbatheduck/.gemini/antigravity/brain/9f24492c-e623-41b9-827b-4d2aa381386f/dyson_canvas_display.png' });

  // 6. Verify 10 tiered upgrades exist and unlock
  const upgradeCount = await page.evaluate(() => {
    const ds = window.Game.Objects['Dyson Swarm'];
    return Object.keys(ds.tieredUpgrades).length;
  });
  expect(upgradeCount).toBe(10);

  // Unlock all tiered upgrades
  await page.evaluate(() => {
    const ds = window.Game.Objects['Dyson Swarm'];
    window.Game.UnlockTiered(ds);
  });
  await page.waitForTimeout(300);

  await page.screenshot({ path: '/home/jabbatheduck/.gemini/antigravity/brain/9f24492c-e623-41b9-827b-4d2aa381386f/dyson_upgrades_store.png' });

  // 7. Verify save / load persistence
  const savedMod = await page.evaluate(() => {
    return window.Game.mods['Dyson Swarm'].save();
  });
  expect(savedMod).toContain('1|10|1|');

  // Reset and load
  await page.evaluate((saved) => {
    const ds = window.Game.Objects['Dyson Swarm'];
    ds.amount = 0;
    window.Game.mods['Dyson Swarm'].load(saved);
  }, savedMod);

  const restoredAmount = await page.evaluate(() => window.Game.Objects['Dyson Swarm'].amount);
  expect(restoredAmount).toBe(10);
});
