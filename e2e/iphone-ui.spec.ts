import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { effectiveSafeArea, emulateSafeArea, expectNoHorizontalScroll, FIXED_NOW, goTab } from './helpers';
import { demoBackup } from './seed';

/**
 * iPhone 17 Pro Max (440 × 956) layout acceptance: safe areas, no horizontal scroll,
 * touch targets, keyboard behaviour, charts — in light and dark mode. Screenshots are
 * written to e2e/screenshots for visual review.
 */

const SHOTS = 'e2e/screenshots';
const VIEW_H = 956;

async function restoreDemo(page: Page) {
  await page.getByTestId('backup-file-input').setInputFiles({
    name: 'demo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(demoBackup()),
  });
  await page.getByRole('alertdialog').getByRole('button', { name: '復元する' }).click();
  await expect(page.getByTestId('goal-name')).toHaveText('MacBook Pro');
}

async function shot(page: Page, name: string, fullPage = false) {
  if (test.info().project.name.includes('webkit')) return;
  await page.waitForTimeout(250); // let sheet/fade animations settle
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
}

/** Simulates the iOS software keyboard by shrinking the visual viewport. */
async function showKeyboard(page: Page, height = 336) {
  await page.evaluate((kb) => {
    const vv = window.visualViewport!;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight - kb });
    vv.dispatchEvent(new Event('resize'));
    const fake = document.createElement('div');
    fake.id = 'fake-keyboard';
    fake.textContent = 'iOS keyboard (simulated)';
    Object.assign(fake.style, {
      position: 'fixed', left: '0', right: '0', bottom: '0', height: `${kb}px`, zIndex: '9999',
      background: 'rgba(120,120,128,0.55)', color: 'white', display: 'grid', placeItems: 'center', font: '14px system-ui',
    });
    document.body.appendChild(fake);
  }, height);
  await page.waitForTimeout(100);
}

async function expectTouchTargets(page: Page) {
  const small = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>('button, a[href], [role="radio"], [role="switch"], select, input:not([type="file"]):not([type="hidden"])').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || el.closest('[aria-hidden="true"]')) return;
      // Segmented options expand their hit area with an absolutely positioned child.
      const expander = el.querySelector(':scope > span.absolute');
      const h = expander ? Math.max(r.height, expander.getBoundingClientRect().height) : r.height;
      // Inputs laid over a larger pill (date pickers) use the pill's size.
      const target = el.tagName === 'INPUT' && el.parentElement?.tagName === 'LABEL' ? el.parentElement.getBoundingClientRect() : r;
      const w = Math.max(r.width, target.width);
      const hh = Math.max(h, target.height);
      if (w < 43.5 || hh < 43.5) out.push(`${el.tagName} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 20)}" ${Math.round(w)}x${Math.round(hh)}`);
    });
    return out;
  });
  expect(small, 'touch targets smaller than 44pt').toEqual([]);
}

async function expectSafeAreas(page: Page) {
  // Top: page headings must sit below the Dynamic Island inset.
  const headingTop = await page.locator('main h1').first().evaluate((el) => el.getBoundingClientRect().top);
  expect(headingTop).toBeGreaterThanOrEqual(effectiveSafeArea(page).top);
  // Bottom: tab bar controls must end above the home indicator.
  const nav = page.getByRole('navigation', { name: 'メインメニュー' });
  const lowest = await nav.locator('button').evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().bottom)));
  expect(lowest).toBeLessThanOrEqual(VIEW_H - effectiveSafeArea(page).bottom);
  const navBottom = await nav.evaluate((el) => el.getBoundingClientRect().bottom);
  expect(navBottom).toBeCloseTo(VIEW_H, 0);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test.beforeEach(async ({ page }) => {
      await mkdir(SHOTS, { recursive: true });
      await page.clock.setFixedTime(FIXED_NOW);
      await emulateSafeArea(page);
      await page.goto('/');
    });

    test('setup screen', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '目標を決めましょう' })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectTouchTargets(page);
      const top = await page.locator('main h1').evaluate((el) => el.getBoundingClientRect().top);
      expect(top).toBeGreaterThanOrEqual(effectiveSafeArea(page).top);
      await shot(page, `${scheme}-01-setup`);
    });

    test('dashboard, history, plan, settings with data', async ({ page }) => {
      await restoreDemo(page);
      await expect(page.getByTestId('savings-chart').locator('svg').first()).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectSafeAreas(page);
      await expectTouchTargets(page);
      // Chart stays inside its card.
      const chart = await page.getByTestId('savings-chart').boundingBox();
      expect(chart!.x).toBeGreaterThanOrEqual(0);
      expect(chart!.x + chart!.width).toBeLessThanOrEqual(440);
      // The key numbers are in the first screen.
      const remaining = await page.getByTestId('remaining-amount').boundingBox();
      expect(remaining!.y + remaining!.height).toBeLessThan(VIEW_H * 0.6);
      await shot(page, `${scheme}-02-home`);
      await shot(page, `${scheme}-03-home-full`, true);

      await goTab(page, '履歴');
      await expectNoHorizontalScroll(page);
      await expectSafeAreas(page);
      await expectTouchTargets(page);
      await shot(page, `${scheme}-04-history`);
      await page.getByRole('button', { name: '支出の内訳' }).click();
      await expect(page.getByTestId('category-breakdown')).toBeVisible();
      await shot(page, `${scheme}-05-history-breakdown`);
      await page.getByRole('button', { name: '次の月' }).click();
      await expect(page.getByText('この月の記録はまだありません')).toBeVisible();
      await shot(page, `${scheme}-06-history-empty`);

      await goTab(page, 'プラン');
      await expect(page.getByTestId('cashflow-chart').locator('svg').first()).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectSafeAreas(page);
      await expectTouchTargets(page);
      await shot(page, `${scheme}-07-plan`);
      await shot(page, `${scheme}-08-plan-full`, true);

      await goTab(page, '設定');
      await expectNoHorizontalScroll(page);
      await expectSafeAreas(page);
      await expectTouchTargets(page);
      await shot(page, `${scheme}-09-settings`, true);

      await page.getByTestId('settings-income').click();
      await expect(page.getByTestId('rule-row')).toHaveCount(2);
      await expectNoHorizontalScroll(page);
      await shot(page, `${scheme}-10-recurring`);
      await page.getByTestId('rule-row').first().click();
      await expect(page.getByTestId('rule-sheet')).toBeVisible();
      await expectTouchTargets(page);
      await shot(page, `${scheme}-11-rule-sheet`);
    });

    test('transaction sheet: keyboard, safe area and content fit', async ({ page }) => {
      await restoreDemo(page);
      await page.getByTestId('fab-add').click();
      const sheet = page.getByTestId('transaction-sheet');
      await expect(sheet.getByLabel('金額')).toBeFocused();
      await page.keyboard.type('1280');
      await sheet.getByRole('radio', { name: '食費' }).click();
      // Choosing a category must not steal focus (keeps the iOS keypad up).
      await expect(sheet.getByLabel('金額')).toBeFocused();
      await expectNoHorizontalScroll(page);
      await expectTouchTargets(page);
      const submit = sheet.getByTestId('tx-submit');
      let box = (await submit.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(VIEW_H - effectiveSafeArea(page).bottom);
      await shot(page, `${scheme}-12-add-sheet`);

      await showKeyboard(page, 336);
      box = (await submit.boundingBox())!;
      expect(box.y + box.height, 'submit button stays above the keyboard').toBeLessThanOrEqual(VIEW_H - 336);
      const amount = (await sheet.getByLabel('金額').boundingBox())!;
      expect(amount.y, 'amount field is visible above the keyboard').toBeGreaterThanOrEqual(effectiveSafeArea(page).top);
      const sheetBox = (await sheet.boundingBox())!;
      expect(sheetBox.y, 'sheet does not go under the Dynamic Island').toBeGreaterThanOrEqual(effectiveSafeArea(page).top);
      await shot(page, `${scheme}-13-add-sheet-keyboard`);
    });

    test('destructive confirmation dialog', async ({ page }) => {
      await restoreDemo(page);
      await goTab(page, '設定');
      await page.getByTestId('wipe-all').click();
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(16);
      expect(box.x + box.width).toBeLessThanOrEqual(440 - 16);
      await shot(page, `${scheme}-14-confirm`);
      await dialog.getByRole('button', { name: 'キャンセル' }).click();
      await expect(dialog).toBeHidden();
    });
  });
}

test('fresh goal shows "not enough data" instead of an invented forecast', async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await emulateSafeArea(page);
  await page.goto('/');
  await page.getByLabel('買いたい物').fill('MacBook Air 15インチ M5 スペースグレイ 1TB');
  await page.getByLabel('目標金額').fill('298000');
  await page.getByLabel('購入目標日').fill('2027-03-31');
  await page.getByTestId('setup-submit').click();
  await expectNoHorizontalScroll(page);
  await goTab(page, 'プラン');
  await expect(page.getByTestId('insufficient-data')).toContainText('支出データがまだ十分ありません');
  await expect(page.getByTestId('plan-estimated-date')).toContainText('—');
  await expectNoHorizontalScroll(page);
  await shot(page, 'light-15-plan-insufficient');
  await goTab(page, 'ホーム');
  await shot(page, 'light-16-home-long-name');
});

test('landscape: still usable with side safe areas', async ({ page }) => {
  await page.setViewportSize({ width: 956, height: 440 });
  await page.clock.setFixedTime(FIXED_NOW);
  await emulateSafeArea(page, { top: 0, bottom: 21, left: 62, right: 62 });
  await page.goto('/');
  await restoreDemo(page);
  await expectNoHorizontalScroll(page);
  const nav = page.getByRole('navigation', { name: 'メインメニュー' });
  await expect(nav.getByRole('button', { name: '設定' })).toBeInViewport();
  const h1 = (await page.locator('main h1').first().boundingBox())!;
  expect(h1.x).toBeGreaterThanOrEqual(effectiveSafeArea(page, { top: 0, bottom: 21, left: 62, right: 62 }).left);
  await page.getByTestId('fab-add').click();
  await expect(page.getByTestId('tx-submit')).toBeInViewport();
  await shot(page, 'light-17-landscape-sheet');
});

test('large text (Safari page zoom 125% ≈ 352pt wide) does not break layout', async ({ page }) => {
  await page.setViewportSize({ width: 352, height: 765 });
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto('/');
  await restoreDemo(page);
  for (const tab of ['ホーム', '履歴', 'プラン', '設定'] as const) {
    await goTab(page, tab);
    await expectNoHorizontalScroll(page);
  }
  await goTab(page, 'ホーム');
  await shot(page, 'light-18-zoomed-home');
});
