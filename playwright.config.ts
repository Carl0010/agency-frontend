import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke path against a real API + Postgres + S3 (docker compose).
 * Locally, already-running `dev:api` / `dev:web` servers are reused; in CI
 * both are started here. `PW_CHANNEL=chrome` uses an installed Chrome
 * instead of the downloaded Chromium.
 */
const CI = Boolean(process.env.CI);
const WEB = 'http://localhost:3200';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: CI ? 1 : 0,
  workers: 1,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  },
  webServer: [
    {
      command: 'npm run start -w apps/api',
      cwd: '../..',
      // No auth → 401, which Playwright counts as "up".
      url: 'http://127.0.0.1:4100/api/v1/me',
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    {
      command: CI ? 'npm run start' : 'npm run dev',
      url: WEB,
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});
