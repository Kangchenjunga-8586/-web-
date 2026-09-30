import { idealSavingsOn, type SavingsPoint } from '../../domain/calculations';
import { addMonthsToKey, fromDayNumber, maxDate, monthKey, monthStart, parseISODate, toDayNumber } from '../../domain/dates';
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

export function chartEnd(goal: Goal, today: ISODate): ISODate {
  return maxDate(goal.targetDate, today);
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
