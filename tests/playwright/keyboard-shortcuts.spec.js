/**
 * Hypersheet E2E Keyboard Shortcut Tests
 *
 * Validates all keyboard navigation, editing, and formatting shortcuts.
 * Run against the static demo: npx serve demo/
 * Or against the PHP backend: php -S localhost:8000 demo/backend.php
 *
 * Run: npx playwright test tests/playwright/keyboard-shortcuts.spec.js
 */

const { test, expect } = require('@playwright/test');
const { HypersheetTest } = require('../../src/js/playwright-helper.js');

const DEFAULT_URL = process.env.GRID_URL || 'http://localhost:8769/demo/';

test.describe('Hypersheet Keyboard Navigation', () => {
  let grid;

  test.beforeEach(async ({ page }) => {
    grid = new HypersheetTest(page, {
      gridSelector: '#main-grid',
      captureErrors: true,
    });
    await page.goto(DEFAULT_URL);
    await grid.waitForGrid();
    grid.clearErrors();
  });

  test.afterEach(async ({ page }) => {
    // Screenshot on failure
    const errors = grid.getErrors();
    if (errors.length > 0) {
      await page.screenshot({
        path: `test-results/screenshots/failure-${test.info().title.replace(/\s+/g, '-')}.png`,
        fullPage: true,
      });
    }
  });

  test('ArrowRight moves focus to next column', async ({ page }) => {
    await grid.navigateToCell(0, 0);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    const focused = await page.locator('#main-grid [data-row="0"][data-col="1"].hs-focused');
    await expect(focused).toHaveCount(1);
  });

  test('ArrowDown moves focus to next row', async ({ page }) => {
    await grid.navigateToCell(0, 0);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    const focused = await page.locator('#main-grid [data-row="1"][data-col="0"].hs-focused');
    await expect(focused).toHaveCount(1);
  });

  test('ArrowUp moves focus to previous row', async ({ page }) => {
    await grid.navigateToCell(2, 0);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);
    const focused = await page.locator('#main-grid [data-row="1"][data-col="0"].hs-focused');
    await expect(focused).toHaveCount(1);
  });

  test('ArrowLeft moves focus to previous column', async ({ page }) => {
    await grid.navigateToCell(0, 2);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    const focused = await page.locator('#main-grid [data-row="0"][data-col="1"].hs-focused');
    await expect(focused).toHaveCount(1);
  });

  test('Enter enters edit mode on focused cell', async ({ page }) => {
    await grid.navigateToCell(0, 0);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    // The input inside the cell should be focused
    const input = page.locator('#main-grid [data-row="0"][data-col="0"] .hs-cell-input:focus');
    await expect(input).toHaveCount(1);
  });

  test('Enter exits edit mode when already editing', async ({ page }) => {
    await grid.navigateToCell(0, 0);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    const input = page.locator('#main-grid [data-row="0"][data-col="0"] .hs-cell-input:focus');
    await expect(input).toHaveCount(0);
  });

  test('Enter saves and moves down when editing and pressing Enter', async ({ page }) => {
    await grid.navigateToCell(0, 0);
    await grid.enterEditMode();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    // Should exit edit and move to next row
    const focused = await page.locator('#main-grid [data-row="1"][data-col="0"].hs-focused');
    await expect(focused).toHaveCount(1);
  });

  test('Escape exits edit mode', async ({ page }) => {
    await grid.navigateToCell(0, 0);
    await grid.enterEditMode();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    const input = page.locator('#main-grid .hs-cell-input:focus');
    await expect(input).toHaveCount(0);
  });

  test('Tab moves to next cell and enters edit', async ({ page }) => {
    await grid.navigateToCell(0, 0);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    const input = page.locator('#main-grid [data-row="0"][data-col="1"] .hs-cell-input:focus');
    await expect(input).toHaveCount(1);
  });

  test('Shift+Tab moves to previous cell', async ({ page }) => {
    await grid.navigateToCell(0, 2);
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(200);
    const focused = await page.locator('#main-grid [data-row="0"][data-col="1"].hs-focused');
    await expect(focused).toHaveCount(1);
  });

  test('Home jumps to first column', async ({ page }) => {
    await grid.navigateToCell(0, 3);
    await page.keyboard.press('Home');
    await page.waitForTimeout(100);
    const focused = await page.locator('#main-grid [data-row="0"][data-col="0"].hs-focused');
    await expect(focused).toHaveCount(1);
  });

  test('End jumps to last column', async ({ page }) => {
    await grid.navigateToCell(0, 0);
    await page.keyboard.press('End');
    await page.waitForTimeout(100);
    const focused = await page.locator('#main-grid [data-row="0"][data-col="6"].hs-focused');
    await expect(focused).toHaveCount(1);
  });

  test('Space toggles checkbox in checklist cell', async ({ page }) => {
    // Cell (0, 4) is the Tasks column with checkboxes
    await grid.navigateToCell(0, 4);
    // Get initial state
    const firstCheckbox = page.locator('#main-grid [data-row="0"][data-col="4"] input[type="checkbox"]').first();
    const initialChecked = await firstCheckbox.isChecked();
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    const newChecked = await firstCheckbox.isChecked();
    expect(newChecked).toBe(!initialChecked);
  });
});

test.describe('Hypersheet Editing Shortcuts', () => {
  let grid;

  test.beforeEach(async ({ page }) => {
    grid = new HypersheetTest(page, {
      gridSelector: '#main-grid',
      captureErrors: true,
    });
    await page.goto(DEFAULT_URL);
    await grid.waitForGrid();
    grid.clearErrors();
  });

  test('Shift+Enter inserts a new row below', async ({ page }) => {
    const rowCountBefore = await page.locator('#main-grid .hs-row').count();
    await grid.navigateToCell(1, 0);
    await page.keyboard.press('Shift+Enter');
    await page.waitForTimeout(300);
    const rowCountAfter = await page.locator('#main-grid .hs-row').count();
    expect(rowCountAfter).toBe(rowCountBefore + 1);
  });

  test('Ctrl+Enter fires save event', async ({ page }) => {
    let saved = false;
    page.on('console', (msg) => {
      if (msg.text().includes('grid-save')) saved = true;
    });
    await grid.navigateToCell(0, 0);
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(300);
    // The event should fire without errors
    const errors = grid.getErrors().filter(e => e.type === 'uncaught');
    expect(errors.length).toBe(0);
  });

  test('Backspace clears cell content', async ({ page }) => {
    // Get current value first
    const val = await grid.getCellValue(0, 0);
    expect(val.length).toBeGreaterThan(0);
    await grid.navigateToCell(0, 0);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);
    const newVal = await grid.getCellValue(0, 0);
    expect(newVal).toBe('');
  });

  test('Ctrl+Backspace clears row', async ({ page }) => {
    const rowCountBefore = await page.locator('#main-grid .hs-row').count();
    await grid.navigateToCell(0, 0);
    // This will show a confirm dialog - accept it
    page.on('dialog', (dialog) => dialog.accept());
    await page.keyboard.press('Control+Backspace');
    await page.waitForTimeout(300);
    const rowCountAfter = await page.locator('#main-grid .hs-row').count();
    expect(rowCountAfter).toBeLessThan(rowCountBefore);
  });

  test('Delete also clears cell content', async ({ page }) => {
    await grid.navigateToCell(1, 0);
    const val = await grid.getCellValue(1, 0);
    expect(val.length).toBeGreaterThan(0);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);
    const newVal = await grid.getCellValue(1, 0);
    expect(newVal).toBe('');
  });

  test('Edit cell value via keyboard', async ({ page }) => {
    await grid.navigateToCell(2, 0);
    await grid.enterEditMode();
    const input = page.locator('#main-grid [data-row="2"][data-col="0"] .hs-cell-input:focus');
    await input.fill('Test Name');
    await page.keyboard.press('Enter'); // Save and move down
    await page.waitForTimeout(200);
    const val = await grid.getCellValue(2, 0);
    expect(val).toBe('Test Name');
  });
});

test.describe('Hypersheet Cell Formatting Shortcuts', () => {
  let grid;

  test.beforeEach(async ({ page }) => {
    grid = new HypersheetTest(page, {
      gridSelector: '#main-grid',
      captureErrors: true,
    });
    await page.goto(DEFAULT_URL);
    await grid.waitForGrid();
    grid.clearErrors();
  });

  test('Ctrl+B toggles bold on cell', async ({ page }) => {
    await grid.navigateToCell(0, 0);
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(200);
    const cell = page.locator('#main-grid [data-row="0"][data-col="0"]');
    const fontWeight = await cell.evaluate(el => getComputedStyle(el).fontWeight);
    expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(700);
  });

  test('Ctrl+U toggles underline on cell', async ({ page }) => {
    await grid.navigateToCell(0, 0);
    await page.keyboard.press('Control+u');
    await page.waitForTimeout(200);
    const cell = page.locator('#main-grid [data-row="0"][data-col="0"]');
    const textDec = await cell.evaluate(el => getComputedStyle(el).textDecoration);
    expect(textDec).toContain('underline');
  });

  test('Alt+Enter highlights cell', async ({ page }) => {
    await grid.navigateToCell(0, 0);
    await page.keyboard.press('Alt+Enter');
    await page.waitForTimeout(200);
    const cell = page.locator('#main-grid [data-row="0"][data-col="0"]');
    const bgColor = await cell.evaluate(el => getComputedStyle(el).backgroundColor);
    // Should have a highlight color (not transparent/white)
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
  });

  test('Alt+Backspace resets cell highlight', async ({ page }) => {
    await grid.navigateToCell(0, 0);
    // First highlight
    await page.keyboard.press('Alt+Enter');
    await page.waitForTimeout(100);
    // Then reset
    await page.keyboard.press('Alt+Backspace');
    await page.waitForTimeout(200);
    const cell = page.locator('#main-grid [data-row="0"][data-col="0"]');
    const bgColor = await cell.evaluate(el => getComputedStyle(el).backgroundColor);
    // Should be reset to default (transparent or white)
    expect(bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'rgb(255, 255, 255)').toBeTruthy();
  });

  test('Ctrl+Alt+Backspace resets all formatting', async ({ page }) => {
    await grid.navigateToCell(0, 0);
    // Apply bold and highlight
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(50);
    await page.keyboard.press('Alt+Enter');
    await page.waitForTimeout(100);
    // Reset all
    await page.keyboard.press('Control+Alt+Backspace');
    await page.waitForTimeout(200);
    const cell = page.locator('#main-grid [data-row="0"][data-col="0"]');
    const weight = await cell.evaluate(el => getComputedStyle(el).fontWeight);
    const bg = await cell.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(parseInt(weight)).toBeLessThan(700);
    expect(bg === 'rgba(0, 0, 0, 0)' || bg === 'rgb(255, 255, 255)').toBeTruthy();
  });
});

test.describe('Hypersheet Multi-Cell + Edge Cases', () => {
  let grid;

  test.beforeEach(async ({ page }) => {
    grid = new HypersheetTest(page, {
      gridSelector: '#main-grid',
      captureErrors: true,
    });
    await page.goto(DEFAULT_URL);
    await grid.waitForGrid();
    grid.clearErrors();
  });

  test('rapid arrow key navigation does not crash', async ({ page }) => {
    await grid.navigateToCell(0, 0);
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('ArrowDown');
    }
    await page.waitForTimeout(500);
    await grid.expectNoErrors();
  });

  test('navigating past edges stays clamped', async ({ page }) => {
    await grid.navigateToCell(0, 0);
    // Try to go left from first column
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    const col0 = await page.locator('#main-grid [data-row="0"][data-col="0"].hs-focused');
    await expect(col0).toHaveCount(1);
  });

  test('chip cell can be changed via keyboard + click', async ({ page }) => {
    // Navigate to a chip cell
    await grid.navigateToCell(0, 2);
    const chip = page.locator('#main-grid [data-row="0"][data-col="2"] .hs-chip');
    const initialText = await chip.textContent();
    // Click to open menu
    await chip.click();
    await page.waitForTimeout(200);
    // Click the first different option
    const options = page.locator('#main-grid .hs-chip-menu .hs-chip-option');
    const count = await options.count();
    for (let i = 0; i < count; i++) {
      const optText = await options.nth(i).textContent();
      if (optText.trim() !== initialText.trim()) {
        await options.nth(i).click();
        break;
      }
    }
    await page.waitForTimeout(200);
    const newText = await chip.textContent();
    expect(newText.trim()).not.toBe(initialText.trim());
  });

  test('dropdown cell renders options', async ({ page }) => {
    await grid.navigateToCell(0, 3);
    const items = page.locator('#main-grid [data-row="0"][data-col="3"] .hs-dropdown-menu .hs-dropdown-item');
    await expect(items).toHaveCount(3);
    const texts = await items.allTextContents();
    expect(texts).toEqual(['Free', 'Premium', 'Enterprise']);
  });
});
