import {
  addDays,
  daysInMonth,
  dayOfWeek,
  fromDayNumber,
  maxDate,
  minDate,
  monthKey,
  parseISODate,
  toDayNumber,
  toISODate,
  weekdayJa,
  addMonthsToKey,
} from './dates';
import { recurringTransactionId } from './id';
import type { ISODate, RecurringRule, Timestamp, Transaction } from './types';

/**
 * All occurrence dates of `rule` within [from, to] (inclusive), also bounded by the
 * rule's own startDate/endDate. Ignores `enabled` — callers decide what to do with it.
 */
export function occurrencesBetween(rule: RecurringRule, from: ISODate, to: ISODate): ISODate[] {
  const lo = maxDate(from, rule.startDate);
  const hi = rule.endDate ? minDate(to, rule.endDate) : to;
  if (lo > hi) return [];

  const result: ISODate[] = [];
  switch (rule.frequency) {
    case 'weekly': {
      const offset = (((rule.dayOfWeek - dayOfWeek(lo)) % 7) + 7) % 7;
      const hiNum = toDayNumber(hi);
      for (let d = toDayNumber(lo) + offset; d <= hiNum; d += 7) {
        result.push(fromDayNumber(d));
      }
      break;
    }
    case 'monthly': {
      const last = monthKey(hi);
      for (let key = monthKey(lo); key <= last; key = addMonthsToKey(key, 1)) {
        const [y, m] = key.split('-').map(Number) as [number, number];
        const date = toISODate(y, m, Math.min(rule.dayOfMonth, daysInMonth(y, m)));
        if (date >= lo && date <= hi) result.push(date);
      }
      break;
    }
    case 'yearly': {
      const fromYear = parseISODate(lo).year;
      const toYear = parseISODate(hi).year;
      for (let y = fromYear; y <= toYear; y++) {
        const date = toISODate(y, rule.month, Math.min(rule.dayOfMonth, daysInMonth(y, rule.month)));
        if (date >= lo && date <= hi) result.push(date);
      }
      break;
    }
  }
  return result;
}

export function buildRecurringTransaction(rule: RecurringRule, occurrenceDate: ISODate, now: Timestamp): Transaction {
  return {
    id: recurringTransactionId(rule.id, occurrenceDate),
    type: rule.type,
    amount: rule.amount,
    categoryId: rule.categoryId,
    date: occurrenceDate,
    memo: rule.name,
    recurringRuleId: rule.id,
    occurrenceDate,
    createdAt: now,
    updatedAt: now,
  };
}

export interface RecurringPlan {
  /** Candidate transactions. IDs are deterministic; the store must skip IDs that already exist. */
  transactions: Transaction[];
  /** New generatedThrough watermark per rule that advanced. */
  watermarks: { ruleId: string; generatedThrough: ISODate }[];
}

/**
 * Computes which recurring transactions are due (occurrence date <= today) and not yet
 * processed. Pure and idempotent: running it again after applying its result yields an
 * empty plan. `trackingStart` (the goal's 貯金開始日) prevents back-filling occurrences
 * that are already reflected in the goal's initial savings.
 */
export function planRecurringGeneration(
  rules: readonly RecurringRule[],
  today: ISODate,
  trackingStart: ISODate | null,
  now: Timestamp,
): RecurringPlan {
  const plan: RecurringPlan = { transactions: [], watermarks: [] };
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const from = rule.generatedThrough
      ? addDays(rule.generatedThrough, 1)
      : trackingStart
        ? maxDate(rule.startDate, trackingStart)
        : rule.startDate;
    if (from > today) continue;
    for (const date of occurrencesBetween(rule, from, today)) {
      plan.transactions.push(buildRecurringTransaction(rule, date, now));
    }
    plan.watermarks.push({ ruleId: rule.id, generatedThrough: today });
  }
  return plan;
}

/**
 * Applies edit semantics when a rule is saved. Re-enabling a paused rule resumes it from
 * today instead of back-filling the paused period.
 */
export function applyRuleEdit(prev: RecurringRule | null, next: RecurringRule, today: ISODate): RecurringRule {
  if (!prev) return { ...next, generatedThrough: null };
  let generatedThrough = prev.generatedThrough;
  if (!prev.enabled && next.enabled) {
    const yesterday = addDays(today, -1);
    generatedThrough = generatedThrough ? maxDate(generatedThrough, yesterday) : yesterday;
  }
  return { ...next, generatedThrough };
}

/** Sum of signed occurrence amounts in (after, through] for enabled rules. */
export function recurringNetBetween(rules: readonly RecurringRule[], after: ISODate, through: ISODate): number {
  if (through <= after) return 0;
  const from = addDays(after, 1);
  let total = 0;
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const n = occurrencesBetween(rule, from, through).length;
    total += (rule.type === 'income' ? 1 : -1) * n * rule.amount;
  }
  return total;
}

/** Daily signed deltas keyed by date for enabled rules in (after, through]. */
export function recurringDeltasByDate(
  rules: readonly RecurringRule[],
  after: ISODate,
  through: ISODate,
): Map<ISODate, number> {
  const deltas = new Map<ISODate, number>();
  if (through <= after) return deltas;
  const from = addDays(after, 1);
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const sign = rule.type === 'income' ? 1 : -1;
    for (const date of occurrencesBetween(rule, from, through)) {
      deltas.set(date, (deltas.get(date) ?? 0) + sign * rule.amount);
    }
  }
  return deltas;
}

/** Human readable schedule: 毎月25日 / 毎月末日 / 毎週金曜日 / 毎年4月1日 */
export function describeSchedule(rule: Pick<RecurringRule, 'frequency' | 'dayOfMonth' | 'dayOfWeek' | 'month'>): string {
  switch (rule.frequency) {
    case 'monthly':
      return rule.dayOfMonth >= 31 ? '毎月末日' : `毎月${rule.dayOfMonth}日`;
    case 'weekly':
      return `毎週${weekdayJa(rule.dayOfWeek)}曜日`;
    case 'yearly':
      return `毎年${rule.month}月${rule.dayOfMonth}日`;
  }
}

/** Next occurrence strictly after `after`, within the next ~2 years, or null. */
export function nextOccurrence(rule: RecurringRule, after: ISODate): ISODate | null {
  if (!rule.enabled) return null;
  const list = occurrencesBetween(rule, addDays(after, 1), addDays(after, 800));
  return list[0] ?? null;
}
