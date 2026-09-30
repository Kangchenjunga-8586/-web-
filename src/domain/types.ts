/**
 * Core data model. All money values are integer JPY (yen). All calendar dates are
 * 'YYYY-MM-DD' strings interpreted in Asia/Tokyo — never converted through UTC Date objects.
 * Timestamps (createdAt/updatedAt/exportedAt) are ISO-8601 instants.
 */

/** Calendar date 'YYYY-MM-DD' (Asia/Tokyo). */
export type ISODate = string;
/** ISO-8601 instant, e.g. new Date().toISOString(). */
export type Timestamp = string;
/** Integer yen. */
export type Yen = number;

export type TxType = 'income' | 'expense';

export interface Goal {
  id: string;
  /** 買いたい物 */
  name: string;
  targetAmount: Yen;
  /** 貯金開始日時点で既に貯まっている金額 */
  initialSavings: Yen;
  /** 貯金開始日. Transactions on/after this date count toward savings. */
  startDate: ISODate;
  /** 購入目標日 */
  targetDate: ISODate;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Transaction {
  id: string;
  type: TxType;
  /** Positive integer yen. Sign comes from `type`. */
  amount: Yen;
  categoryId: string;
  date: ISODate;
  memo: string;
  /** Set when auto-generated from a RecurringRule. */
  recurringRuleId: string | null;
  /** Occurrence date of the recurring rule this transaction was generated for. */
  occurrenceDate: ISODate | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type Frequency = 'monthly' | 'weekly' | 'yearly';

export interface RecurringRule {
  id: string;
  /** income = 定期収入, expense = 固定支出 */
  type: TxType;
  name: string;
  amount: Yen;
  categoryId: string;
  frequency: Frequency;
  /** monthly/yearly: 1-31. Clamped to the last day of shorter months. */
  dayOfMonth: number;
  /** weekly: 0 (Sun) - 6 (Sat). */
  dayOfWeek: number;
  /** yearly: 1-12. */
  month: number;
  startDate: ISODate;
  endDate: ISODate | null;
  enabled: boolean;
  /**
   * Occurrences on or before this date have already been processed (generated, or
   * intentionally skipped). Advancing this watermark is what keeps a transaction the
   * user deleted from being regenerated.
   */
  generatedThrough: ISODate | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Category {
  id: string;
  kind: TxType;
  name: string;
  emoji: string;
  order: number;
  /** Archived categories stay resolvable for old transactions but are hidden from pickers. */
  archived: boolean;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  id: 'app';
  theme: ThemePreference;
  lastBackupAt: Timestamp | null;
}

export const BACKUP_APP_ID = 'GoalBudget';
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupData {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: Timestamp;
  goals: Goal[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  categories: Category[];
  settings: AppSettings;
}

/** Everything the UI needs, loaded in one snapshot (single-user, small dataset). */
export interface AppSnapshot {
  goal: Goal | null;
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  categories: Category[];
  settings: AppSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  theme: 'system',
  lastBackupAt: null,
};
