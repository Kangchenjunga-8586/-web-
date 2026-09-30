import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { projectionSeries, savingsHistory } from '../../domain/calculations';
import { formatDateSlash, toDayNumber } from '../../domain/dates';
import { formatYen, formatYenCompact } from '../../domain/money';
import { useApp } from '../AppContext';
import { buildSavingsChartData, chartEnd, formatMonthTick, monthTicks, yAxisScale, type SavingsChartPoint } from './chartData';

function LineKey({ dash, color }: { dash?: string; color: string }) {
  return (
    <svg width="18" height="8" aria-hidden="true" className="shrink-0">
      <line x1="1" y1="4" x2="17" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: SavingsChartPoint }[];
  today: string;
}

function ChartTooltip({ active, payload, today }: TooltipProps) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const rows: { key: string; label: string; value: number; color: string; dash?: string }[] = [];
  if (p.actual !== undefined) rows.push({ key: 'a', label: '実績', value: p.actual, color: 'var(--series-1)' });
  if (p.projection !== undefined && p.date > today)
    rows.push({ key: 'p', label: '予測', value: p.projection, color: 'var(--series-1)', dash: '4 3' });
  rows.push({ key: 'i', label: '理想ペース', value: p.ideal, color: 'var(--series-ideal)', dash: '1 3' });
  return (
    <div className="rounded-xl border border-hairline bg-surface px-3 py-2 text-[12px] shadow-lg">
      <div className="num mb-1 font-medium text-ink-3">{formatDateSlash(p.date)}</div>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2 py-0.5">
          <LineKey color={r.color} dash={r.dash} />
          <span className="num text-[14px] font-semibold text-ink">{formatYen(r.value)}</span>
          <span className="text-ink-3">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Actual savings vs. the ideal pace to the target date, plus the projection when available. */
export default function SavingsChart({ height }: { height: number }) {
  const { goal, snapshot, today, dashboard } = useApp();
  const { transactions, recurringRules } = snapshot;

  const { data, ticks, y, end, hasProjection } = useMemo(() => {
    const history = savingsHistory(goal, transactions, today);
    const projection = projectionSeries(goal, transactions, recurringRules, dashboard.forecast, today);
    const points = buildSavingsChartData(goal, history, projection);
    const values = points.flatMap((p) => [p.actual ?? 0, p.projection ?? 0, p.ideal]);
    const end = chartEnd(goal, today);
    return {
      data: points,
      ticks: monthTicks(goal.startDate, end),
      y: yAxisScale(Math.max(goal.targetAmount, ...values), Math.min(0, ...values)),
      end,
      hasProjection: projection.length > 0,
    };
  }, [goal, transactions, recurringRules, dashboard.forecast, today]);

  const current = dashboard.metrics.currentSavings;

  return (
    <figure className="m-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pt-2 pb-1 text-[12px] text-ink-2" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <LineKey color="var(--series-1)" />
          実績
        </span>
        {hasProjection && (
          <span className="flex items-center gap-1.5">
            <LineKey color="var(--series-1)" dash="4 3" />
            予測
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <LineKey color="var(--series-ideal)" dash="1 3" />
          理想ペース
        </span>
      </div>
      <div style={{ height }} data-testid="savings-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 14, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
            <XAxis
              dataKey="t"
              type="number"
              scale="linear"
              domain={[toDayNumber(goal.startDate), toDayNumber(end)]}
              ticks={ticks}
              tickFormatter={formatMonthTick}
              tickLine={false}
              axisLine={{ stroke: 'var(--axis)' }}
              tickMargin={6}
              minTickGap={8}
            />
            <YAxis
              width={46}
              domain={y.domain}
              ticks={y.ticks}
              allowDecimals={false}
              tickFormatter={formatYenCompact}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine
              y={goal.targetAmount}
              stroke="var(--axis)"
              strokeWidth={1}
              label={{ value: '目標', position: 'insideTopLeft', fill: 'var(--ink-3)', fontSize: 11 }}
            />
            <Tooltip
              content={<ChartTooltip today={today} />}
              cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="ideal"
              stroke="var(--series-ideal)"
              strokeWidth={2}
              strokeDasharray="1 4"
              strokeLinecap="round"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Area
              dataKey="actual"
              type="stepAfter"
              stroke="var(--series-1)"
              strokeWidth={2}
              fill="var(--series-1)"
              fillOpacity={0.1}
              connectNulls
              dot={false}
              activeDot={{ r: 4, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
            {hasProjection && (
              <Line
                dataKey="projection"
                stroke="var(--series-1)"
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeOpacity={0.75}
                connectNulls
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
            <ReferenceDot
              x={toDayNumber(today > end ? end : today)}
              y={current}
              r={4}
              fill="var(--series-1)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        貯金の推移。開始時 {formatYen(goal.initialSavings)}、現在 {formatYen(current)}、目標 {formatYen(goal.targetAmount)}（
        {formatDateSlash(goal.targetDate)}）。
        {dashboard.forecast.projectedBalanceAtTargetDate !== null &&
          `目標日の予測額 ${formatYen(dashboard.forecast.projectedBalanceAtTargetDate)}。`}
      </figcaption>
    </figure>
  );
}
