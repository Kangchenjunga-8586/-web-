import { isValidISODate } from './dates';
import { isValidAmount } from './money';
import {
  BACKUP_APP_ID,
  BACKUP_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  type AppSettings,
  type AppSnapshot,
  type BackupData,
  type Category,
  type Goal,
  type RecurringRule,
  type Transaction,
} from './types';

export function buildBackup(snapshot: AppSnapshot, exportedAt: string = new Date().toISOString()): BackupData {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    goals: snapshot.goal ? [snapshot.goal] : [],
    transactions: [...snapshot.transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    recurringRules: snapshot.recurringRules,
    categories: snapshot.categories,
    settings: snapshot.settings,
  };
}

export function serializeBackup(data: BackupData): string {
  return JSON.stringify(data, null, 2);
}

export function backupFileName(today: string): string {
  return `goalbudget-backup-${today}.json`;
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(path: string, expected: string): never {
  throw new BackupValidationError(`${path} が不正です（${expected}）`);
}

function str(obj: Json, key: string, path: string, { allowEmpty = true, max = 500 } = {}): string {
  const v = obj[key];
  if (typeof v !== 'string') fail(`${path}.${key}`, '文字列');
  if (!allowEmpty && v.trim() === '') fail(`${path}.${key}`, '空でない文字列');
  if (v.length > max) fail(`${path}.${key}`, `${max}文字以内`);
  return v;
}

function date(obj: Json, key: string, path: string): string {
  const v = obj[key];
  if (!isValidISODate(v)) fail(`${path}.${key}`, 'YYYY-MM-DD形式の日付');
  return v;
}

function nullableDate(obj: Json, key: string, path: string): string | null {
  return obj[key] === null || obj[key] === undefined ? null : date(obj, key, path);
}

function timestamp(obj: Json, key: string, path: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) fail(`${path}.${key}`, '日時');
  return v;
}

function amount(obj: Json, key: string, path: string, allowZero: boolean): number {
  const v = obj[key];
  if (!isValidAmount(v, { allowZero })) fail(`${path}.${key}`, allowZero ? '0以上の整数' : '1以上の整数');
  return v;
}

function intInRange(obj: Json, key: string, path: string, min: number, max: number): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) fail(`${path}.${key}`, `${min}〜${max}の整数`);
  return v;
}

function oneOf<T extends string>(obj: Json, key: string, path: string, values: readonly T[]): T {
  const v = obj[key];
  if (typeof v !== 'string' || !(values as readonly string[]).includes(v)) fail(`${path}.${key}`, values.join(' / '));
  return v as T;
}

function bool(obj: Json, key: string, path: string): boolean {
  const v = obj[key];
  if (typeof v !== 'boolean') fail(`${path}.${key}`, 'true / false');
  return v;
}

function array(obj: Json, key: string): unknown[] {
  const v = obj[key];
  if (!Array.isArray(v)) fail(key, '配列');
  return v;
}

function validateGoal(raw: unknown, path: string): Goal {
  if (!isObject(raw)) fail(path, 'オブジェクト');
  const goal: Goal = {
    id: str(raw, 'id', path, { allowEmpty: false }),
    name: str(raw, 'name', path, { allowEmpty: false, max: 100 }),
    targetAmount: amount(raw, 'targetAmount', path, false),
    initialSavings: amount(raw, 'initialSavings', path, true),
    startDate: date(raw, 'startDate', path),
    targetDate: date(raw, 'targetDate', path),
    createdAt: timestamp(raw, 'createdAt', path),
    updatedAt: timestamp(raw, 'updatedAt', path),
  };
  return goal;
}

function validateTransaction(raw: unknown, path: string): Transaction {
  if (!isObject(raw)) fail(path, 'オブジェクト');
  const recurringRuleId = raw.recurringRuleId === null || raw.recurringRuleId === undefined ? null : str(raw, 'recurringRuleId', path);
  return {
    id: str(raw, 'id', path, { allowEmpty: false }),
    type: oneOf(raw, 'type', path, ['income', 'expense'] as const),
    amount: amount(raw, 'amount', path, false),
    categoryId: str(raw, 'categoryId', path, { allowEmpty: false }),
    date: date(raw, 'date', path),
    memo: str(raw, 'memo', path, { max: 200 }),
    recurringRuleId,
    occurrenceDate: nullableDate(raw, 'occurrenceDate', path),
    createdAt: timestamp(raw, 'createdAt', path),
    updatedAt: timestamp(raw, 'updatedAt', path),
  };
}

function validateRule(raw: unknown, path: string): RecurringRule {
  if (!isObject(raw)) fail(path, 'オブジェクト');
  return {
    id: str(raw, 'id', path, { allowEmpty: false }),
    type: oneOf(raw, 'type', path, ['income', 'expense'] as const),
    name: str(raw, 'name', path, { allowEmpty: false, max: 100 }),
    amount: amount(raw, 'amount', path, false),
    categoryId: str(raw, 'categoryId', path, { allowEmpty: false }),
    frequency: oneOf(raw, 'frequency', path, ['monthly', 'weekly', 'yearly'] as const),
    dayOfMonth: intInRange(raw, 'dayOfMonth', path, 1, 31),
    dayOfWeek: intInRange(raw, 'dayOfWeek', path, 0, 6),
    month: intInRange(raw, 'month', path, 1, 12),
    startDate: date(raw, 'startDate', path),
    endDate: nullableDate(raw, 'endDate', path),
    enabled: bool(raw, 'enabled', path),
    generatedThrough: nullableDate(raw, 'generatedThrough', path),
    createdAt: timestamp(raw, 'createdAt', path),
    updatedAt: timestamp(raw, 'updatedAt', path),
  };
}

function validateCategory(raw: unknown, path: string): Category {
  if (!isObject(raw)) fail(path, 'オブジェクト');
  return {
    id: str(raw, 'id', path, { allowEmpty: false }),
    kind: oneOf(raw, 'kind', path, ['income', 'expense'] as const),
    name: str(raw, 'name', path, { allowEmpty: false, max: 30 }),
    emoji: str(raw, 'emoji', path, { max: 16 }),
    order: intInRange(raw, 'order', path, -1_000_000, 1_000_000),
    archived: bool(raw, 'archived', path),
  };
}

function validateSettings(raw: unknown): AppSettings {
  if (raw === undefined || raw === null) return { ...DEFAULT_SETTINGS };
  if (!isObject(raw)) fail('settings', 'オブジェクト');
  return {
    id: 'app',
    theme: oneOf(raw, 'theme', 'settings', ['system', 'light', 'dark'] as const),
    lastBackupAt: raw.lastBackupAt === null || raw.lastBackupAt === undefined ? null : timestamp(raw, 'lastBackupAt', 'settings'),
  };
}

function assertUniqueIds(items: { id: string }[], label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new BackupValidationError(`${label} のIDが重複しています（${item.id}）`);
    seen.add(item.id);
  }
}

/** Upgrades older backup files to the current schema. v1 is the first version. */
function migrate(raw: Json): Json {
  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new BackupValidationError('schemaVersion が不正です');
  }
  if (version > BACKUP_SCHEMA_VERSION) {
    throw new BackupValidationError('このバックアップは新しいバージョンのアプリで作成されています。アプリを更新してください。');
  }
  // Future: if (version === 1) raw = migrateV1toV2(raw);
  return raw;
}

/**
 * Parses and fully validates a backup file. Throws BackupValidationError with a
 * Japanese message on any problem. Never partially accepts a file.
 */
export function parseBackup(text: string): BackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupValidationError('JSONとして読み込めませんでした。GoalBudgetのバックアップファイルを選んでください。');
  }
  if (!isObject(raw) || raw.app !== BACKUP_APP_ID) {
    throw new BackupValidationError('GoalBudgetのバックアップファイルではありません。');
  }
  const data = migrate(raw);
  const goals = array(data, 'goals').map((g, i) => validateGoal(g, `goals[${i}]`));
  const transactions = array(data, 'transactions').map((t, i) => validateTransaction(t, `transactions[${i}]`));
  const recurringRules = array(data, 'recurringRules').map((r, i) => validateRule(r, `recurringRules[${i}]`));
  const categories = array(data, 'categories').map((c, i) => validateCategory(c, `categories[${i}]`));
  const settings = validateSettings(data.settings);

  if (goals.length > 1) throw new BackupValidationError('目標は1件のみ対応しています。');
  assertUniqueIds(goals, '目標');
  assertUniqueIds(transactions, '取引');
  assertUniqueIds(recurringRules, '定期ルール');
  assertUniqueIds(categories, 'カテゴリ');

  const categoryIds = new Set(categories.map((c) => c.id));
  for (const tx of transactions) {
    if (!categoryIds.has(tx.categoryId)) {
      throw new BackupValidationError(`取引が存在しないカテゴリを参照しています（${tx.categoryId}）`);
    }
  }
  for (const rule of recurringRules) {
    if (!categoryIds.has(rule.categoryId)) {
      throw new BackupValidationError(`定期ルールが存在しないカテゴリを参照しています（${rule.categoryId}）`);
    }
  }

  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: timestamp(data, 'exportedAt', 'backup'),
    goals,
    transactions,
    recurringRules,
    categories,
    settings,
  };
}

export interface BackupSummary {
  exportedAt: string;
  goalName: string | null;
  transactionCount: number;
  ruleCount: number;
  categoryCount: number;
}

export function summarizeBackup(data: BackupData): BackupSummary {
  return {
    exportedAt: data.exportedAt,
    goalName: data.goals[0]?.name ?? null,
    transactionCount: data.transactions.length,
    ruleCount: data.recurringRules.length,
    categoryCount: data.categories.length,
  };
}
