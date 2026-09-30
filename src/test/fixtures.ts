import type { Goal, RecurringRule, Transaction } from '../domain/types';

let seq = 0;

export function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    name: 'MacBook Pro',
    targetAmount: 450_000,
    initialSavings: 200_000,
    startDate: '2026-09-01',
    targetDate: '2027-04-01',
    createdAt: '2026-09-01T01:00:00.000Z',
    updatedAt: '2026-09-01T01:00:00.000Z',
    ...overrides,
  };
}

export function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `tx-${seq}`,
    type: 'expense',
    amount: 1000,
    categoryId: 'exp-food',
    date: '2026-09-10',
    memo: '',
    recurringRuleId: null,
    occurrenceDate: null,
    createdAt: '2026-09-10T03:00:00.000Z',
    updatedAt: '2026-09-10T03:00:00.000Z',
    ...overrides,
  };
}

export function makeRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  seq += 1;
  return {
    id: `rule-${seq}`,
    type: 'income',
    name: 'アルバイト',
    amount: 60_000,
    categoryId: 'inc-job',
    frequency: 'monthly',
    dayOfMonth: 25,
    dayOfWeek: 5,
    month: 1,
    startDate: '2026-09-01',
    endDate: null,
    enabled: true,
    generatedThrough: null,
    createdAt: '2026-09-01T01:00:00.000Z',
    updatedAt: '2026-09-01T01:00:00.000Z',
    ...overrides,
  };
}
