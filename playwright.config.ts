import { defineConfig, type PlaywrightTestConfig } from '@playwright/test';

/**
 * Primary acceptance target: iPhone 17 Pro Max portrait — 440 × 956 CSS px @3x.
 * Chromium always runs; WebKit (Safari's engine) runs when E2E_WEBKIT=1 (CI installs it).
 */
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

const iphone17ProMax = {
  viewport: { width: 440, height: 956 },
  screen: { width: 440, height: 956 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: IPHONE_UA,
};

const projects: PlaywrightTestConfig['projects'] = [
  { name: 'iphone17promax-chromium', use: { browserName: 'chromium', ...iphone17ProMax } },
];
if (process.env.E2E_WEBKIT) {
  projects.push({ name: 'iphone17promax-webkit', use: { browserName: 'webkit', ...iphone17ProMax } });
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    colorScheme: 'light',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    acceptDownloads: true,
  },
  projects,
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
