/**
 * HyperGrid Playwright Error Capturing & Test Helpers
 *
 * OPTIONAL module — import into Playwright tests only when needed.
 * Provides configurable error capturing, screenshot-on-failure,
 * htmx request waiting, keyboard navigation, and cell assertions.
 *
 * Usage:
 *   const { HyperGridTest } = require('../src/js/playwright-helper.js');
 *   const grid = new HyperGridTest(page, { captureErrors: true });
 *   await grid.waitForGrid();
 *   await grid.assertCellValue(0, 0, 'Alice');
 */

const DEFAULTS = {
  /** CSS selector for the grid container */
  gridSelector: '[x-data*="hypergrid"]',
  /** Capture console.error, page errors, and failed API responses */
  captureErrors: true,
  /** Timeout in ms for grid render wait */
  gridTimeout: 5000,
  /** Timeout in ms for htmx request completion */
  htmxTimeout: 3000,
  /** Whether to take screenshots on test failure */
  screenshotOnFailure: true,
  /** Directory for failure screenshots */
  screenshotDir: 'test-results/screenshots',
  /** Enable verbose logging during test execution */
  debug: false,
};

class HyperGridTest {
  constructor(page, options = {}) {
    this.opts = { ...DEFAULTS, ...options };
    this.page = page;
    this.errors = [];

    if (this.opts.captureErrors) {
      this._setupErrorCapture();
    }
  }

  _setupErrorCapture() {
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.errors.push({
          time: new Date().toISOString(),
          type: 'console.error',
          text: msg.text(),
          location: msg.location(),
        });
        if (this.opts.debug) {
          console.log(`[HyperGridTest] Console error: ${msg.text()}`);
        }
      }
    });

    this.page.on('pageerror', (error) => {
      this.errors.push({
        time: new Date().toISOString(),
        type: 'uncaught',
        message: error.message,
        stack: error.stack,
      });
    });

    this.page.on('response', (response) => {
      if (!response.ok() && response.url().includes('/api/grid/')) {
        this.errors.push({
          time: new Date().toISOString(),
          type: 'htmx-error',
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        });
      }
    });
  }

  async waitForGrid() {
    await this.page.waitForSelector(this.opts.gridSelector, {
      timeout: this.opts.gridTimeout,
    });
    await this.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && el._x_dataStack && el._x_dataStack.length > 0;
      },
      this.opts.gridSelector,
      { timeout: this.opts.gridTimeout }
    ).catch(() => {
      // Grid might render without Alpine if it's a static snapshot
    });
  }

  async navigateToCell(row, col) {
    await this.waitForGrid();
    await this.page.evaluate(
      ({ row, col, sel }) => {
        const grid = document.querySelector(sel);
        const data = grid?._x_dataStack?.[0];
        if (data?.focusCell) data.focusCell(row, col, false);
      },
      { row, col, sel: this.opts.gridSelector }
    );
  }

  async enterEditMode() {
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(100);
  }

  async typeInCell(text) {
    const input = this.page.locator(`${this.opts.gridSelector} .hg-cell-input:focus`);
    await input.fill(text);
  }

  async setCellText(row, col, text) {
    await this.navigateToCell(row, col);
    await this.enterEditMode();
    await this.typeInCell(text);
    await this.saveCell();
  }

  async saveCell() {
    await this.page.keyboard.press('Tab');
    await this.waitForHtmx();
  }

  async assertCellValue(row, col, expected) {
    const actual = await this.getCellValue(row, col);
    if (actual !== expected) {
      throw new Error(
        `Cell [${row},${col}] expected "${expected}" but got "${actual}"`
      );
    }
  }

  async getCellValue(row, col) {
    return this.page.evaluate(
      ({ row, col, sel }) => {
        const cell = document.querySelector(
          `${sel} [data-row="${row}"][data-col="${col}"] .hg-cell-input`
        );
        return cell ? cell.value : null;
      },
      { row, col, sel: this.opts.gridSelector }
    );
  }

  async sortByColumn(colIndex) {
    const headers = this.page.locator(`${this.opts.gridSelector} .hg-sort-btn`);
    await headers.nth(colIndex).click();
    await this.page.waitForTimeout(300);
  }

  async reorderRow(fromIndex, toIndex) {
    const handle = this.page.locator(
      `${this.opts.gridSelector} .hg-drag-handle`
    ).nth(fromIndex);
    const target = this.page.locator(
      `${this.opts.gridSelector} .hg-row`
    ).nth(toIndex);
    await handle.dragTo(target, { force: true });
    await this.waitForHtmx();
  }

  async waitForHtmx() {
    await this.page.waitForFunction(
      () => typeof htmx === 'undefined' || htmx?.requests?.size === 0,
      { timeout: this.opts.htmxTimeout }
    ).catch(() => {});
  }

  async setChipValue(row, col, optionText) {
    await this.navigateToCell(row, col);
    const chip = this.page.locator(
      `${this.opts.gridSelector} [data-row="${row}"][data-col="${col}"] .hg-chip`
    );
    await chip.click();
    await this.page.waitForTimeout(200);
    const option = this.page.locator(
      `${this.opts.gridSelector} .hg-chip-menu .hg-chip-option`,
      { hasText: optionText }
    );
    await option.click();
    await this.waitForHtmx();
  }

  getErrors() {
    return [...this.errors];
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  clearErrors() {
    this.errors = [];
  }

  async screenshot(name) {
    const path = `${this.opts.screenshotDir}/${name}-${Date.now()}.png`;
    await this.page.screenshot({ path, fullPage: true });
    return path;
  }

  async expectNoErrors() {
    if (!this.hasErrors()) return;
    const log = this.getErrors()
      .map((e) => `[${e.type}] ${e.text || e.message}`)
      .join('\n');
    if (this.opts.screenshotOnFailure) {
      await this.screenshot('error-state');
    }
    if (log) {
      throw new Error(`HyperGrid errors detected:\n${log}`);
    }
  }
}

module.exports = { HyperGridTest };
