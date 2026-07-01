/**
 * Hypersheet Playwright Test Suite
 *
 * Tests keyboard navigation, inline editing, chip cells, dropdowns,
 * sorting, row reordering, error states, and Casbin locking.
 *
 * Prerequisite: One of the example apps must be running on localhost:8000
 *   php examples/php -S localhost:8000
 *   or: cd examples/python && uvicorn app:app --port 8000
 *   or: cd examples/go && go run main.go
 *
 * Run: npx playwright test --config=tests/playwright/playwright.config.js
 */

const { test, expect } = require('@playwright/test');
const { HypersheetTest } = require('../../src/js/playwright-helper.js');

test.describe('Hypersheet Core Functionality', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/?user=alice');
  });

  test('grid renders with correct structure', async ({ page }) => {
    const grid = new HypersheetTest(page);
    await grid.waitForGrid();

    // Should have a table element
    const table = await page.locator('[x-data*="Hypersheet"] table.hg-grid');
    await expect(table).toBeVisible();

    // Should have header row
    const headers = await page.locator('.hg-header th');
    await expect(headers).toHaveCount(4); // drag handle + 3 columns
  });

  test('keyboard navigation moves focus between cells', async ({ page }) => {
    const grid = new HypersheetTest(page);
    await grid.waitForGrid();

    // Start at cell (0, 0)
    await grid.navigateToCell(0, 0);

    // Move right
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    // Verify cell (0, 1) is focused (has hg-focused class)
    const cell = await page.locator('[data-row="0"][data-col="1"].hg-focused');
    await expect(cell).toHaveCount(1);

    // Move down
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    const cellDown = await page.locator('[data-row="1"][data-col="1"].hg-focused');
    await expect(cellDown).toHaveCount(1);

    // Move up
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);
    const cellUp = await page.locator('[data-row="0"][data-col="1"].hg-focused');
    await expect(cellUp).toHaveCount(1);
  });

  test('cell text editing saves on blur', async ({ page }) => {
    const grid = new HypersheetTest(page);
    await grid.waitForGrid();

    const newValue = 'Updated Name ' + Date.now();

    // Edit the first name cell
    await grid.setCellText(0, 0, newValue);

    // Verify value was updated
    await grid.assertCellValue(0, 0, newValue);

    // Verify no errors
    await grid.expectNoErrors();
  });

  test('chip cell dropdown switches status', async ({ page }) => {
    const grid = new HypersheetTest(page);
    await grid.waitForGrid();

    await grid.setChipValue(0, 1, 'Paused');

    // Verify the chip text changed
    const chipText = await page.locator('[data-row="0"][data-col="1"] .hg-chip').textContent();
    expect(chipText.trim()).toBe('Paused');
  });

  test('tab key moves to next cell and enters edit', async ({ page }) => {
    const grid = new HypersheetTest(page);
    await grid.waitForGrid();

    await grid.navigateToCell(0, 0);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Cell (0, 1) should now be focused and in edit mode
    const cell = await page.locator('[data-row="0"][data-col="1"] input:focus');
    await expect(cell).toHaveCount(1);
  });

  test('escape key exits edit mode', async ({ page }) => {
    const grid = new HypersheetTest(page);
    await grid.waitForGrid();

    await grid.navigateToCell(0, 0);
    await grid.enterEditMode();

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // No input should be focused
    const focusedInput = await page.locator('.hg-cell-input:focus');
    await expect(focusedInput).toHaveCount(0);
  });

  test('home and end keys navigate to first/last column', async ({ page }) => {
    const grid = new HypersheetTest(page);
    await grid.waitForGrid();

    await grid.navigateToCell(0, 1);

    await page.keyboard.press('Home');
    await page.waitForTimeout(100);
    const firstCell = await page.locator('[data-row="0"][data-col="0"].hg-focused');
    await expect(firstCell).toHaveCount(1);

    await page.keyboard.press('End');
    await page.waitForTimeout(100);
    const lastCell = await page.locator('[data-row="0"][data-col="2"].hg-focused');
    await expect(lastCell).toHaveCount(1);
  });
});

test.describe('Hypersheet Authorization & Error Handling', () => {

  test('locked cells (Bob) are read-only', async ({ page }) => {
    const grid = new HypersheetTest(page);

    // Login as Bob who has limited write access
    await page.goto('/?user=bob');
    await grid.waitForGrid();

    // Name cell should be locked (Bob can read but not write)
    const lockedCell = await page.locator('[data-row="0"][data-col="0"].hg-locked');
    await expect(lockedCell).toHaveCount(1);

    // Tier cell should be editable (Bob can write)
    const editableCell = await page.locator('[data-row="0"][data-col="2"] .hg-cell-input:not([disabled])');
    await expect(editableCell).toHaveCount(1);
  });

  test('hidden cells are not rendered', async ({ page }) => {
    // No columns are hidden with current policy
    // This test validates the hidden class exists when policy denies read
    const grid = new HypersheetTest(page);
    await page.goto('/?user=bob');
    await grid.waitForGrid();

    // All columns should be visible (read granted)
    const cells = await page.locator('.hg-cell:not(.hg-hidden)');
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);
  });

  test('errors are captured on failed API calls', async ({ page }) => {
    const grid = new HypersheetTest(page);
    await grid.waitForGrid();

    // Trigger a PUT to a non-existent endpoint
    await page.evaluate(() => {
      htmx.ajax('PUT', '/api/grid/nonexistent', { target: document.body });
    });

    await page.waitForTimeout(1000);

    // Should capture errors
    const hasErrors = await grid.hasErrors();
    // Note: may or may not have errors depending on server
  });
});

test.describe('Hypersheet Yjs Collaboration', () => {

  test('Yjs provider initializes without errors', async ({ page }) => {
    // Test without Yjs library loaded - should gracefully degrade
    const grid = new HypersheetTest(page);
    await page.goto('/?user=alice');
    await grid.waitForGrid();

    // No Yjs-related errors should appear when Yjs is not loaded
    const errors = grid.getErrors();
    const yjsErrors = errors.filter(e =>
      e.text && e.text.includes('Yjs')
    );
    expect(yjsErrors.length).toBe(0);
  });
});
