import type { ISODate } from './types';

/**
 * Calendar-date helpers. Dates are 'YYYY-MM-DD' strings. Arithmetic goes through a
 * "day number" (days since 1970-01-01) computed with Date.UTC, so the device's local
 * timezone can never shift a date by one day.
 */

export const APP_TIME_ZONE = 'Asia/Tokyo';
const MS_PER_DAY = 86_400_000;
/** Average Gregorian month length in days (365.2425 / 12). */
export const AVG_DAYS_PER_MONTH = 30.436875;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2999 || mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

export function parseISODate(value: ISODate): { year: number; month: number; day: number } {
  const m = ISO_RE.exec(value);
  if (!m) throw new Error(`Invalid date: ${value}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function toISODate(year: number, month: number, day: number): ISODate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function toDayNumber(date: ISODate): number {
  const { year, month, day } = parseISODate(date);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function fromDayNumber(dayNumber: number): ISODate {
  const d = new Date(dayNumber * MS_PER_DAY);
  return toISODate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Adds calendar months, clamping the day to the target month's length (Jan 31 + 1 → Feb 28/29). */
export function addMonths(date: ISODate, months: number): ISODate {
  const { year, month, day } = parseISODate(date);
  const index = year * 12 + (month - 1) + months;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return toISODate(y, m, Math.min(day, daysInMonth(y, m)));
}

/** b - a in whole days. */
export function diffDays(a: ISODate, b: ISODate): number {
  return toDayNumber(b) - toDayNumber(a);
}

/** 0 = Sunday … 6 = Saturday. 1970-01-01 was a Thursday. */
export function dayOfWeek(date: ISODate): number {
  return (((toDayNumber(date) + 4) % 7) + 7) % 7;
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b;
}

/** 'YYYY-MM' */
export type MonthKey = string;

export function monthKey(date: ISODate): MonthKey {
  return date.slice(0, 7);
}

export function monthStart(key: MonthKey): ISODate {
  return `${key}-01`;
}

export function monthEnd(key: MonthKey): ISODate {
  const [y, m] = key.split('-').map(Number) as [number, number];
  return toISODate(y, m, daysInMonth(y, m));
}

export function addMonthsToKey(key: MonthKey, months: number): MonthKey {
  return monthKey(addMonths(monthStart(key), months));
}

/** The calendar date "now" in Asia/Tokyo, regardless of the device timezone. */
export function todayInTokyo(now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return toISODate(get('year'), get('month'), get('day'));
}

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'] as const;

export function weekdayJa(index: number): string {
  return WEEKDAYS_JA[((index % 7) + 7) % 7]!;
}

/** 2027/04/01 */
export function formatDateSlash(date: ISODate): string {
  return date.replaceAll('-', '/');
}

/** 9月30日(水) */
export function formatDateJa(date: ISODate, withWeekday = true): string {
  const { month, day } = parseISODate(date);
  return withWeekday ? `${month}月${day}日(${weekdayJa(dayOfWeek(date))})` : `${month}月${day}日`;
}

/** 2026年9月 */
export function formatMonthJa(key: MonthKey): string {
  const [y, m] = key.split('-').map(Number);
  return `${y}年${m}月`;
}

/** 9月 */
export function formatMonthShort(key: MonthKey): string {
  return `${Number(key.slice(5, 7))}月`;
}

/** Relative label used in lists: 今日 / 昨日 / 9月28日(月). */
export function formatRelativeDay(date: ISODate, today: ISODate): string {
  const d = diffDays(date, today);
  if (d === 0) return '今日';
  if (d === 1) return '昨日';
  const { year } = parseISODate(date);
  const sameYear = year === parseISODate(today).year;
  return sameYear ? formatDateJa(date) : `${year}年${formatDateJa(date)}`;
}
