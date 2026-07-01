// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  outputDir: '../../test-results',
  reporter: [
    ['html', { outputFolder: '../../playwright-report' }],
    ['json', { outputFile: '../../test-results/results.json' }],
    ['list'],
  ],
  webServer: {
    command: 'node serve.js 8769',
    url: 'http://localhost:8769/demo/',
    reuseExistingServer: true,
    timeout: 15000,
  },
  use: {
    baseURL: 'http://localhost:8769/demo/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
