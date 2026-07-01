const { test, expect } = require('@playwright/test');

const URL = 'http://localhost:8769/demo/';

test('full navigation test', async ({ page }) => {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Check initial focusedKey
  const fk1 = await page.evaluate(() => document.getElementById('main-grid')._x_dataStack[0].focusedKey);
  expect(fk1).toBe('0:0');

  // 2. Navigate via evaluate -> focusCell
  await page.evaluate(() => {
    const data = document.getElementById('main-grid')._x_dataStack[0];
    data.focusCell(0, 0, false);
  });
  await page.waitForTimeout(200);
  const fk2 = await page.evaluate(() => document.getElementById('main-grid')._x_dataStack[0].focusedKey);
  expect(fk2).toBe('0:0');

  // 3. Check that hs-focused class is applied to cell (0,0)
  const hasFocus1 = await page.locator('[data-row="0"][data-col="0"].hs-focused').count();
  expect(hasFocus1).toBe(1);

  // 4. Navigate via keyboard
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  const fk3 = await page.evaluate(() => document.getElementById('main-grid')._x_dataStack[0].focusedKey);
  expect(fk3).toBe('0:1');

  // 5. Check hs-focused on new cell
  const hasFocus2 = await page.locator('[data-row="0"][data-col="1"].hs-focused').count();
  expect(hasFocus2).toBe(1);

  // 6. Old cell should NOT have hs-focused
  const hasFocus3 = await page.locator('[data-row="0"][data-col="0"].hs-focused').count();
  expect(hasFocus3).toBe(0);
});
