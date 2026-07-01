const { test, expect } = require('@playwright/test');
const { HyperGridTest } = require('../../src/js/playwright-helper.js');

test.describe('Error Resilience', () => {

  test('grid renders with missing data gracefully', async ({ page }) => {
    const grid = new HyperGridTest(page);
    await page.route('**/api/grid/**', (route) => route.abort('connectionrefused'));
    await page.goto('/?user=alice');
    await page.waitForLoadState('networkidle');
    const errors = grid.getErrors();
    const critical = errors.filter(e => e.type === 'uncaught');
    expect(critical.length).toBe(0);
  });

  test('invalid cell input does not break grid', async ({ page }) => {
    const grid = new HyperGridTest(page);
    await page.goto('/?user=alice');
    await grid.waitForGrid();
    await grid.setCellText(0, 0, 'A'.repeat(10000));
    await grid.navigateToCell(1, 0);
    const cell2 = await page.locator('[data-row="1"][data-col="0"].hg-focused');
    await expect(cell2).toHaveCount(1);
    await grid.expectNoErrors();
  });

  test('rapid keyboard navigation does not crash', async ({ page }) => {
    const grid = new HyperGridTest(page);
    await page.goto('/?user=alice');
    await grid.waitForGrid();
    for (let i = 0; i < 50; i++) await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 50; i++) await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(500);
    const errors = grid.getErrors();
    const critical = errors.filter(e => e.type === 'uncaught');
    expect(critical.length).toBe(0);
  });
});
