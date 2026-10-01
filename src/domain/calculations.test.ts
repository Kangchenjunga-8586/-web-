import { describe, expect, it } from 'vitest';
import { makeGoal, makeRule, makeTx } from '../test/fixtures';
import {
  assessPace,
  buildRateTable,
  computeCurrentSavings,
  computeDashboard,
  computeForecast,
  computeGoalMetrics,
  idealSavingsOn,
  monthlySeries,
  progressPercent,
  projectionSeries,
  ratesFromMonthly,
  requiredPerPeriod,
  rulePerDay,
  savingsHistory,
  summarizeMonth,
  sumTotals,
  totalsByCategory,
} from './calculations';
import type { Transaction } from './types';

const TODAY = '2026-09-30';

describe('goal metrics', () => {
  it('computes progress percentage (258/450 example → 58%)', () => {
    expect(progressPercent(260_000, 450_000)).toBe(58);
    expect(progressPercent(0, 450_000)).toBe(0);
    expect(progressPercent(449_999, 450_000)).toBe(99); // never 100% before reaching the goal
    expect(progressPercent(450_000, 450_000)).toBe(100);
    expect(progressPercent(-5_000, 450_000)).toBe(0);
  });

  it('computes current savings, remaining amount and required monthly/weekly savings', () => {
    const goal = makeGoal({ startDate: '2026-09-01' });
    const txs = [
      makeTx({ type: 'income', amount: 80_000, date: '2026-09-25' }),
      makeTx({ type: 'expense', amount: 20_000, date: '2026-09-26' }),
    ];
    const m = computeGoalMetrics(goal, txs, TODAY);
    expect(m.currentSavings).toBe(260_000);
    expect(m.remainingAmount).toBe(190_000);
    expect(m.progressPercent).toBe(58);
    expect(m.daysRemaining).toBe(183);
    // 190,000 / (183 / 30.436875 months) = 31,601.13 → ceil
    expect(m.requiredSavingsPerMonth).toBe(31_602);
    // 190,000 / (183 / 7 weeks) = 7,267.76 → ceil
    expect(m.requiredSavingsPerWeek).toBe(7_268);
    // 190,000 / 183 days = 1,038.25 → ceil
    expect(m.requiredSavingsPerDay).toBe(1_039);
    expect(m.achieved).toBe(false);
    expect(m.targetDatePassed).toBe(false);
  });

  it('with no transactions, savings equal the initial amount', () => {
    const m = computeGoalMetrics(makeGoal(), [], TODAY);
    expect(m.currentSavings).toBe(200_000);
    expect(m.remainingAmount).toBe(250_000);
  });

  it('handles an exceeded target', () => {
    const goal = makeGoal({ initialSavings: 500_000 });
    const m = computeGoalMetrics(goal, [], TODAY);
    expect(m.achieved).toBe(true);
    expect(m.remainingAmount).toBe(0);
    expect(m.progressPercent).toBe(100);
    expect(m.progressRatio).toBe(1);
    expect(m.requiredSavingsPerMonth).toBe(0);
    expect(m.requiredSavingsPerWeek).toBe(0);
  });

  it('handles a passed target date (everything is due now)', () => {
    const goal = makeGoal({ targetDate: '2026-09-01' });
    const m = computeGoalMetrics(goal, [], TODAY);
    expect(m.targetDatePassed).toBe(true);
    expect(m.daysRemaining).toBe(-29);
    expect(m.requiredSavingsPerMonth).toBe(250_000);
    expect(m.requiredSavingsPerWeek).toBe(250_000);
  });

  it('handles a zero target', () => {
    const goal = makeGoal({ targetAmount: 0, initialSavings: 0 });
    const m = computeGoalMetrics(goal, [], TODAY);
    expect(m.achieved).toBe(true);
    expect(m.progressPercent).toBe(100);
    expect(m.remainingAmount).toBe(0);
  });

  it('handles negative savings', () => {
    const goal = makeGoal({ initialSavings: 0, startDate: '2026-09-01' });
    const m = computeGoalMetrics(goal, [makeTx({ amount: 30_000, date: '2026-09-10' })], TODAY);
    expect(m.currentSavings).toBe(-30_000);
    expect(m.remainingAmount).toBe(480_000);
    expect(m.progressPercent).toBe(0);
    expect(m.progressRatio).toBe(0);
  });

  it('only counts transactions between the start date and today', () => {
    const goal = makeGoal({ startDate: '2026-09-10' });
    const txs = [
      makeTx({ amount: 5_000, date: '2026-09-09' }), // before start: already in initial savings
      makeTx({ amount: 1_000, date: '2026-09-10' }),
      makeTx({ amount: 7_000, date: '2026-10-05' }), // future-dated
    ];
    expect(computeCurrentSavings(goal, txs, TODAY)).toBe(199_000);
  });

  it('requires at least one full period when less than a month/week remains', () => {
    expect(requiredPerPeriod(10_000, 10, 30.436875)).toBe(10_000);
    expect(requiredPerPeriod(10_000, 3, 7)).toBe(10_000);
    expect(requiredPerPeriod(0, 100, 7)).toBe(0);
  });

  it('computes the ideal straight-line pace', () => {
    const goal = makeGoal({ startDate: '2026-01-01', targetDate: '2026-12-31', initialSavings: 0, targetAmount: 364_000 });
    expect(idealSavingsOn(goal, '2026-01-01')).toBe(0);
    expect(idealSavingsOn(goal, '2026-07-02')).toBe(182_000);
    expect(idealSavingsOn(goal, '2027-06-01')).toBe(364_000);
  });
});

describe('aggregation', () => {
  const txs = [
    makeTx({ type: 'income', amount: 60_000, date: '2026-08-25', categoryId: 'inc-job' }),
    makeTx({ type: 'expense', amount: 1_200, date: '2026-08-03', categoryId: 'exp-food' }),
    makeTx({ type: 'expense', amount: 800, date: '2026-09-03', categoryId: 'exp-food' }),
    makeTx({ type: 'expense', amount: 3_000, date: '2026-09-05', categoryId: 'exp-hobby' }),
    makeTx({ type: 'income', amount: 5_000, date: '2026-09-15', categoryId: 'inc-allowance' }),
  ];

  it('aggregates income and expenses', () => {
    expect(sumTotals(txs)).toEqual({ income: 65_000, expense: 5_000, net: 60_000 });
    expect(sumTotals([])).toEqual({ income: 0, expense: 0, net: 0 });
  });

  it('aggregates by month', () => {
    expect(summarizeMonth(txs, '2026-09')).toEqual({ month: '2026-09', income: 5_000, expense: 3_800, net: 1_200 });
    expect(monthlySeries(txs, '2026-09', 3)).toEqual([
      { month: '2026-07', income: 0, expense: 0, net: 0 },
      { month: '2026-08', income: 60_000, expense: 1_200, net: 58_800 },
      { month: '2026-09', income: 5_000, expense: 3_800, net: 1_200 },
    ]);
  });

  it('aggregates by category, largest first', () => {
    const expenses = txs.filter((t) => t.type === 'expense');
    expect(totalsByCategory(expenses)).toEqual([
      { categoryId: 'exp-hobby', amount: 3_000, count: 1 },
      { categoryId: 'exp-food', amount: 2_000, count: 2 },
    ]);
  });
});

describe('forecast', () => {
  // Recording started 2026-06-01 → 90 days of history available on 2026-09-30.
  const goal = makeGoal({ startDate: TODAY, createdAt: '2026-06-01T00:00:00.000Z' });
  const payday = makeRule({ id: 'job', amount: 60_000, dayOfMonth: 25, startDate: '2026-01-01' });

  it('reports insufficient data instead of inventing numbers', () => {
    const fresh = makeGoal({ startDate: TODAY, createdAt: '2026-09-30T01:00:00.000Z' });
    const f = computeForecast(fresh, [], [payday], TODAY);
    expect(f.status).toBe('insufficient-data');
    expect(f.daysUntilReady).toBe(29);
    expect(f.estimatedCompletionDate).toBeNull();
    expect(f.projectedBalanceAtTargetDate).toBeNull();
    expect(f.averageMonthlyNetSavings).toBeNull();
    expect(f.recurringIncomeMonthly).toBe(60_000);
  });

  it('estimates completion from recurring income when history is sufficient', () => {
    const f = computeForecast(goal, [], [payday], TODAY);
    expect(f.status).toBe('ok');
    expect(f.historyDays).toBe(90);
    expect(f.averageMonthlyIncome).toBe(60_000);
    expect(f.averageMonthlyExpenses).toBe(0);
    // 200k + 60k × 5 paydays (Oct–Feb) reaches 450k on 2027-02-25.
    expect(f.estimatedCompletionDate).toBe('2027-02-25');
    // Oct–Mar = 6 paydays before 2027-04-01.
    expect(f.projectedBalanceAtTargetDate).toBe(560_000);
  });

  it('includes recent variable expenses (3-month average)', () => {
    const txs = [makeTx({ type: 'expense', amount: 90_000, date: '2026-08-01' })]; // = ¥1,000/day
    const f = computeForecast(goal, txs, [payday], TODAY);
    expect(f.variableExpenseMonthly).toBe(30_437);
    expect(f.averageMonthlyNetSavings).toBe(29_563);
    expect(f.projectedBalanceAtTargetDate).toBe(377_000); // 200k + 360k − 183 × 1k
    expect(f.estimatedCompletionDate).toBe('2027-06-25');
  });

  it('never shows a completion date when average net savings are not positive', () => {
    const rent = makeRule({ id: 'big', type: 'expense', amount: 70_000, dayOfMonth: 1, startDate: '2026-01-01' });
    const f = computeForecast(goal, [], [payday, rent], TODAY);
    expect(f.averageMonthlyNetSavings).toBeLessThanOrEqual(0);
    expect(f.estimatedCompletionDate).toBeNull();
  });

  it('already achieved goals complete today', () => {
    const rich = makeGoal({ initialSavings: 460_000, startDate: TODAY, createdAt: '2026-09-30T01:00:00.000Z' });
    expect(computeForecast(rich, [], [], TODAY).estimatedCompletionDate).toBe(TODAY);
  });

  it('ignores disabled and ended rules in projections', () => {
    const ended = makeRule({ id: 'x', amount: 100_000, dayOfMonth: 5, startDate: '2026-01-01', endDate: '2026-10-31' });
    const disabled = makeRule({ id: 'y', amount: 100_000, dayOfMonth: 6, startDate: '2026-01-01', enabled: false });
    const f = computeForecast(goal, [], [ended, disabled], TODAY);
    expect(f.recurringIncomeMonthly).toBe(Math.round(100_000 / 12));
    expect(f.projectedBalanceAtTargetDate).toBe(300_000);
  });
});

describe('pace assessment', () => {
  const goal = makeGoal({ startDate: TODAY, createdAt: '2026-06-01T00:00:00.000Z' });
  const payday = makeRule({ id: 'job', amount: 60_000, dayOfMonth: 25, startDate: '2026-01-01' });

  function assess(g = goal, txs: Transaction[] = [], rules = [payday], today = TODAY) {
    const metrics = computeGoalMetrics(g, txs, today);
    const forecast = computeForecast(g, txs, rules, today);
    return assessPace(g, metrics, forecast, today);
  }

  it('on track when the projection reaches the target', () => {
    const p = assess();
    expect(p.status).toBe('on-track');
    expect(p.headline).toBe('順調です');
    expect(p.basis).toBe('forecast');
    expect(p.reasons.join('')).toContain('2027/02/25');
  });

  it('behind with a concrete monthly saving suggestion', () => {
    const txs = [makeTx({ type: 'expense', amount: 90_000, date: '2026-08-01' })];
    const p = assess(goal, txs);
    expect(p.status).toBe('behind');
    expect(p.headline).toBe('現在のペースでは目標日を超える見込みです');
    expect(p.shortfall).toBe(73_000);
    expect(p.extraSavingsPerMonth).toBe(12_142);
    expect(p.reasons.join('')).toContain('毎月あと ¥12,142 節約すると目標ペースです');
  });

  it('slightly behind when the shortfall is within 10% of the target', () => {
    const txs = [makeTx({ type: 'expense', amount: 45_000, date: '2026-08-01' })]; // ¥500/day
    const p = assess(goal, txs);
    // 200k + 360k − 91.5k = 468.5k ≥ 450k → on track; use a smaller payday to land just short.
    expect(p.status).toBe('on-track');
    const smaller = makeRule({ id: 'job2', amount: 55_000, dayOfMonth: 25, startDate: '2026-01-01' });
    const p2 = assess(goal, txs, [smaller]);
    // 200k + 330k − 91.5k = 438.5k → 11.5k short (≤ 45k)
    expect(p2.status).toBe('slightly-behind');
    expect(p2.headline).toBe('目標ペースを少し下回っています');
  });

  it('achieved and overdue states', () => {
    expect(assess(makeGoal({ initialSavings: 450_000 })).status).toBe('achieved');
    const overdue = assess(makeGoal({ targetDate: '2026-09-01', createdAt: '2026-06-01T00:00:00.000Z' }));
    expect(overdue.status).toBe('overdue');
    expect(overdue.headline).toBe('購入目標日を過ぎています');
  });

  it('falls back to the ideal pace when history is insufficient', () => {
    const fresh = makeGoal({ startDate: '2026-09-20', createdAt: '2026-09-20T01:00:00.000Z' });
    const p = assess(fresh, [makeTx({ amount: 50_000, date: '2026-09-21' })]);
    expect(p.basis).toBe('pace');
    expect(p.status).toBe('behind');
    expect(p.reasons.some((r) => r.includes('30日分'))).toBe(true);
  });
});

describe('rate table (1日 / 1週 / 1か月)', () => {
  // 1 month = 30.436875 days.
  const rules = [
    makeRule({ id: 'job', name: 'アルバイト', amount: 62_000, dayOfMonth: 25, startDate: '2026-01-01' }),
    makeRule({ id: 'pocket', name: 'お小遣い', amount: 5_000, dayOfMonth: 1, startDate: '2026-01-01' }),
    makeRule({ id: 'phone', type: 'expense', name: 'スマホ代', amount: 2_980, categoryId: 'exp-subscription', dayOfMonth: 27, startDate: '2026-01-01' }),
    makeRule({ id: 'ai', type: 'expense', name: 'Claude Pro', amount: 3_000, categoryId: 'exp-subscription', dayOfMonth: 12, startDate: '2026-01-01' }),
  ];

  function table(goal = makeGoal({ startDate: TODAY, createdAt: '2026-06-01T00:00:00.000Z' }), txs: Transaction[] = [], rs = rules) {
    const metrics = computeGoalMetrics(goal, txs, TODAY);
    const forecast = computeForecast(goal, txs, rs, TODAY);
    return buildRateTable(metrics, forecast, rs, TODAY);
  }

  it('splits monthly amounts into per-day and per-week figures', () => {
    // 62,000 / 30.436875 = 2,037.00 /日, ×7 = 14,259.0 /週
    expect(ratesFromMonthly(62_000)).toEqual({ day: 2_037, week: 14_259, month: 62_000 });
    expect(ratesFromMonthly(-30_437)).toEqual({ day: -1_000, week: -7_000, month: -30_437 });
    expect(ratesFromMonthly(0)).toEqual({ day: 0, week: 0, month: 0 });
  });

  it('uses the nominal frequency so weekly and yearly rules read naturally', () => {
    expect(rulePerDay({ frequency: 'weekly', amount: 1_000 }) * 7).toBeCloseTo(1_000);
    const weekly = makeRule({ id: 'w', name: '週払い', frequency: 'weekly', dayOfWeek: 5, amount: 1_000, startDate: '2026-01-01' });
    const yearly = makeRule({ id: 'y', name: 'ボーナス', frequency: 'yearly', month: 12, dayOfMonth: 10, amount: 120_000, startDate: '2026-01-01' });
    const t = table(undefined, [], [weekly, yearly]);
    expect(t.recurringIncome.rules).toEqual([
      // 120,000 / 12 = 10,000 /月 → 328.55 /日 → 2,299.85 /週
      { ruleId: 'y', name: 'ボーナス', cells: { day: 329, week: 2_300, month: 10_000 } },
      // 1,000 /週 → 142.86 /日 → 4,348.1 /月
      { ruleId: 'w', name: '週払い', cells: { day: 143, week: 1_000, month: 4_348 } },
    ]);
  });

  it('lists each recurring rule and totals that add up column by column', () => {
    const t = table(undefined, [makeTx({ type: 'expense', amount: 90_000, date: '2026-08-01' })]);
    expect(t.recurringIncome.rules.map((r) => [r.name, r.cells])).toEqual([
      ['アルバイト', { day: 2_037, week: 14_259, month: 62_000 }],
      ['お小遣い', { day: 164, week: 1_150, month: 5_000 }],
    ]);
    expect(t.recurringIncome.total).toEqual({ day: 2_201, week: 15_409, month: 67_000 });
    expect(t.recurringExpense.rules.map((r) => [r.name, r.cells])).toEqual([
      ['Claude Pro', { day: -99, week: -690, month: -3_000 }],
      ['スマホ代', { day: -98, week: -685, month: -2_980 }],
    ]);
    expect(t.recurringExpense.total).toEqual({ day: -197, week: -1_375, month: -5_980 });
    // 90,000 over 90 days of history = ¥1,000 per day of other spending.
    expect(t.variableExpense).toEqual({ day: -1_000, week: -7_000, month: -30_437 });
    expect(t.variableIncome).toEqual({ day: 0, week: 0, month: 0 });
    expect(t.netIncludesVariable).toBe(true);
    expect(t.net).toEqual({ day: 1_004, week: 7_034, month: 30_583 });
    // 250,000 remaining over 183 days.
    expect(t.required).toEqual({ day: 1_367, week: 9_563, month: 41_581 });
    expect(t.surplus).toEqual({ day: -363, week: -2_529, month: -10_998 });
  });

  it('shows recurring-only net and no surplus while history is insufficient', () => {
    const fresh = makeGoal({ startDate: TODAY, createdAt: '2026-09-30T01:00:00.000Z' });
    const t = table(fresh);
    expect(t.variableIncome).toBeNull();
    expect(t.variableExpense).toBeNull();
    expect(t.netIncludesVariable).toBe(false);
    expect(t.net).toEqual({ day: 2_004, week: 14_034, month: 61_020 });
    expect(t.required).not.toBeNull();
    expect(t.surplus).toBeNull();
    expect(t.daysUntilReady).toBe(29);
  });

  it('drops disabled and finished rules, and the requirement once achieved or overdue', () => {
    const ended = makeRule({ id: 'old', name: '旧バイト', amount: 50_000, dayOfMonth: 10, startDate: '2026-01-01', endDate: '2026-09-15' });
    const paused = makeRule({ id: 'p', name: '休止中', amount: 9_000, dayOfMonth: 10, startDate: '2026-01-01', enabled: false });
    const t = table(undefined, [], [ended, paused]);
    expect(t.recurringIncome.rules).toEqual([]);
    expect(t.recurringIncome.total).toEqual({ day: 0, week: 0, month: 0 });

    const achieved = table(makeGoal({ initialSavings: 500_000, startDate: TODAY, createdAt: '2026-06-01T00:00:00.000Z' }));
    expect(achieved.required).toBeNull();
    expect(achieved.surplus).toBeNull();
    const overdue = table(makeGoal({ startDate: '2026-06-01', targetDate: '2026-09-01', createdAt: '2026-06-01T00:00:00.000Z' }));
    expect(overdue.required).toBeNull();
  });
});

describe('chart series', () => {
  it('builds the actual savings history', () => {
    const goal = makeGoal({ startDate: '2026-09-01' });
    const txs = [
      makeTx({ type: 'income', amount: 10_000, date: '2026-09-05' }),
      makeTx({ type: 'expense', amount: 2_000, date: '2026-09-05' }),
      makeTx({ type: 'expense', amount: 1_000, date: '2026-09-20' }),
    ];
    expect(savingsHistory(goal, txs, TODAY)).toEqual([
      { date: '2026-09-01', balance: 200_000 },
      { date: '2026-09-05', balance: 208_000 },
      { date: '2026-09-20', balance: 207_000 },
      { date: '2026-09-30', balance: 207_000 },
    ]);
  });

  it('builds a projection only when a forecast exists', () => {
    const goal = makeGoal({ startDate: TODAY, createdAt: '2026-06-01T00:00:00.000Z' });
    const rule = makeRule({ amount: 60_000, dayOfMonth: 25, startDate: '2026-01-01' });
    const forecast = computeForecast(goal, [], [rule], TODAY);
    const series = projectionSeries(goal, [], [rule], forecast, TODAY);
    expect(series[0]).toEqual({ date: TODAY, balance: 200_000 });
    expect(series[series.length - 1]).toEqual({ date: '2027-04-01', balance: 560_000 });

    const fresh = makeGoal({ createdAt: '2026-09-30T01:00:00.000Z', startDate: TODAY });
    const f2 = computeForecast(fresh, [], [rule], TODAY);
    expect(projectionSeries(fresh, [], [rule], f2, TODAY)).toEqual([]);
  });

  it('bundles the dashboard', () => {
    const d = computeDashboard(makeGoal(), [makeTx({ amount: 500, date: TODAY })], [], TODAY);
    expect(d.thisMonth.expense).toBe(500);
    expect(d.metrics.currentSavings).toBe(199_500);
  });
});
