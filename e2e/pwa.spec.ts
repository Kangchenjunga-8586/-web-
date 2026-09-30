import { expect, test } from '@playwright/test';
import { completeSetup } from './helpers';

test.use({ serviceWorkers: 'allow' });

test('PWA: installable manifest, iOS icons, service worker and offline launch', async ({ page, context, request }) => {
  await page.goto('/');

  // Manifest (standalone display, icons) and the iOS home-screen icon.
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(manifestHref!)).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.lang).toBe('ja');
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await request.get(touchIcon!)).headers()['content-type']).toContain('image/png');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');

  // Service worker takes control.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await completeSetup(page);

  // Launch with no network: the cached shell loads and IndexedDB data is intact.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('goal-name')).toHaveText('MacBook Pro');
  await expect(page.getByTestId('current-savings')).toContainText('¥200,000');
  await context.setOffline(false);
});
