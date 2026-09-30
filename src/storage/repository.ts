import { buildBackup } from '../domain/backup';
import { DEFAULT_CATEGORIES } from '../domain/categories';
import { isValidISODate } from '../domain/dates';
import { newId } from '../domain/id';
import { isValidAmount } from '../domain/money';
import { applyRuleEdit, planRecurringGeneration } from '../domain/recurring';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type AppSnapshot,
  type BackupData,
  type Category,
  type Goal,
  type ISODate,
  type RecurringRule,
  type Transaction,
} from '../domain/types';
import { db } from './db';

/**
 * The only module that talks to IndexedDB. UI code calls these functions and reads
 * data through useLiveQuery(loadSnapshot); it never touches Dexie tables directly.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ValidationError(message);
}

const nowIso = () => new Date().toISOString();

const allTables = () => [db.goals, db.transactions, db.recurringRules, db.categories, db.settings];

/** Seeds default categories/settings on first launch. Safe to call on every start. */
export async function initializeDatabase(): Promise<void> {
  await db.transaction('rw', db.categories, db.settings, async () => {
    if ((await db.categories.count()) === 0) await db.categories.bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ ...c })));
    if (!(await db.settings.get('app'))) await db.settings.add({ ...DEFAULT_SETTINGS });
  });
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  return db.transaction('r', allTables(), async () => {
    const [goals, transactions, recurringRules, categories, settings] = await Promise.all([
      db.goals.toArray(),
      db.transactions.toArray(),
      db.recurringRules.toArray(),
      db.categories.toArray(),
      db.settings.get('app'),
    ]);
    goals.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      goal: goals[0] ?? null,
      transactions,
      recurringRules,
      categories,
      settings: settings ?? { ...DEFAULT_SETTINGS },
    };
  });
}

// ---------------------------------------------------------------------------
// Goal
// ---------------------------------------------------------------------------

export type GoalInput = Pick<Goal, 'name' | 'targetAmount' | 'initialSavings' | 'startDate' | 'targetDate'>;

export function validateGoalInput(input: GoalInput): void {
  assert(input.name.trim().length > 0, '買いたい物を入力してください');
  assert(input.name.trim().length <= 100, '名前は100文字以内にしてください');
  assert(isValidAmount(input.targetAmount), '目標金額は1円以上の整数で入力してください');
  assert(isValidAmount(input.initialSavings, { allowZero: true }), '現在の貯金額は0円以上の整数で入力してください');
  assert(isValidISODate(input.startDate), '貯金開始日を入力してください');
  assert(isValidISODate(input.targetDate), '購入目標日を入力してください');
  assert(input.targetDate > input.startDate, '購入目標日は貯金開始日より後にしてください');
}

/** Creates the single active goal, or updates it if one exists. */
export async function saveGoal(input: GoalInput): Promise<Goal> {
  validateGoalInput(input);
  return db.transaction('rw', db.goals, async () => {
    const existing = (await db.goals.toArray()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const now = nowIso();
    const goal: Goal = {
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? now,
      ...input,
      name: input.name.trim(),
      updatedAt: now,
    };
    await db.goals.put(goal);
    return goal;
  });
}

/** Removes the goal only. Transactions, rules and categories are kept. */
export async function resetGoal(): Promise<void> {
  await db.goals.clear();
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export type TransactionInput = Pick<Transaction, 'type' | 'amount' | 'categoryId' | 'date' | 'memo'>;

export function validateTransactionInput(input: TransactionInput): void {
  assert(input.type === 'income' || input.type === 'expense', '種類が不正です');
  assert(isValidAmount(input.amount), '金額は1円以上の整数で入力してください');
  assert(input.categoryId, 'カテゴリを選んでください');
  assert(isValidISODate(input.date), '日付を入力してください');
  assert(input.memo.length <= 200, 'メモは200文字以内にしてください');
}

export async function addTransaction(input: TransactionInput): Promise<Transaction> {
  validateTransactionInput(input);
  const now = nowIso();
  const tx: Transaction = {
    id: newId(),
    ...input,
    memo: input.memo.trim(),
    recurringRuleId: null,
    occurrenceDate: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.transactions.add(tx);
  return tx;
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<void> {
  validateTransactionInput(input);
  const updated = await db.transactions.update(id, { ...input, memo: input.memo.trim(), updatedAt: nowIso() });
  assert(updated === 1, '取引が見つかりませんでした');
}

/** Deletes and returns the transaction so the UI can offer undo. */
export async function deleteTransaction(id: string): Promise<Transaction | undefined> {
  return db.transaction('rw', db.transactions, async () => {
    const tx = await db.transactions.get(id);
    if (tx) await db.transactions.delete(id);
    return tx;
  });
}

/** Undo for add (delete) / delete (re-insert with the same id). */
export async function restoreTransaction(tx: Transaction): Promise<void> {
  await db.transactions.put(tx);
}

// ---------------------------------------------------------------------------
// Recurring rules
// ---------------------------------------------------------------------------

export type RecurringRuleInput = Pick<
  RecurringRule,
  'type' | 'name' | 'amount' | 'categoryId' | 'frequency' | 'dayOfMonth' | 'dayOfWeek' | 'month' | 'startDate' | 'endDate' | 'enabled'
>;

export function validateRuleInput(input: RecurringRuleInput): void {
  assert(input.name.trim().length > 0, '名前を入力してください');
  assert(isValidAmount(input.amount), '金額は1円以上の整数で入力してください');
  assert(input.categoryId, 'カテゴリを選んでください');
  assert(['monthly', 'weekly', 'yearly'].includes(input.frequency), '頻度が不正です');
  assert(Number.isInteger(input.dayOfMonth) && input.dayOfMonth >= 1 && input.dayOfMonth <= 31, '日付が不正です');
  assert(Number.isInteger(input.dayOfWeek) && input.dayOfWeek >= 0 && input.dayOfWeek <= 6, '曜日が不正です');
  assert(Number.isInteger(input.month) && input.month >= 1 && input.month <= 12, '月が不正です');
  assert(isValidISODate(input.startDate), '開始日を入力してください');
  assert(input.endDate === null || isValidISODate(input.endDate), '終了日が不正です');
  assert(input.endDate === null || input.endDate >= input.startDate, '終了日は開始日以降にしてください');
}

/** Creates/updates a rule and immediately generates any due transactions. */
export async function saveRecurringRule(
  input: RecurringRuleInput,
  today: ISODate,
  id?: string,
): Promise<{ rule: RecurringRule; created: number }> {
  validateRuleInput(input);
  const rule = await db.transaction('rw', db.recurringRules, async () => {
    const prev = id ? ((await db.recurringRules.get(id)) ?? null) : null;
    const now = nowIso();
    const next = applyRuleEdit(
      prev,
      {
        id: prev?.id ?? newId(),
        ...input,
        name: input.name.trim(),
        generatedThrough: prev?.generatedThrough ?? null,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      },
      today,
    );
    await db.recurringRules.put(next);
    return next;
  });
  const created = await generateRecurringTransactions(today);
  return { rule, created };
}

/** Deletes the rule. Transactions it already generated stay as history. */
export async function deleteRecurringRule(id: string): Promise<void> {
  await db.recurringRules.delete(id);
}

/**
 * Creates due recurring transactions. Idempotent and duplicate-safe:
 * - IDs are deterministic (rec:<ruleId>:<date>) and existing IDs are skipped;
 * - each rule's generatedThrough watermark advances in the same DB transaction.
 * Returns the number of transactions created.
 */
export async function generateRecurringTransactions(today: ISODate): Promise<number> {
  return db.transaction('rw', db.recurringRules, db.transactions, db.goals, async () => {
    const [rules, goals] = await Promise.all([db.recurringRules.toArray(), db.goals.toArray()]);
    const goal = goals.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const plan = planRecurringGeneration(rules, today, goal?.startDate ?? null, nowIso());
    let created = 0;
    if (plan.transactions.length > 0) {
      const existing = await db.transactions.bulkGet(plan.transactions.map((t) => t.id));
      const fresh = plan.transactions.filter((_, i) => existing[i] === undefined);
      if (fresh.length > 0) await db.transactions.bulkAdd(fresh);
      created = fresh.length;
    }
    for (const w of plan.watermarks) {
      await db.recurringRules.update(w.ruleId, { generatedThrough: w.generatedThrough });
    }
    return created;
  });
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryInput = Pick<Category, 'kind' | 'name' | 'emoji'>;

export async function saveCategory(input: CategoryInput, id?: string): Promise<Category> {
  const name = input.name.trim();
  assert(name.length > 0, 'カテゴリ名を入力してください');
  assert(name.length <= 30, 'カテゴリ名は30文字以内にしてください');
  return db.transaction('rw', db.categories, async () => {
    const all = await db.categories.toArray();
    assert(
      !all.some((c) => c.kind === input.kind && c.name === name && c.id !== id && !c.archived),
      '同じ名前のカテゴリがあります',
    );
    const prev = id ? all.find((c) => c.id === id) : undefined;
    const category: Category = {
      id: prev?.id ?? newId(),
      kind: prev?.kind ?? input.kind,
      name,
      emoji: input.emoji || '📦',
      order: prev?.order ?? Math.max(-1, ...all.filter((c) => c.kind === input.kind).map((c) => c.order)) + 1,
      archived: prev?.archived ?? false,
    };
    await db.categories.put(category);
    return category;
  });
}

/** Categories are archived, never deleted, so old transactions keep their label. */
export async function setCategoryArchived(id: string, archived: boolean): Promise<void> {
  await db.categories.update(id, { archived });
}

// ---------------------------------------------------------------------------
// Settings, backup, wipe
// ---------------------------------------------------------------------------

export async function updateSettings(patch: Partial<Omit<AppSettings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get('app')) ?? { ...DEFAULT_SETTINGS };
    await db.settings.put({ ...current, ...patch, id: 'app' });
  });
}

export async function exportBackupData(): Promise<BackupData> {
  return buildBackup(await loadSnapshot());
}

/**
 * Replaces ALL data with a validated backup in one atomic IndexedDB transaction.
 * If anything fails, the transaction aborts and the current data is left untouched.
 */
export async function importBackup(data: BackupData): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()));
    await db.goals.bulkAdd(data.goals);
    await db.transactions.bulkAdd(data.transactions);
    await db.recurringRules.bulkAdd(data.recurringRules);
    await db.categories.bulkAdd(data.categories);
    await db.settings.put({ ...data.settings, id: 'app' });
  });
}

/** Deletes every record and re-seeds defaults (fresh-install state). */
export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()));
    await db.categories.bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ ...c })));
    await db.settings.add({ ...DEFAULT_SETTINGS });
  });
}

/** Asks the browser not to evict our storage under pressure (best effort). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
