import {
  AVG_DAYS_PER_MONTH,
  addDays,
  addMonths,
  addMonthsToKey,
  diffDays,
  formatDateSlash,
  maxDate,
  minDate,
  monthKey,
  todayInTokyo,
  type MonthKey,
} from './dates';
import { ceilYen, formatYen } from './money';
import { occurrencesBetween, recurringDeltasByDate, recurringNetBetween } from './recurring';
import type { Goal, ISODate, RecurringRule, Transaction, Yen } from './types';

/** Minimum days of recorded history before variable spending is used for forecasts. */
export const MIN_HISTORY_DAYS = 30;
/** Variable income/expense averages use at most the last 90 days (≈ 3 months). */
export const HISTORY_WINDOW_DAYS = 90;
/** Forecast horizon when searching for the completion date (10 years). */
export const FORECAST_HORIZON_DAYS = 3653;
/** Projected shortfall up to 10% of the target price counts as "slightly behind". */
export const SLIGHTLY_BEHIND_RATIO = 0.1;

export function signedAmount(tx: Pick<Transaction, 'type' | 'amount'>): Yen {
  return tx.type === 'income' ? tx.amount : -tx.amount;
}

/** Transactions that count toward goal savings: goal.startDate <= date <= today. */
export function countsTowardSavings(tx: Transaction, goal: Goal, today: ISODate): boolean {
  return tx.date >= goal.startDate && tx.date <= today;
}

export function computeCurrentSavings(goal: Goal, transactions: readonly Transaction[], today: ISODate): Yen {
  let total = goal.initialSavings;
  for (const tx of transactions) {
    if (countsTowardSavings(tx, goal, today)) total += signedAmount(tx);
  }
  return total;
}

/**
 * Display percentage (integer 0-100). Rounds to nearest, but never shows 100% before the
 * goal is actually reached and never shows below 0.
 */
export function progressPercent(current: Yen, target: Yen): number {
  if (target <= 0) return 100;
  if (current >= target) return 100;
  if (current <= 0) return 0;
  return Math.min(99, Math.round((current * 100) / target));
}

/** Exact progress ratio clamped to [0, 1] (for progress bars). */
export function progressRatio(current: Yen, target: Yen): number {
  if (target <= 0) return 1;
  return Math.min(1, Math.max(0, current / target));
}

export interface GoalMetrics {
  currentSavings: Yen;
  remainingAmount: Yen;
  progressPercent: number;
  progressRatio: number;
  achieved: boolean;
  /** targetDate - today in days. Negative once the target date has passed. */
  daysRemaining: number;
  targetDatePassed: boolean;
  /** Fractional months until the target date (>= 0). */
  monthsRemaining: number;
  weeksRemaining: number;
  requiredSavingsPerMonth: Yen;
  requiredSavingsPerWeek: Yen;
  requiredSavingsPerDay: Yen;
  /** Where a straight line from (startDate, initialSavings) to (targetDate, target) is today. */
  idealSavingsToday: Yen;
}

export function requiredPerPeriod(remaining: Yen, daysRemaining: number, periodDays: number): Yen {
  if (remaining <= 0) return 0;
  if (daysRemaining <= 0) return remaining;
  const periods = daysRemaining / periodDays;
  return ceilYen(remaining / Math.max(1, periods));
}

export function idealSavingsOn(goal: Goal, date: ISODate): Yen {
  const total = diffDays(goal.startDate, goal.targetDate);
  if (total <= 0) return goal.targetAmount;
  const elapsed = Math.min(Math.max(diffDays(goal.startDate, date), 0), total);
  return Math.round(goal.initialSavings + ((goal.targetAmount - goal.initialSavings) * elapsed) / total);
}

export function computeGoalMetrics(goal: Goal, transactions: readonly Transaction[], today: ISODate): GoalMetrics {
  const currentSavings = computeCurrentSavings(goal, transactions, today);
  const remainingAmount = Math.max(0, goal.targetAmount - currentSavings);
  const daysRemaining = diffDays(today, goal.targetDate);
  const positiveDays = Math.max(0, daysRemaining);
  return {
    currentSavings,
    remainingAmount,
    progressPercent: progressPercent(currentSavings, goal.targetAmount),
    progressRatio: progressRatio(currentSavings, goal.targetAmount),
    achieved: currentSavings >= goal.targetAmount,
    daysRemaining,
    targetDatePassed: daysRemaining < 0,
    monthsRemaining: positiveDays / AVG_DAYS_PER_MONTH,
    weeksRemaining: positiveDays / 7,
    requiredSavingsPerMonth: requiredPerPeriod(remainingAmount, daysRemaining, AVG_DAYS_PER_MONTH),
    requiredSavingsPerWeek: requiredPerPeriod(remainingAmount, daysRemaining, 7),
    requiredSavingsPerDay: requiredPerPeriod(remainingAmount, daysRemaining, 1),
    idealSavingsToday: idealSavingsOn(goal, today),
  };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export interface Totals {
  income: Yen;
  expense: Yen;
  net: Yen;
}

export function sumTotals(transactions: Iterable<Transaction>): Totals {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.type === 'income') income += tx.amount;
    else expense += tx.amount;
  }
  return { income, expense, net: income - expense };
}

export interface MonthSummary extends Totals {
  month: MonthKey;
}

export function summarizeMonth(transactions: readonly Transaction[], month: MonthKey): MonthSummary {
  return { month, ...sumTotals(transactions.filter((tx) => monthKey(tx.date) === month)) };
}

/** `count` consecutive months ending at `endMonth`, oldest first. */
export function monthlySeries(transactions: readonly Transaction[], endMonth: MonthKey, count: number): MonthSummary[] {
  const buckets = new Map<MonthKey, Transaction[]>();
  for (const tx of transactions) {
    const key = monthKey(tx.date);
    const list = buckets.get(key);
    if (list) list.push(tx);
    else buckets.set(key, [tx]);
  }
  const series: MonthSummary[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const month = addMonthsToKey(endMonth, -i);
    series.push({ month, ...sumTotals(buckets.get(month) ?? []) });
  }
  return series;
}

export interface CategoryTotal {
  categoryId: string;
  amount: Yen;
  count: number;
}

export function totalsByCategory(transactions: readonly Transaction[]): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const tx of transactions) {
    const entry = map.get(tx.categoryId) ?? { categoryId: tx.categoryId, amount: 0, count: 0 };
    entry.amount += tx.amount;
    entry.count += 1;
    map.set(tx.categoryId, entry);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

// ---------------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------------

export interface Forecast {
  /** 'insufficient-data' when there is less than MIN_HISTORY_DAYS of recorded history. */
  status: 'ok' | 'insufficient-data';
  /** Days of history used for variable averages (<= HISTORY_WINDOW_DAYS). */
  historyDays: number;
  /** Days left until enough history exists (0 when ok). */
  daysUntilReady: number;
  recurringIncomeMonthly: Yen;
  recurringExpenseMonthly: Yen;
  variableIncomeMonthly: Yen | null;
  variableExpenseMonthly: Yen | null;
  averageMonthlyIncome: Yen | null;
  averageMonthlyExpenses: Yen | null;
  averageMonthlyNetSavings: Yen | null;
  /** First date the projected balance reaches the target. null = not reachable / unknown. */
  estimatedCompletionDate: ISODate | null;
  projectedBalanceAtTargetDate: Yen | null;
}

/** First calendar date the user started recording in the app. */
export function historyStartDate(goal: Goal, transactions: readonly Transaction[]): ISODate {
  let start = todayInTokyo(new Date(goal.createdAt));
  for (const tx of transactions) {
    if (tx.recurringRuleId === null && tx.date < start) start = tx.date;
  }
  return start;
}

interface ProjectionModel {
  today: ISODate;
  current: Yen;
  variableNetPerDay: number;
  rules: readonly RecurringRule[];
}

function projectBalance(model: ProjectionModel, date: ISODate): number {
  if (date <= model.today) return model.current;
  return (
    model.current +
    recurringNetBetween(model.rules, model.today, date) +
    model.variableNetPerDay * diffDays(model.today, date)
  );
}

export function computeForecast(
  goal: Goal,
  transactions: readonly Transaction[],
  rules: readonly RecurringRule[],
  today: ISODate,
): Forecast {
  const current = computeCurrentSavings(goal, transactions, today);

  // Recurring: average over the next 12 months (respects start/end dates and frequency).
  const in12Months = addMonths(today, 12);
  const incomeRules = rules.filter((r) => r.type === 'income');
  const expenseRules = rules.filter((r) => r.type === 'expense');
  const recurringIncomeMonthly = Math.round(recurringNetBetween(incomeRules, today, in12Months) / 12);
  const recurringExpenseMonthly = Math.round(-recurringNetBetween(expenseRules, today, in12Months) / 12);

  // Variable (manually entered) income/expenses over the recent window.
  const historyStart = minDate(historyStartDate(goal, transactions), today);
  const windowStart = maxDate(historyStart, addDays(today, -(HISTORY_WINDOW_DAYS - 1)));
  const historyDays = diffDays(windowStart, today) + 1;
  const base = {
    historyDays,
    recurringIncomeMonthly,
    recurringExpenseMonthly,
  };

  if (historyDays < MIN_HISTORY_DAYS) {
    return {
      ...base,
      status: 'insufficient-data',
      daysUntilReady: MIN_HISTORY_DAYS - historyDays,
      variableIncomeMonthly: null,
      variableExpenseMonthly: null,
      averageMonthlyIncome: null,
      averageMonthlyExpenses: null,
      averageMonthlyNetSavings: null,
      estimatedCompletionDate: current >= goal.targetAmount ? today : null,
      projectedBalanceAtTargetDate: null,
    };
  }

  const windowTotals = sumTotals(
    transactions.filter((tx) => tx.recurringRuleId === null && tx.date >= windowStart && tx.date <= today),
  );
  const perDayToMonthly = AVG_DAYS_PER_MONTH / historyDays;
  const variableIncomeMonthly = Math.round(windowTotals.income * perDayToMonthly);
  const variableExpenseMonthly = Math.round(windowTotals.expense * perDayToMonthly);
  const averageMonthlyIncome = recurringIncomeMonthly + variableIncomeMonthly;
  const averageMonthlyExpenses = recurringExpenseMonthly + variableExpenseMonthly;
  const averageMonthlyNetSavings = averageMonthlyIncome - averageMonthlyExpenses;

  const model: ProjectionModel = {
    today,
    current,
    variableNetPerDay: windowTotals.net / historyDays,
    rules,
  };

  return {
    ...base,
    status: 'ok',
    daysUntilReady: 0,
    variableIncomeMonthly,
    variableExpenseMonthly,
    averageMonthlyIncome,
    averageMonthlyExpenses,
    averageMonthlyNetSavings,
    estimatedCompletionDate: estimateCompletionDate(model, goal.targetAmount, averageMonthlyNetSavings),
    projectedBalanceAtTargetDate: Math.round(projectBalance(model, goal.targetDate)),
  };
}

function estimateCompletionDate(model: ProjectionModel, target: Yen, monthlyNet: Yen): ISODate | null {
  if (model.current >= target) return model.today;
  // Never invent a completion date when the average trend is not positive.
  if (monthlyNet <= 0) return null;
  const horizon = addDays(model.today, FORECAST_HORIZON_DAYS);
  const deltas = recurringDeltasByDate(model.rules, model.today, horizon);
  let balance = model.current;
  for (let i = 1; i <= FORECAST_HORIZON_DAYS; i++) {
    const date = addDays(model.today, i);
    balance += (deltas.get(date) ?? 0) + model.variableNetPerDay;
    if (balance >= target) return date;
  }
  return null;
}

// ---------------------------------------------------------------------------
// On-track assessment
// ---------------------------------------------------------------------------

export type PaceStatus = 'achieved' | 'on-track' | 'slightly-behind' | 'behind' | 'overdue';

export interface PaceAssessment {
  status: PaceStatus;
  /** forecast = based on projected balance; pace = actual vs ideal line (not enough history yet). */
  basis: 'forecast' | 'pace' | 'none';
  headline: string;
  reasons: string[];
  /** Expected shortfall at the target date (0 if none). */
  shortfall: Yen;
  /** 毎月あと¥X 貯める（節約する）と目標ペース. null when not applicable. */
  extraSavingsPerMonth: Yen | null;
}

export const PACE_HEADLINES: Record<PaceStatus, string> = {
  achieved: '目標達成！',
  'on-track': '順調です',
  'slightly-behind': '目標ペースを少し下回っています',
  behind: '現在のペースでは目標日を超える見込みです',
  overdue: '購入目標日を過ぎています',
};

function monthsBetween(from: ISODate, to: ISODate): number {
  return diffDays(from, to) / AVG_DAYS_PER_MONTH;
}

function describeDelay(targetDate: ISODate, estimate: ISODate): string {
  const months = monthsBetween(targetDate, estimate);
  if (months < 1) return `目標日の約${Math.max(1, diffDays(targetDate, estimate))}日後`;
  return `目標日の約${Math.round(months)}か月後`;
}

export function assessPace(goal: Goal, metrics: GoalMetrics, forecast: Forecast, today: ISODate): PaceAssessment {
  if (metrics.achieved) {
    return {
      status: 'achieved',
      basis: 'none',
      headline: PACE_HEADLINES.achieved,
      reasons: [`目標額 ${formatYen(goal.targetAmount)} に到達しました。`],
      shortfall: 0,
      extraSavingsPerMonth: null,
    };
  }

  if (today > goal.targetDate) {
    const reasons = [`目標日 ${formatDateSlash(goal.targetDate)} の時点で ${formatYen(metrics.remainingAmount)} 足りていません。`];
    if (forecast.estimatedCompletionDate) {
      reasons.push(`今のペースなら ${formatDateSlash(forecast.estimatedCompletionDate)} ごろ達成見込みです。`);
    }
    reasons.push('プランから目標日を見直せます。');
    return {
      status: 'overdue',
      basis: forecast.status === 'ok' ? 'forecast' : 'none',
      headline: PACE_HEADLINES.overdue,
      reasons,
      shortfall: metrics.remainingAmount,
      extraSavingsPerMonth: null,
    };
  }

  const threshold = Math.max(1, ceilYen(goal.targetAmount * SLIGHTLY_BEHIND_RATIO));
  const monthsLeft = Math.max(1, metrics.monthsRemaining);

  if (forecast.status === 'ok' && forecast.projectedBalanceAtTargetDate !== null) {
    const projected = forecast.projectedBalanceAtTargetDate;
    const shortfall = Math.max(0, goal.targetAmount - projected);
    const reasons: string[] = [];
    if (shortfall === 0) {
      reasons.push(
        `今のペースなら目標日に ${formatYen(projected)}（目標より ${formatYen(projected - goal.targetAmount)} 多い）の見込みです。`,
      );
      if (forecast.estimatedCompletionDate) {
        reasons.push(`予測達成日は ${formatDateSlash(forecast.estimatedCompletionDate)} です。`);
      }
      return {
        status: 'on-track',
        basis: 'forecast',
        headline: PACE_HEADLINES['on-track'],
        reasons,
        shortfall: 0,
        extraSavingsPerMonth: null,
      };
    }
    const extra = ceilYen(shortfall / monthsLeft);
    reasons.push(`目標日の予測額は ${formatYen(projected)} で、${formatYen(shortfall)} 不足する見込みです。`);
    if (forecast.estimatedCompletionDate) {
      reasons.push(
        `予測達成日は ${formatDateSlash(forecast.estimatedCompletionDate)}（${describeDelay(goal.targetDate, forecast.estimatedCompletionDate)}）です。`,
      );
    } else if ((forecast.averageMonthlyNetSavings ?? 0) <= 0) {
      reasons.push('平均の収支がプラスになっていないため、このままでは貯金が増えません。');
    }
    reasons.push(`毎月あと ${formatYen(extra)} 節約すると目標ペースです。`);
    const status: PaceStatus = shortfall <= threshold ? 'slightly-behind' : 'behind';
    return { status, basis: 'forecast', headline: PACE_HEADLINES[status], reasons, shortfall, extraSavingsPerMonth: extra };
  }

  // Not enough history for a forecast yet: compare with the ideal straight-line pace.
  const gap = metrics.idealSavingsToday - metrics.currentSavings;
  const now = formatYen(metrics.currentSavings);
  const ideal = formatYen(metrics.idealSavingsToday);
  let status: PaceStatus;
  let lead: string;
  if (today <= goal.startDate && gap <= 0) {
    status = 'on-track';
    lead = `貯金スタートです。毎月 ${formatYen(metrics.requiredSavingsPerMonth)} ずつ貯めれば目標日に間に合います。`;
  } else if (gap < 0) {
    status = 'on-track';
    lead = `理想ペースより ${formatYen(-gap)} 先行しています（現在 ${now} / 理想 ${ideal}）。`;
  } else if (gap === 0) {
    status = 'on-track';
    lead = `理想ペースどおりです（現在 ${now}）。`;
  } else {
    status = gap <= threshold ? 'slightly-behind' : 'behind';
    lead = `理想ペースより ${formatYen(gap)} 遅れています（現在 ${now} / 理想 ${ideal}）。`;
  }
  const reasons = [lead, `予測は記録が${MIN_HISTORY_DAYS}日分たまると表示されます（あと${forecast.daysUntilReady}日）。`];
  return {
    status,
    basis: 'pace',
    headline: PACE_HEADLINES[status],
    reasons,
    shortfall: Math.max(0, gap),
    extraSavingsPerMonth: gap > 0 ? ceilYen(gap / monthsLeft) : null,
  };
}

// ---------------------------------------------------------------------------
// Chart series
// ---------------------------------------------------------------------------

export interface SavingsPoint {
  date: ISODate;
  balance: Yen;
}

const MAX_HISTORY_POINTS = 160;

/** End-of-day savings balance for each day with activity, from startDate to today. */
export function savingsHistory(goal: Goal, transactions: readonly Transaction[], today: ISODate): SavingsPoint[] {
  const end = maxDate(goal.startDate, today);
  const deltas = new Map<ISODate, number>();
  for (const tx of transactions) {
    if (!countsTowardSavings(tx, goal, today)) continue;
    deltas.set(tx.date, (deltas.get(tx.date) ?? 0) + signedAmount(tx));
  }
  const dates = [...deltas.keys()].sort();
  const points: SavingsPoint[] = [];
  let balance = goal.initialSavings;
  if (!deltas.has(goal.startDate)) points.push({ date: goal.startDate, balance });
  for (const date of dates) {
    balance += deltas.get(date)!;
    points.push({ date, balance });
  }
  if (points[points.length - 1]!.date !== end) points.push({ date: end, balance });
  return downsample(points, MAX_HISTORY_POINTS);
}

function downsample(points: SavingsPoint[], max: number): SavingsPoint[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const result: SavingsPoint[] = [];
  for (let i = 0; i < max; i++) result.push(points[Math.round(i * step)]!);
  return result;
}

/** Projected balance from today to the target date (monthly points), when a forecast exists. */
export function projectionSeries(
  goal: Goal,
  transactions: readonly Transaction[],
  rules: readonly RecurringRule[],
  forecast: Forecast,
  today: ISODate,
): SavingsPoint[] {
  if (forecast.status !== 'ok' || goal.targetDate <= today) return [];
  const windowStart = maxDate(
    minDate(historyStartDate(goal, transactions), today),
    addDays(today, -(HISTORY_WINDOW_DAYS - 1)),
  );
  const windowTotals = sumTotals(
    transactions.filter((tx) => tx.recurringRuleId === null && tx.date >= windowStart && tx.date <= today),
  );
  const model: ProjectionModel = {
    today,
    current: computeCurrentSavings(goal, transactions, today),
    variableNetPerDay: windowTotals.net / forecast.historyDays,
    rules,
  };
  const points: SavingsPoint[] = [{ date: today, balance: model.current }];
  for (let date = addMonths(today, 1); date < goal.targetDate; date = addMonths(date, 1)) {
    points.push({ date, balance: Math.round(projectBalance(model, date)) });
  }
  points.push({ date: goal.targetDate, balance: Math.round(projectBalance(model, goal.targetDate)) });
  return points;
}

// ---------------------------------------------------------------------------
// Rate table (1日 / 1週 / 1か月)
// ---------------------------------------------------------------------------

/** Signed integer yen per day / week / month. */
export interface RateCells {
  day: Yen;
  week: Yen;
  month: Yen;
}

/**
 * Splits a monthly amount into per-day and per-week figures. One month is the average
 * Gregorian month (30.436875 days), the same basis as the forecast. Rounded per cell.
 */
export function ratesFromMonthly(monthly: number): RateCells {
  return cellsFromPerDay(monthly / AVG_DAYS_PER_MONTH);
}

function addCells(a: RateCells, b: RateCells): RateCells {
  return { day: a.day + b.day, week: a.week + b.week, month: a.month + b.month };
}

function subCells(a: RateCells, b: RateCells): RateCells {
  return { day: a.day - b.day, week: a.week - b.week, month: a.month - b.month };
}

const ZERO_CELLS: RateCells = { day: 0, week: 0, month: 0 };

export interface RateRuleRow {
  ruleId: string;
  name: string;
  /** Signed: income positive, expense negative. */
  cells: RateCells;
}

export interface RateGroup {
  /** Column-wise sum of the rule rows, so the table always adds up. */
  total: RateCells;
  rules: RateRuleRow[];
}

export interface RateTable {
  recurringIncome: RateGroup;
  recurringExpense: RateGroup;
  /** Average of manually recorded income/expense; null until enough history exists. */
  variableIncome: RateCells | null;
  variableExpense: RateCells | null;
  /** Sum of the rows above (variable rows count as 0 while null). */
  net: RateCells;
  netIncludesVariable: boolean;
  /** What must be saved to hit the target date; null when achieved or the date has passed. */
  required: RateCells | null;
  /** net − required (positive = 余裕, negative = 不足); only with a full forecast. */
  surplus: RateCells | null;
  historyDays: number;
  daysUntilReady: number;
}

/**
 * Nominal per-day amount of a rule from its frequency, so a weekly ¥1,000 rule reads exactly
 * ¥1,000 / 1週 and a monthly ¥62,000 rule exactly ¥62,000 / 1か月.
 */
export function rulePerDay(rule: Pick<RecurringRule, 'frequency' | 'amount'>): number {
  switch (rule.frequency) {
    case 'weekly':
      return rule.amount / 7;
    case 'monthly':
      return rule.amount / AVG_DAYS_PER_MONTH;
    case 'yearly':
      return rule.amount / 12 / AVG_DAYS_PER_MONTH;
  }
}

/** A rule counts while it is enabled and still has an occurrence within the next 12 months. */
export function ruleIsActive(rule: RecurringRule, today: ISODate): boolean {
  return rule.enabled && occurrencesBetween(rule, addDays(today, 1), addMonths(today, 12)).length > 0;
}

function cellsFromPerDay(perDay: number): RateCells {
  return {
    day: Math.round(perDay) + 0,
    week: Math.round(perDay * 7) + 0,
    month: Math.round(perDay * AVG_DAYS_PER_MONTH) + 0,
  };
}

function rateGroup(rules: readonly RecurringRule[], today: ISODate, sign: 1 | -1): RateGroup {
  const rows: RateRuleRow[] = rules
    .filter((rule) => ruleIsActive(rule, today))
    .map((rule) => ({ rule, perDay: rulePerDay(rule) }))
    .sort((a, b) => b.perDay - a.perDay || a.rule.name.localeCompare(b.rule.name, 'ja'))
    .map(({ rule, perDay }) => ({ ruleId: rule.id, name: rule.name, cells: cellsFromPerDay(sign * perDay) }));
  return { total: rows.reduce((sum, r) => addCells(sum, r.cells), ZERO_CELLS), rules: rows };
}

export function buildRateTable(
  metrics: GoalMetrics,
  forecast: Forecast,
  rules: readonly RecurringRule[],
  today: ISODate,
): RateTable {
  const recurringIncome = rateGroup(rules.filter((r) => r.type === 'income'), today, 1);
  const recurringExpense = rateGroup(rules.filter((r) => r.type === 'expense'), today, -1);
  const variableIncome = forecast.variableIncomeMonthly === null ? null : ratesFromMonthly(forecast.variableIncomeMonthly);
  const variableExpense = forecast.variableExpenseMonthly === null ? null : ratesFromMonthly(-forecast.variableExpenseMonthly);
  const net = [variableIncome, variableExpense].reduce<RateCells>(
    (sum, cells) => (cells ? addCells(sum, cells) : sum),
    addCells(recurringIncome.total, recurringExpense.total),
  );
  const netIncludesVariable = variableIncome !== null && variableExpense !== null;
  const required =
    metrics.achieved || metrics.targetDatePassed
      ? null
      : { day: metrics.requiredSavingsPerDay, week: metrics.requiredSavingsPerWeek, month: metrics.requiredSavingsPerMonth };
  return {
    recurringIncome,
    recurringExpense,
    variableIncome,
    variableExpense,
    net,
    netIncludesVariable,
    required,
    surplus: required && netIncludesVariable ? subCells(net, required) : null,
    historyDays: forecast.historyDays,
    daysUntilReady: forecast.daysUntilReady,
  };
}

// ---------------------------------------------------------------------------
// Dashboard bundle
// ---------------------------------------------------------------------------

export interface Dashboard {
  today: ISODate;
  metrics: GoalMetrics;
  forecast: Forecast;
  pace: PaceAssessment;
  thisMonth: MonthSummary;
}

export function computeDashboard(
  goal: Goal,
  transactions: readonly Transaction[],
  rules: readonly RecurringRule[],
  today: ISODate,
): Dashboard {
  const metrics = computeGoalMetrics(goal, transactions, today);
  const forecast = computeForecast(goal, transactions, rules, today);
  return {
    today,
    metrics,
    forecast,
    pace: assessPace(goal, metrics, forecast, today),
    thisMonth: summarizeMonth(transactions, monthKey(today)),
  };
}
