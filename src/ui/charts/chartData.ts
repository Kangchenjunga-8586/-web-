import { idealSavingsOn, type SavingsPoint } from '../../domain/calculations';
import {
  addDays,
  addMonthsToKey,
  diffDays,
  fromDayNumber,
  maxDate,
  minDate,
  monthKey,
  monthStart,
  parseISODate,
  toDayNumber,
} from '../../domain/dates';
import type { Goal, ISODate } from '../../domain/types';

export interface SavingsChartPoint {
  /** Day number (x). */
  t: number;
  date: ISODate;
  actual?: number;
  projection?: number;
  ideal: number;
}

/**
 * Merges actual history, projection and the ideal pace into one x-sorted series so a
 * single crosshair tooltip can show every line at the same date.
 */
export function buildSavingsChartData(goal: Goal, history: SavingsPoint[], projection: SavingsPoint[]): SavingsChartPoint[] {
  const map = new Map<ISODate, SavingsChartPoint>();
  const at = (date: ISODate) => {
    let p = map.get(date);
    if (!p) {
      p = { t: toDayNumber(date), date, ideal: idealSavingsOn(goal, date) };
      map.set(date, p);
    }
    return p;
  };
  at(goal.startDate);
  at(goal.targetDate);
  for (const h of history) at(h.date).actual = h.balance;
  for (const p of projection) at(p.date).projection = p.balance;
  return [...map.values()].sort((a, b) => a.t - b.t);
}

/** Month-start ticks (at most `max`) across [start, end]. */
export function monthTicks(start: ISODate, end: ISODate, max = 4): number[] {
  const first = addMonthsToKey(monthKey(start), start.endsWith('-01') ? 0 : 1);
  const last = monthKey(end);
  const months: string[] = [];
  for (let k = first; k <= last; k = addMonthsToKey(k, 1)) months.push(k);
  if (months.length === 0) return [toDayNumber(start), toDayNumber(end)];
  const step = Math.ceil(months.length / max);
  return months.filter((_, i) => i % step === 0).map((k) => toDayNumber(monthStart(k)));
}

export function formatMonthTick(t: number): string {
  const { year, month } = parseISODate(fromDayNumber(t));
  return month === 1 ? `${String(year).slice(2)}年1月` : `${month}月`;
}

function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const n = raw / magnitude;
  return ([1, 2, 2.5, 5, 10].find((s) => s >= n) ?? 10) * magnitude;
}

/** Evenly spaced, round y-axis ticks (¥0 / ¥20万 / ¥40万 …) covering [min, max]. */
export function yAxisScale(maxValue: number, minValue = 0, targetTicks = 4): { domain: [number, number]; ticks: number[] } {
  const hi = Math.max(maxValue, 1_000);
  const lo = Math.min(minValue, 0);
  const step = niceStep((hi - lo) / targetTicks);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v));
  return { domain: [start, end], ticks };
}

/**
 * Y scale fitted to a line chart's data. Starts at ¥0 only when that wastes little room;
 * otherwise zooms in so changes in savings are clearly visible (lines need no zero baseline).
 */
export function yAxisFit(minValue: number, maxValue: number, targetTicks = 4): { domain: [number, number]; ticks: number[] } {
  const hi = Math.max(maxValue, minValue + 1_000);
  const lo = minValue >= 0 && minValue <= hi * 0.35 ? 0 : minValue;
  const step = niceStep((hi - lo) / targetTicks);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v));
  return { domain: [start, end], ticks };
}

export type TickUnit = 'month' | 'day';

/** Month ticks for long ranges, day ticks (every 1–28 days) for ranges under ~2.5 months. */
export function dateTicks(start: ISODate, end: ISODate, max = 4): { ticks: number[]; unit: TickUnit } {
  const span = diffDays(start, end);
  if (span >= 75) return { ticks: monthTicks(start, end, max), unit: 'month' };
  const step = [1, 2, 3, 7, 14, 21, 28].find((s) => Math.floor(span / s) + 1 <= max) ?? Math.ceil(span / max);
  const first = toDayNumber(start);
  const ticks: number[] = [];
  for (let t = first; t <= first + span; t += step) ticks.push(t);
  return { ticks, unit: 'day' };
}

export function formatDateTick(t: number, unit: TickUnit): string {
  if (unit === 'month') return formatMonthTick(t);
  const { month, day } = parseISODate(fromDayNumber(t));
  return `${month}/${day}`;
}

/** 'plan' = start → target date (with projection); 'sofar' = start → today, zoomed in. */
export type SavingsRange = 'plan' | 'sofar';
export type LabelAnchor = 'start' | 'middle' | 'end';

export interface SavingsChartModel {
  data: SavingsChartPoint[];
  xDomain: [number, number];
  xTicks: number[];
  tickUnit: TickUnit;
  yDomain: [number, number];
  yTicks: number[];
  todayX: number;
  current: number;
  /** Where to print "現在 ¥…" next to today's dot ("これまで" view only). */
  currentLabel: { anchor: LabelAnchor; placement: 'above' } | null;
  showTodayLine: boolean;
  targetVisible: boolean;
  hasProjection: boolean;
  /** Where the projection reaches the target (marker only; the date is shown in the legend). */
  completion: { x: number; date: ISODate } | null;
  /** Growth since the start date (shown in the "これまで" view). */
  gainSinceStart: number;
  /** Projected balance on the target date, unless its label would collide with the target label. */
  projectionEnd: { x: number; value: number; placement: 'above' | 'below' } | null;
}

export interface SavingsChartInput {
  goal: Goal;
  history: SavingsPoint[];
  projection: SavingsPoint[];
  completionDate: ISODate | null;
  today: ISODate;
  range: SavingsRange;
}

export function buildSavingsChartModel({ goal, history, projection, completionDate, today, range }: SavingsChartInput): SavingsChartModel {
  const plan = range === 'plan';
  const start = goal.startDate;
  const end = plan ? maxDate(goal.targetDate, today) : maxDate(today, addDays(start, 7));
  const data: SavingsChartPoint[] = plan
    ? buildSavingsChartData(goal, history, projection)
    : history.map((h) => ({ t: toDayNumber(h.date), date: h.date, actual: h.balance, ideal: idealSavingsOn(goal, h.date) }));

  const values = data.flatMap((p) => [p.actual, p.projection, p.ideal].filter((v): v is number => v !== undefined));
  if (plan) values.push(goal.targetAmount);
  const y = yAxisFit(Math.min(...values), Math.max(...values));
  const { ticks, unit } = dateTicks(start, end);

  const xDomain: [number, number] = [toDayNumber(start), toDayNumber(end)];
  const ySpan = y.domain[1] - y.domain[0];

  const lastHistory = history[history.length - 1];
  const current = lastHistory?.balance ?? goal.initialSavings;
  const todayX = toDayNumber(minDate(maxDate(today, start), end));

  const completion =
    plan && completionDate && completionDate > today && completionDate <= end
      ? { x: toDayNumber(completionDate), date: completionDate }
      : null;

  const last = plan ? projection[projection.length - 1] : undefined;
  const projectionEnd =
    last && last.date > today && Math.abs(last.balance - goal.targetAmount) >= ySpan * 0.1
      ? { x: toDayNumber(last.date), value: last.balance, placement: last.balance >= goal.targetAmount ? ('above' as const) : ('below' as const) }
      : null;

  // In "これまで" today's dot sits at the right edge, so "現在 ¥…" fits above it. In the plan view
  // it would often collide with the target line, the completion marker or a flat stretch of the
  // line, so the exact value goes in the legend instead.
  const currentLabel: SavingsChartModel['currentLabel'] = plan ? null : { anchor: 'end', placement: 'above' };

  return {
    data,
    xDomain,
    xTicks: ticks,
    tickUnit: unit,
    yDomain: y.domain,
    yTicks: y.ticks,
    todayX,
    current,
    currentLabel,
    showTodayLine: plan && today > start && today < end,
    targetVisible: plan || goal.targetAmount <= y.domain[1],
    hasProjection: plan && projection.length > 0,
    completion,
    gainSinceStart: current - goal.initialSavings,
    projectionEnd,
  };
}
