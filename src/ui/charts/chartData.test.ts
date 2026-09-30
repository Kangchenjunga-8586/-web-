import { describe, expect, it } from 'vitest';
import { makeGoal } from '../../test/fixtures';
import { buildSavingsChartData, formatMonthTick, monthTicks, yAxisScale } from './chartData';
import { toDayNumber } from '../../domain/dates';

describe('chart helpers', () => {
  it('produces evenly spaced round y ticks', () => {
    expect(yAxisScale(668_133)).toEqual({ domain: [0, 800_000], ticks: [0, 200_000, 400_000, 600_000, 800_000] });
    expect(yAxisScale(67_000)).toEqual({ domain: [0, 80_000], ticks: [0, 20_000, 40_000, 60_000, 80_000] });
    expect(yAxisScale(450_000, -30_000).ticks[0]).toBe(-200_000);
    expect(yAxisScale(0).ticks.length).toBeGreaterThan(1);
  });

  it('merges history, projection and ideal pace by date', () => {
    const goal = makeGoal({ startDate: '2026-09-01', targetDate: '2026-12-31', initialSavings: 0, targetAmount: 1210 });
    const data = buildSavingsChartData(
      goal,
      [
        { date: '2026-09-01', balance: 0 },
        { date: '2026-09-30', balance: 300 },
      ],
      [
        { date: '2026-09-30', balance: 300 },
        { date: '2026-12-31', balance: 1500 },
      ],
    );
    expect(data.map((d) => d.date)).toEqual(['2026-09-01', '2026-09-30', '2026-12-31']);
    expect(data[1]).toMatchObject({ actual: 300, projection: 300, ideal: 290 });
    expect(data[2]).toMatchObject({ projection: 1500, ideal: 1210 });
    expect(data[2]!.actual).toBeUndefined();
  });

  it('builds at most 4 month ticks and labels January with the year', () => {
    const ticks = monthTicks('2026-06-01', '2027-04-01');
    expect(ticks.length).toBeLessThanOrEqual(4);
    expect(ticks[0]).toBe(toDayNumber('2026-06-01'));
    expect(formatMonthTick(toDayNumber('2027-01-01'))).toBe('27年1月');
    expect(formatMonthTick(toDayNumber('2026-10-01'))).toBe('10月');
  });
});
