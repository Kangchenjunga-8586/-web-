import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { addTransaction, completeSetup, expectMoney, expectNoHorizontalScroll, goTab, openApp } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('Scenario 1: first launch → create MacBook goal → dashboard', async ({ page }) => {
  await expectNoHorizontalScroll(page);
  await completeSetup(page);
  await expectMoney(page, 'current-savings', '¥200,000');
  await expectMoney(page, 'remaining-amount', '¥250,000');
  await expect(page.getByTestId('progress-percent')).toHaveText('44%');
  await expect(page.getByTestId('goal-card')).toContainText('2027/04/01');
  await expect(page.getByTestId('goal-card')).toContainText('あと183日');
  // ¥250,000 remaining over 183 days, rounded up: ¥1,367/日, ¥9,563/週, ¥41,581/月
  await expectMoney(page, 'required-day', '¥1,367');
  await expectMoney(page, 'required-week', '¥9,563');
  await expectMoney(page, 'required-month', '¥41,581');
  await expectNoHorizontalScroll(page);
});

test('Scenario 2: add expense → dashboard updates → shows in history', async ({ page }) => {
  await completeSetup(page);
  await addTransaction(page, { amount: '1200', category: '食費', memo: 'ランチ' });
  await expect(page.getByTestId('toast')).toContainText('¥1,200 を記録しました');
  await expectMoney(page, 'current-savings', '¥198,800');
  await expect(page.getByTestId('month-card')).toContainText('¥1,200');
  await goTab(page, '履歴');
  const row = page.getByTestId('tx-row').filter({ hasText: 'ランチ' });
  await expect(row).toContainText('−¥1,200');
  await expect(row).toContainText('食費');
});

test('Scenario 3: add income → savings increase', async ({ page }) => {
  await completeSetup(page);
  await addTransaction(page, { type: 'income', amount: '30000', category: 'お小遣い' });
  await expectMoney(page, 'current-savings', '¥230,000');
  await expect(page.getByTestId('progress-percent')).toHaveText('51%');
});

test('Scenario 4: recurring income is generated automatically, never duplicated', async ({ page }) => {
  await completeSetup(page);
  await goTab(page, '設定');
  await page.getByTestId('settings-income').click();
  await page.getByTestId('add-rule').click();
  const sheet = page.getByTestId('rule-sheet');
  await sheet.getByLabel('名前').fill('アルバイト');
  await sheet.getByLabel('金額').fill('60000');
  // Default schedule: monthly on today's day (30th) starting today → due today.
  await expect(sheet).toContainText('毎月30日');
  await sheet.getByTestId('rule-submit').click();
  await expect(page.getByTestId('toast')).toContainText('1件を自動記録しました');
  await expect(page.getByTestId('rule-row')).toContainText('次回 2026/10/30');

  await goTab(page, 'ホーム');
  await expectMoney(page, 'current-savings', '¥260,000');

  // Relaunch twice: still exactly one generated transaction.
  await page.reload();
  await page.reload();
  await expectMoney(page, 'current-savings', '¥260,000');
  await goTab(page, '履歴');
  await expect(page.getByTestId('tx-row').filter({ hasText: 'アルバイト' })).toHaveCount(1);

  // Plan: the monthly income is split per day / week (60,000 ÷ 30.436875 days = 1,971/日).
  await goTab(page, 'プラン');
  const table = page.getByTestId('rate-table');
  await expect(table.getByTestId('rate-recurring-income')).toContainText('+1,971');
  await expect(table.getByTestId('rate-recurring-income')).toContainText('+13,799');
  await expect(table.getByTestId('rate-recurring-income')).toContainText('+60,000');
  await expect(table.getByRole('rowheader', { name: 'アルバイト' })).toBeVisible();
  // Fresh goal: only recurring amounts are known yet, so no surplus row is shown.
  await expect(table.getByTestId('rate-net')).toContainText('定期分のみ');
  await expect(table.getByTestId('rate-required')).toBeVisible();
  await expect(table.getByTestId('rate-surplus')).toHaveCount(0);
});

test('Scenario 5: fixed expense is generated automatically', async ({ page }) => {
  await completeSetup(page);
  await goTab(page, '設定');
  await page.getByTestId('settings-expenses').click();
  await page.getByTestId('add-rule').click();
  const sheet = page.getByTestId('rule-sheet');
  await sheet.getByLabel('名前').fill('スマホ');
  await sheet.getByLabel('金額').fill('3000');
  await sheet.getByTestId('rule-submit').click();
  await expect(page.getByTestId('toast')).toContainText('1件を自動記録しました');
  await goTab(page, 'ホーム');
  await expectMoney(page, 'current-savings', '¥197,000');
  await goTab(page, 'プラン');
  await expect(page.getByText('固定支出').first()).toBeVisible();
});

test('Scenario 6: edit and delete a transaction', async ({ page }) => {
  await completeSetup(page);
  await addTransaction(page, { amount: '1000', category: '交通', memo: '電車' });
  await goTab(page, '履歴');
  await page.getByTestId('tx-row').filter({ hasText: '電車' }).click();
  const sheet = page.getByTestId('transaction-sheet');
  await expect(sheet.getByLabel('金額')).toHaveValue('1,000');
  await sheet.getByLabel('金額').fill('1500');
  await sheet.getByTestId('tx-submit').click();
  await expect(page.getByTestId('tx-row').filter({ hasText: '電車' })).toContainText('−¥1,500');

  await page.getByTestId('tx-row').filter({ hasText: '電車' }).click();
  await page.getByRole('button', { name: 'この取引を削除' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('この取引を削除しますか？');
  await dialog.getByRole('button', { name: '削除' }).click();
  await expect(page.getByTestId('tx-row')).toHaveCount(0);
  await goTab(page, 'ホーム');
  await expectMoney(page, 'current-savings', '¥200,000');
});

test('Scenario 7: backup export → wipe → import restores everything', async ({ page }) => {
  await completeSetup(page);
  await addTransaction(page, { amount: '2500', category: '趣味', memo: 'ゲーム' });
  await addTransaction(page, { type: 'income', amount: '10000', category: 'お小遣い' });
  await goTab(page, '設定');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-backup').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('goalbudget-backup-2026-09-30.json');
  const file = await download.path();
  const json = JSON.parse(await readFile(file, 'utf8'));
  expect(json.schemaVersion).toBe(1);
  expect(json.transactions).toHaveLength(2);
  await expect(page.getByTestId('export-backup')).toContainText('最終：2026/09/30');

  // Wipe everything (strong confirmation).
  await page.getByTestId('wipe-all').click();
  const dialog = page.getByRole('alertdialog');
  const confirmButton = dialog.getByRole('button', { name: '完全に削除' });
  await expect(confirmButton).toBeDisabled();
  await dialog.getByRole('textbox').fill('削除');
  await confirmButton.click();
  await expect(page.getByRole('heading', { name: '目標を決めましょう' })).toBeVisible();

  // An invalid file is rejected without touching data.
  await page.getByTestId('backup-file-input').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"app":"Other"}'),
  });
  await expect(page.getByRole('alert')).toContainText('GoalBudgetのバックアップファイルではありません');

  // Restore from the exported file.
  await page.getByTestId('backup-file-input').setInputFiles(file);
  const restore = page.getByRole('alertdialog');
  await expect(restore).toContainText('取引：2件');
  await restore.getByRole('button', { name: '復元する' }).click();
  await expect(page.getByTestId('goal-name')).toHaveText('MacBook Pro');
  await expectMoney(page, 'current-savings', '¥207,500');
});

test('Scenario 8: data persists after reload', async ({ page }) => {
  await completeSetup(page);
  await addTransaction(page, { amount: '800', category: '食費', memo: 'コーヒー' });
  await page.reload();
  await expectMoney(page, 'current-savings', '¥199,200');
  await goTab(page, '履歴');
  await expect(page.getByTestId('tx-row').filter({ hasText: 'コーヒー' })).toBeVisible();
});

test('CSV export produces a Japanese UTF-8 file', async ({ page }) => {
  await completeSetup(page);
  await addTransaction(page, { amount: '450', category: '食費', memo: 'おにぎり' });
  await goTab(page, '設定');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-csv').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('goalbudget-transactions-2026-09-30.csv');
  const text = await readFile(await download.path(), 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text).toContain('2026-09-30,支出,食費,450,おにぎり,');
});

test('validation: amount and category are required', async ({ page }) => {
  await completeSetup(page);
  await page.getByTestId('quick-expense').click();
  const sheet = page.getByTestId('transaction-sheet');
  await sheet.getByTestId('tx-submit').click();
  await expect(sheet).toContainText('金額を入力してください');
  await expect(sheet).toContainText('カテゴリを選んでください');
  await expect(sheet).toBeVisible();
});

test('undo right after adding an expense', async ({ page }) => {
  await completeSetup(page);
  await addTransaction(page, { amount: '5000', category: '衣服' });
  await expectMoney(page, 'current-savings', '¥195,000');
  await page.getByTestId('toast').getByRole('button', { name: '取り消す' }).click();
  await expectMoney(page, 'current-savings', '¥200,000');
});
