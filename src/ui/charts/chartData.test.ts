import { describe, expect, it } from 'vitest';
import { makeGoal } from '../../test/fixtures';
import {
  buildSavingsChartData,
  buildSavingsChartModel,
  dateTicks,
  formatDateTick,
  formatMonthTick,
  monthTicks,
  yAxisFit,
  yAxisScale,
} from './chartData';
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

  it('fits the y axis to the data instead of always starting at ¥0', () => {
    expect(yAxisFit(200_000, 450_000)).toEqual({ domain: [200_000, 500_000], ticks: [200_000, 300_000, 400_000, 500_000] });
    // Close to zero relative to the max: keep the honest ¥0 baseline.
    expect(yAxisFit(150_000, 668_133).domain).toEqual([0, 800_000]);
    expect(yAxisFit(-30_000, 200_000).ticks).toEqual([-100_000, 0, 100_000, 200_000]);
    expect(yAxisFit(0, 0).ticks.length).toBeGreaterThan(1);
  });

  it('switches to day ticks for short ranges', () => {
    const short = dateTicks('2026-09-01', '2026-09-30');
    expect(short.unit).toBe('day');
    expect(short.ticks.map((t) => formatDateTick(t, 'day'))).toEqual(['9/1', '9/15', '9/29']);
    expect(dateTicks('2026-06-01', '2027-04-01').unit).toBe('month');
    expect(dateTicks('2026-09-30', '2026-10-07').ticks.length).toBeLessThanOrEqual(4);
  });
});

describe('savings chart model', () => {
  const goal = makeGoal({ startDate: '2026-06-01', targetDate: '2027-04-01', initialSavings: 150_000, targetAmount: 450_000 });
  const history = [
    { date: '2026-06-01', balance: 150_000 },
    { date: '2026-08-25', balance: 260_000 },
    { date: '2026-09-30', balance: 356_610 },
  ];
  const projection = [
    { date: '2026-09-30', balance: 356_610 },
    { date: '2026-12-30', balance: 510_000 },
    { date: '2027-04-01', balance: 668_133 },
  ];
  const base = { goal, history, projection, completionDate: '2026-11-25', today: '2026-09-30' } as const;

  it('plan range: today line, completion marker and projection end label', () => {
    const m = buildSavingsChartModel({ ...base, range: 'plan' });
    expect(m.xDomain).toEqual([toDayNumber('2026-06-01'), toDayNumber('2027-04-01')]);
    expect(m.showTodayLine).toBe(true);
    expect(m.todayX).toBe(toDayNumber('2026-09-30'));
    expect(m.current).toBe(356_610);
    expect(m.targetVisible).toBe(true);
    expect(m.hasProjection).toBe(true);
    expect(m.completion).toEqual({ x: toDayNumber('2026-11-25'), date: '2026-11-25' });
    // Plan view: the exact current value is in the legend, not on the crowded plot.
    expect(m.currentLabel).toBeNull();
    expect(m.projectionEnd).toEqual({ x: toDayNumber('2027-04-01'), value: 668_133, placement: 'above' });
    expect(m.yDomain).toEqual([0, 800_000]);
  });

  it('drops the projection-end label when it would overlap the target label', () => {
    const close = [...projection.slice(0, 2), { date: '2027-04-01', balance: 460_000 }];
    const m = buildSavingsChartModel({ ...base, projection: close, completionDate: '2027-03-20', range: 'plan' });
    expect(m.projectionEnd).toBeNull();
    expect(m.completion?.date).toBe('2027-03-20');
  });

  it('places the projection label below when falling short of the target', () => {
    const short = [...projection.slice(0, 2), { date: '2027-04-01', balance: 300_000 }];
    const m = buildSavingsChartModel({ ...base, projection: short, completionDate: null, range: 'plan' });
    expect(m.projectionEnd?.placement).toBe('below');
    expect(m.completion).toBeNull();
  });

  it('"これまで" range zooms into recorded history only', () => {
    const m = buildSavingsChartModel({ ...base, range: 'sofar' });
    expect(m.xDomain).toEqual([toDayNumber('2026-06-01'), toDayNumber('2026-09-30')]);
    expect(m.data.every((p) => p.projection === undefined)).toBe(true);
    expect(m.hasProjection).toBe(false);
    expect(m.showTodayLine).toBe(false);
    expect(m.completion).toBeNull();
    expect(m.projectionEnd).toBeNull();
    // 150k–357k fills the plot instead of a ¥0–¥80万 axis.
    expect(m.yDomain).toEqual([100_000, 400_000]);
    expect(m.targetVisible).toBe(false);
    expect(m.currentLabel).toEqual({ anchor: 'end', placement: 'above' });
    expect(m.gainSinceStart).toBe(206_610);
  });

  it('keeps the completion marker even close to today', () => {
    const long = makeGoal({ startDate: '2026-09-01', targetDate: '2027-09-01', initialSavings: 400_000, targetAmount: 450_000 });
    const m = buildSavingsChartModel({
      goal: long,
      history: [
        { date: '2026-09-01', balance: 400_000 },
        { date: '2026-09-30', balance: 440_000 },
      ],
      projection: [
        { date: '2026-09-30', balance: 440_000 },
        { date: '2027-09-01', balance: 600_000 },
      ],
      completionDate: '2026-10-20',
      today: '2026-09-30',
      range: 'plan',
    });
    expect(m.currentLabel).toBeNull();
    expect(m.completion?.date).toBe('2026-10-20');
  });

  it('handles the first days of a plan', () => {
    const fresh = makeGoal({ startDate: '2026-09-30', targetDate: '2027-03-31', initialSavings: 0, targetAmount: 298_000 });
    const m = buildSavingsChartModel({
      goal: fresh,
      history: [{ date: '2026-09-30', balance: 0 }],
      projection: [],
      completionDate: null,
      today: '2026-09-30',
      range: 'sofar',
    });
    expect(m.xDomain[1] - m.xDomain[0]).toBe(7);
    expect(m.tickUnit).toBe('day');
    expect(m.showTodayLine).toBe(false);
  });
});
