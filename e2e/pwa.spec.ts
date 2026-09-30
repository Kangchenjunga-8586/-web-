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

  // The precache holds the app shell (HTML + JS + CSS) and serves it from Cache Storage.
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) {
      const cache = await caches.open(name);
      urls.push(...(await cache.keys()).map((r) => new URL(r.url).pathname));
    }
    const shell = await caches.match(new URL('index.html', location.href).href, { ignoreSearch: true });
    return { names, urls, shellOk: shell?.ok === true, shellHasRoot: (await shell?.text())?.includes('id="root"') ?? false };
  });
  expect(cached.names.some((n) => n.includes('precache'))).toBe(true);
  expect(cached.urls.some((u) => u.endsWith('/index.html'))).toBe(true);
  expect(cached.urls.some((u) => /\/assets\/index-.*\.js$/.test(u))).toBe(true);
  expect(cached.urls.some((u) => /\/assets\/index-.*\.css$/.test(u))).toBe(true);
  expect(cached.shellOk && cached.shellHasRoot).toBe(true);

  // Full offline relaunch. Playwright's WebKit offline emulation aborts navigations before
  // the service worker can answer ("internal error"), so the real reload runs on Chromium.
  if (test.info().project.name.includes('chromium')) {
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('goal-name')).toHaveText('MacBook Pro');
    await expect(page.getByTestId('current-savings')).toContainText('¥200,000');
    await context.setOffline(false);
  }
});
