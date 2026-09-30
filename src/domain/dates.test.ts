import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  addMonthsToKey,
  dayOfWeek,
  diffDays,
  formatDateJa,
  formatDateSlash,
  formatRelativeDay,
  isValidISODate,
  monthEnd,
  todayInTokyo,
} from './dates';

describe('dates', () => {
  it('validates calendar dates strictly', () => {
    expect(isValidISODate('2026-09-30')).toBe(true);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2027-02-29')).toBe(false);
    expect(isValidISODate('2026-9-30')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate(20260930)).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('adds months with end-of-month clamping', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonthsToKey('2026-12', 1)).toBe('2027-01');
    expect(addMonthsToKey('2027-01', -1)).toBe('2026-12');
  });

  it('computes day differences and weekdays', () => {
    expect(diffDays('2026-09-30', '2027-04-01')).toBe(183);
    expect(diffDays('2027-04-01', '2026-09-30')).toBe(-183);
    expect(dayOfWeek('2026-09-30')).toBe(3); // Wednesday
    expect(dayOfWeek('1970-01-01')).toBe(4); // Thursday
    expect(monthEnd('2026-02')).toBe('2026-02-28');
  });

  it('uses Asia/Tokyo for "today" regardless of device timezone', () => {
    // 2026-09-29T15:30Z is already 2026-09-30 00:30 in Tokyo.
    expect(todayInTokyo(new Date('2026-09-29T15:30:00Z'))).toBe('2026-09-30');
    // 2026-09-30T14:59Z is 23:59 in Tokyo, still the 30th.
    expect(todayInTokyo(new Date('2026-09-30T14:59:00Z'))).toBe('2026-09-30');
  });

  it('never shifts a calendar date through UTC when formatting', () => {
    expect(formatDateSlash('2026-09-30')).toBe('2026/09/30');
    expect(formatDateJa('2026-09-30')).toBe('9月30日(水)');
    expect(formatRelativeDay('2026-09-30', '2026-09-30')).toBe('今日');
    expect(formatRelativeDay('2026-09-29', '2026-09-30')).toBe('昨日');
    expect(formatRelativeDay('2025-12-31', '2026-09-30')).toBe('2025年12月31日(水)');
  });
});
