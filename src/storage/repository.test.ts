import { beforeEach, describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from '../domain/backup';
import { DEFAULT_CATEGORIES } from '../domain/categories';
import { makeGoal } from '../test/fixtures';
import { db } from './db';
import {
  addTransaction,
  deleteRecurringRule,
  deleteTransaction,
  exportBackupData,
  generateRecurringTransactions,
  importBackup,
  initializeDatabase,
  loadSnapshot,
  resetGoal,
  restoreTransaction,
  saveCategory,
  saveGoal,
  saveRecurringRule,
  setCategoryArchived,
  updateSettings,
  updateTransaction,
  wipeAllData,
  type RecurringRuleInput,
} from './repository';

const TODAY = '2026-09-30';

const goalInput = {
  name: 'MacBook Pro',
  targetAmount: 450_000,
  initialSavings: 200_000,
  startDate: '2026-09-01',
  targetDate: '2027-04-01',
};

const payday: RecurringRuleInput = {
  type: 'income',
  name: 'アルバイト',
  amount: 60_000,
  categoryId: 'inc-job',
  frequency: 'monthly',
  dayOfMonth: 25,
  dayOfWeek: 0,
  month: 1,
  startDate: '2026-01-01',
  endDate: null,
  enabled: true,
};

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
  await initializeDatabase();
});

describe('repository', () => {
  it('seeds default categories and settings once', async () => {
    await initializeDatabase();
    const snap = await loadSnapshot();
    expect(snap.categories).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(snap.settings.theme).toBe('system');
    expect(snap.goal).toBeNull();
  });

  it('creates and updates the single goal', async () => {
    const created = await saveGoal(goalInput);
    const updated = await saveGoal({ ...goalInput, targetAmount: 500_000 });
    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    const snap = await loadSnapshot();
    expect(await db.goals.count()).toBe(1);
    expect(snap.goal?.targetAmount).toBe(500_000);
  });

  it('rejects invalid goal input', async () => {
    await expect(saveGoal({ ...goalInput, name: ' ' })).rejects.toThrow('買いたい物');
    await expect(saveGoal({ ...goalInput, targetAmount: 0 })).rejects.toThrow('目標金額');
    await expect(saveGoal({ ...goalInput, targetAmount: 1.5 })).rejects.toThrow('目標金額');
    await expect(saveGoal({ ...goalInput, targetDate: '2026-08-01' })).rejects.toThrow('購入目標日');
  });

  it('adds, edits, deletes and restores transactions', async () => {
    const tx = await addTransaction({ type: 'expense', amount: 580, categoryId: 'exp-food', date: TODAY, memo: ' コンビニ ' });
    expect(tx.memo).toBe('コンビニ');
    await updateTransaction(tx.id, { type: 'expense', amount: 680, categoryId: 'exp-food', date: TODAY, memo: '' });
    expect((await db.transactions.get(tx.id))?.amount).toBe(680);
    const deleted = await deleteTransaction(tx.id);
    expect(await db.transactions.count()).toBe(0);
    await restoreTransaction(deleted!);
    expect((await db.transactions.get(tx.id))?.amount).toBe(680);
    await expect(
      addTransaction({ type: 'expense', amount: 0, categoryId: 'exp-food', date: TODAY, memo: '' }),
    ).rejects.toThrow('金額');
  });

  it('generates recurring transactions without duplicates (repeated launches)', async () => {
    await saveGoal(goalInput);
    await saveRecurringRule(payday, TODAY);
    expect(await db.transactions.count()).toBe(1); // 2026-09-25 (tracking starts 2026-09-01)
    expect(await generateRecurringTransactions(TODAY)).toBe(0);
    expect(await generateRecurringTransactions(TODAY)).toBe(0);
    expect(await db.transactions.count()).toBe(1);
    expect(await generateRecurringTransactions('2026-10-25')).toBe(1);
    expect(await generateRecurringTransactions('2026-10-25')).toBe(0);
    expect(await db.transactions.count()).toBe(2);
  });

  it('runs concurrent generations safely', async () => {
    await saveGoal(goalInput);
    await saveRecurringRule({ ...payday, frequency: 'weekly', dayOfWeek: 5 }, '2026-09-01');
    await Promise.all([
      generateRecurringTransactions(TODAY),
      generateRecurringTransactions(TODAY),
      generateRecurringTransactions(TODAY),
    ]);
    const txs = await db.transactions.toArray();
    expect(txs.map((t) => t.date).sort()).toEqual(['2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25']);
  });

  it('does not regenerate a deleted recurring transaction, keeps history when the rule is deleted', async () => {
    await saveGoal(goalInput);
    const { rule, created } = await saveRecurringRule(payday, TODAY);
    expect(created).toBe(1);
    const [generated] = await db.transactions.toArray();
    await deleteTransaction(generated!.id);
    await generateRecurringTransactions(TODAY);
    expect(await db.transactions.count()).toBe(0);
    await generateRecurringTransactions('2026-10-25');
    await deleteRecurringRule(rule.id);
    expect(await db.transactions.count()).toBe(1);
    await generateRecurringTransactions('2026-11-30');
    expect(await db.transactions.count()).toBe(1);
  });

  it('archives categories and rejects duplicate names', async () => {
    const cat = await saveCategory({ kind: 'expense', name: 'カフェ', emoji: '☕️' });
    await expect(saveCategory({ kind: 'expense', name: 'カフェ', emoji: '☕️' })).rejects.toThrow('同じ名前');
    await setCategoryArchived(cat.id, true);
    const snap = await loadSnapshot();
    expect(snap.categories.find((c) => c.id === cat.id)?.archived).toBe(true);
  });

  it('exports and imports a backup that restores everything', async () => {
    await saveGoal(goalInput);
    await saveRecurringRule(payday, TODAY);
    await addTransaction({ type: 'expense', amount: 1200, categoryId: 'exp-food', date: TODAY, memo: 'ランチ' });
    await updateSettings({ theme: 'dark' });
    const before = await loadSnapshot();
    const text = serializeBackup(await exportBackupData());

    await wipeAllData();
    expect((await loadSnapshot()).goal).toBeNull();
    expect(await db.transactions.count()).toBe(0);

    await importBackup(parseBackup(text));
    const after = await loadSnapshot();
    expect(after.goal).toEqual(before.goal);
    expect(after.settings.theme).toBe('dark');
    expect(after.transactions.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      before.transactions.sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(after.recurringRules).toEqual(before.recurringRules);
    // Restored watermarks prevent duplicate generation after import.
    expect(await generateRecurringTransactions(TODAY)).toBe(0);
  });

  it('keeps current data when an import fails midway', async () => {
    await saveGoal(goalInput);
    await addTransaction({ type: 'expense', amount: 1200, categoryId: 'exp-food', date: TODAY, memo: '' });
    const bad = parseBackup(serializeBackup(await exportBackupData()));
    // Duplicate primary key makes bulkAdd fail inside the transaction.
    bad.goals = [makeGoal({ id: 'dup' }), makeGoal({ id: 'dup' })];
    await expect(importBackup(bad)).rejects.toThrow();
    const snap = await loadSnapshot();
    expect(snap.goal?.name).toBe('MacBook Pro');
    expect(snap.transactions).toHaveLength(1);
  });

  it('resets only the goal, and wipes everything on full delete', async () => {
    await saveGoal(goalInput);
    await addTransaction({ type: 'expense', amount: 100, categoryId: 'exp-food', date: TODAY, memo: '' });
    await resetGoal();
    let snap = await loadSnapshot();
    expect(snap.goal).toBeNull();
    expect(snap.transactions).toHaveLength(1);
    await wipeAllData();
    snap = await loadSnapshot();
    expect(snap.transactions).toHaveLength(0);
    expect(snap.categories).toHaveLength(DEFAULT_CATEGORIES.length);
  });

  it('persists across database reopen (reload)', async () => {
    await saveGoal(goalInput);
    db.close();
    await db.open();
    expect((await loadSnapshot()).goal?.name).toBe('MacBook Pro');
  });
});
