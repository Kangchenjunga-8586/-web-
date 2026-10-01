import { expect, type Page } from '@playwright/test';

/** 2026-09-30 10:00 JST — every test runs on the same calendar day. */
export const FIXED_NOW = new Date('2026-09-30T10:00:00+09:00');

/** iPhone 17 Pro Max portrait safe-area insets (Dynamic Island / home indicator). */
export const SAFE_AREA_PORTRAIT = { top: 62, bottom: 34, left: 0, right: 0 };

/** Safe-area insets are emulated via CDP, which only Chromium supports. */
export function canEmulateSafeArea(page: Page): boolean {
  return page.context().browser()?.browserType().name() === 'chromium';
}

/** The insets actually in effect for this browser (zeros where emulation is unavailable). */
export function effectiveSafeArea(page: Page, insets = SAFE_AREA_PORTRAIT) {
  return canEmulateSafeArea(page) ? insets : { top: 0, bottom: 0, left: 0, right: 0 };
}

export async function emulateSafeArea(page: Page, insets = SAFE_AREA_PORTRAIT) {
  if (!canEmulateSafeArea(page)) return false;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride' as never, { insets } as never);
  return true;
}

export async function openApp(page: Page, { safeArea = true } = {}) {
  await page.clock.setFixedTime(FIXED_NOW);
  if (safeArea) await emulateSafeArea(page);
  await page.goto('/');
}

export interface SetupOptions {
  name?: string;
  target?: string;
  saved?: string;
  targetDate?: string;
}

export async function completeSetup(page: Page, opts: SetupOptions = {}) {
  await expect(page.getByRole('heading', { name: '目標を決めましょう' })).toBeVisible();
  await page.getByLabel('買いたい物').fill(opts.name ?? 'MacBook Pro');
  await page.getByLabel('目標金額').fill(opts.target ?? '450000');
  await page.getByLabel('すでに貯まっている金額').fill(opts.saved ?? '200000');
  await page.getByLabel('購入目標日').fill(opts.targetDate ?? '2027-04-01');
  await page.getByTestId('setup-submit').click();
  await expect(page.getByTestId('goal-name')).toHaveText(opts.name ?? 'MacBook Pro');
}

export async function addTransaction(
  page: Page,
  { type = 'expense', amount, category, memo }: { type?: 'expense' | 'income'; amount: string; category: string; memo?: string },
) {
  await page.getByTestId(type === 'expense' ? 'quick-expense' : 'quick-income').click();
  const sheet = page.getByTestId('transaction-sheet');
  await expect(sheet).toBeVisible();
  // The amount field must already be focused (iOS keypad opens in the same tap).
  await expect(sheet.getByLabel('金額')).toBeFocused();
  await page.keyboard.type(amount);
  await sheet.getByRole('radio', { name: category }).click();
  if (memo) await sheet.getByLabel('メモ').fill(memo);
  await sheet.getByTestId('tx-submit').click();
  await expect(sheet).toBeHidden();
}

export async function goTab(page: Page, name: 'ホーム' | '履歴' | 'グラフ' | '設定') {
  await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name }).click();
}

/** Money components render an sr-only "¥1,234" label; match against that. */
export async function expectMoney(page: Page, testId: string, text: string) {
  await expect(page.getByTestId(testId)).toContainText(text);
}

export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, 'page must not scroll horizontally').toBeLessThanOrEqual(innerWidth);
}
