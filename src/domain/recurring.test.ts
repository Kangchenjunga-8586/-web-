import { describe, expect, it } from 'vitest';
import { makeRule } from '../test/fixtures';
import {
  applyRuleEdit,
  describeSchedule,
  nextOccurrence,
  occurrencesBetween,
  planRecurringGeneration,
  recurringNetBetween,
} from './recurring';
import type { RecurringRule, Transaction } from './types';

const NOW = '2026-09-30T00:00:00.000Z';

/** Simulates the store: add-if-absent by primary key, then advance watermarks. */
function applyPlan(
  store: Map<string, Transaction>,
  rules: RecurringRule[],
  today: string,
  trackingStart: string | null = null,
): RecurringRule[] {
  const plan = planRecurringGeneration(rules, today, trackingStart, NOW);
  for (const tx of plan.transactions) if (!store.has(tx.id)) store.set(tx.id, tx);
  return rules.map((r) => {
    const w = plan.watermarks.find((x) => x.ruleId === r.id);
    return w ? { ...r, generatedThrough: w.generatedThrough } : r;
  });
}

describe('occurrencesBetween', () => {
  it('monthly clamps day 31 to the end of shorter months', () => {
    const rule = makeRule({ frequency: 'monthly', dayOfMonth: 31, startDate: '2026-01-01' });
    expect(occurrencesBetween(rule, '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('weekly returns every matching weekday', () => {
    const rule = makeRule({ frequency: 'weekly', dayOfWeek: 5, startDate: '2026-09-01' }); // Fridays
    expect(occurrencesBetween(rule, '2026-09-01', '2026-09-30')).toEqual([
      '2026-09-04',
      '2026-09-11',
      '2026-09-18',
      '2026-09-25',
    ]);
  });

  it('yearly handles Feb 29 in non-leap years', () => {
    const rule = makeRule({ frequency: 'yearly', month: 2, dayOfMonth: 29, startDate: '2026-01-01' });
    expect(occurrencesBetween(rule, '2026-01-01', '2028-12-31')).toEqual(['2026-02-28', '2027-02-28', '2028-02-29']);
  });

  it('respects start and end dates', () => {
    const rule = makeRule({ dayOfMonth: 10, startDate: '2026-09-15', endDate: '2026-12-09' });
    expect(occurrencesBetween(rule, '2026-01-01', '2027-12-31')).toEqual(['2026-10-10', '2026-11-10']);
  });
});

describe('planRecurringGeneration', () => {
  it('generates due occurrences with deterministic ids', () => {
    const rule = makeRule({ id: 'job', dayOfMonth: 25, startDate: '2026-07-01' });
    const plan = planRecurringGeneration([rule], '2026-09-30', null, NOW);
    expect(plan.transactions.map((t) => t.id)).toEqual([
      'rec:job:2026-07-25',
      'rec:job:2026-08-25',
      'rec:job:2026-09-25',
    ]);
    expect(plan.transactions[0]).toMatchObject({
      type: 'income',
      amount: 60000,
      date: '2026-07-25',
      recurringRuleId: 'job',
      occurrenceDate: '2026-07-25',
      memo: 'アルバイト',
    });
    expect(plan.watermarks).toEqual([{ ruleId: 'job', generatedThrough: '2026-09-30' }]);
  });

  it('is idempotent: running twice never duplicates transactions', () => {
    const store = new Map<string, Transaction>();
    let rules = [makeRule({ id: 'job', dayOfMonth: 25, startDate: '2026-07-01' })];
    rules = applyPlan(store, rules, '2026-09-30');
    rules = applyPlan(store, rules, '2026-09-30');
    rules = applyPlan(store, rules, '2026-09-30');
    expect(store.size).toBe(3);
  });

  it('never duplicates even if the watermark update was lost (crash between writes)', () => {
    const store = new Map<string, Transaction>();
    const rules = [makeRule({ id: 'job', dayOfMonth: 25, startDate: '2026-07-01' })];
    applyPlan(store, rules, '2026-09-30'); // watermark result discarded
    applyPlan(store, rules, '2026-09-30'); // same original rules again
    expect(store.size).toBe(3);
    expect(new Set([...store.values()].map((t) => t.occurrenceDate)).size).toBe(3);
  });

  it('only generates new occurrences as days pass', () => {
    const store = new Map<string, Transaction>();
    let rules = [makeRule({ id: 'job', dayOfMonth: 25, startDate: '2026-09-01' })];
    rules = applyPlan(store, rules, '2026-09-24');
    expect(store.size).toBe(0);
    rules = applyPlan(store, rules, '2026-09-25');
    expect(store.size).toBe(1);
    rules = applyPlan(store, rules, '2026-10-24');
    expect(store.size).toBe(1);
    rules = applyPlan(store, rules, '2026-10-25');
    expect(store.size).toBe(2);
  });

  it('does not regenerate an occurrence the user deleted', () => {
    const store = new Map<string, Transaction>();
    let rules = [makeRule({ id: 'job', dayOfMonth: 25, startDate: '2026-09-01' })];
    rules = applyPlan(store, rules, '2026-09-30');
    store.delete('rec:job:2026-09-25');
    rules = applyPlan(store, rules, '2026-09-30');
    rules = applyPlan(store, rules, '2026-10-01');
    expect(store.has('rec:job:2026-09-25')).toBe(false);
  });

  it('does not back-fill before the goal tracking start', () => {
    const rule = makeRule({ id: 'job', dayOfMonth: 25, startDate: '2026-01-01' });
    const plan = planRecurringGeneration([rule], '2026-09-30', '2026-09-01', NOW);
    expect(plan.transactions.map((t) => t.date)).toEqual(['2026-09-25']);
  });

  it('skips disabled rules and future-starting rules', () => {
    const disabled = makeRule({ id: 'a', enabled: false, startDate: '2026-01-01' });
    const future = makeRule({ id: 'b', startDate: '2026-12-01' });
    const plan = planRecurringGeneration([disabled, future], '2026-09-30', null, NOW);
    expect(plan.transactions).toEqual([]);
    expect(plan.watermarks).toEqual([]);
  });

  it('handles expense rules', () => {
    const rule = makeRule({ id: 'phone', type: 'expense', amount: 3000, categoryId: 'exp-subscription', dayOfMonth: 1, startDate: '2026-09-01' });
    const plan = planRecurringGeneration([rule], '2026-09-30', null, NOW);
    expect(plan.transactions).toHaveLength(1);
    expect(plan.transactions[0]).toMatchObject({ type: 'expense', amount: 3000, date: '2026-09-01' });
  });
});

describe('applyRuleEdit', () => {
  it('new rules start with no watermark', () => {
    const rule = makeRule({ generatedThrough: '2026-09-01' });
    expect(applyRuleEdit(null, rule, '2026-09-30').generatedThrough).toBeNull();
  });

  it('re-enabling resumes from today instead of back-filling the paused period', () => {
    const prev = makeRule({ enabled: false, generatedThrough: '2026-06-30' });
    const next = applyRuleEdit(prev, { ...prev, enabled: true }, '2026-09-30');
    expect(next.generatedThrough).toBe('2026-09-29');
    const plan = planRecurringGeneration([next], '2026-09-30', null, NOW);
    expect(plan.transactions).toEqual([]);
  });

  it('keeps the watermark on normal edits', () => {
    const prev = makeRule({ generatedThrough: '2026-09-30' });
    expect(applyRuleEdit(prev, { ...prev, amount: 70000 }, '2026-09-30').generatedThrough).toBe('2026-09-30');
  });
});

describe('recurring helpers', () => {
  it('sums signed recurring amounts in a range', () => {
    const income = makeRule({ amount: 60000, dayOfMonth: 25, startDate: '2026-01-01' });
    const expense = makeRule({ type: 'expense', amount: 5000, dayOfMonth: 1, startDate: '2026-01-01' });
    // (2026-09-30, 2026-12-31]: income Oct/Nov/Dec 25 = 180000, expense Oct/Nov/Dec 1 = 15000
    expect(recurringNetBetween([income, expense], '2026-09-30', '2026-12-31')).toBe(165000);
  });

  it('describes schedules in Japanese', () => {
    expect(describeSchedule({ frequency: 'monthly', dayOfMonth: 25, dayOfWeek: 0, month: 1 })).toBe('毎月25日');
    expect(describeSchedule({ frequency: 'monthly', dayOfMonth: 31, dayOfWeek: 0, month: 1 })).toBe('毎月末日');
    expect(describeSchedule({ frequency: 'weekly', dayOfMonth: 1, dayOfWeek: 5, month: 1 })).toBe('毎週金曜日');
    expect(describeSchedule({ frequency: 'yearly', dayOfMonth: 1, dayOfWeek: 0, month: 4 })).toBe('毎年4月1日');
  });

  it('finds the next occurrence', () => {
    const rule = makeRule({ dayOfMonth: 25, startDate: '2026-01-01' });
    expect(nextOccurrence(rule, '2026-09-30')).toBe('2026-10-25');
    expect(nextOccurrence({ ...rule, enabled: false }, '2026-09-30')).toBeNull();
  });
});
