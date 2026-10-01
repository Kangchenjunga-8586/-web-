import { useMemo, useState } from 'react';
import {
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
import { formatDateSlash, fromDayNumber, parseISODate } from '../../domain/dates';
import { formatSignedYen, formatYen, formatYenCompact } from '../../domain/money';
import { useApp } from '../AppContext';
import { Segmented } from '../components/Segmented';
import {
  buildSavingsChartModel,
  formatDateTick,
  type LabelAnchor,
  type SavingsChartPoint,
  type SavingsRange,
} from './chartData';

const RANGE_OPTIONS = [
  { value: 'plan', label: '目標日まで' },
  { value: 'sofar', label: 'これまで' },
] as const;

function LineKey({ dash, color, width = 2.5 }: { dash?: string; color: string; width?: number }) {
  return (
    <svg width="22" height="10" aria-hidden="true" className="shrink-0">
      <line x1="2" y1="5" x2="20" y2="5" stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}

interface ViewBox {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/** Direct label with a surface-colored halo so it stays legible over lines and gridlines. */
function HaloText({ x, y, anchor, children, weight = 600, size = 12, tone = 'var(--ink)' }: {
  x: number;
  y: number;
  anchor: LabelAnchor;
  children: string;
  weight?: number;
  size?: number;
  tone?: string;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight={weight}
      fill={tone}
      stroke="var(--surface)"
      strokeWidth={4}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {children}
    </text>
  );
}

const anchorOffset = (anchor: LabelAnchor) => (anchor === 'end' ? 6 : anchor === 'start' ? -6 : 0);

function TargetLabel({ viewBox, text }: { viewBox?: ViewBox; text: string }) {
  const x = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) - 2;
  const y = (viewBox?.y ?? 0) - 7;
  return (
    <HaloText x={x} y={y} anchor="end" tone="var(--ink-2)">
      {text}
    </HaloText>
  );
}

function TodayLabel({ viewBox }: { viewBox?: ViewBox }) {
  const x = (viewBox?.x ?? 0) + 5;
  const y = (viewBox?.y ?? 0) + (viewBox?.height ?? 0) - 6;
  return (
    <HaloText x={x} y={y} anchor="start" weight={500} size={11} tone="var(--ink-3)">
      今日
    </HaloText>
  );
}

/** Label for a ReferenceDot: above (or below) the dot, anchored away from the plot edge. */
function DotLabel({ viewBox, text, anchor, placement = 'above', tone }: {
  viewBox?: ViewBox;
  text: string;
  anchor: LabelAnchor;
  placement?: 'above' | 'below';
  tone?: string;
}) {
  const cx = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) / 2;
  const cy = (viewBox?.y ?? 0) + (viewBox?.height ?? 0) / 2;
  return (
    <HaloText x={cx + anchorOffset(anchor)} y={placement === 'above' ? cy - 11 : cy + 20} anchor={anchor} tone={tone}>
      {text}
    </HaloText>
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
    rows.push({ key: 'p', label: '予測', value: p.projection, color: 'var(--series-1)', dash: '5 4' });
  rows.push({ key: 'i', label: '理想ペース', value: p.ideal, color: 'var(--series-ideal)', dash: '1 4' });
  return (
    <div className="rounded-xl border border-hairline bg-surface px-3 py-2 shadow-lg">
      <div className="num mb-1 text-[12px] font-medium text-ink-3">{formatDateSlash(p.date)}</div>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2 py-0.5">
          <LineKey color={r.color} dash={r.dash} />
          <span className="num text-[15px] font-semibold text-ink">{formatYen(r.value)}</span>
          <span className="text-[12px] text-ink-3">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

function shortDate(t: number): string {
  const { month, day } = parseISODate(fromDayNumber(t));
  return `${month}/${day}`;
}

/**
 * Savings over time: actual (solid), projection (dashed), ideal pace (dotted), the target line,
 * a "today" marker and direct labels for the numbers that matter (current, projected, completion).
 */
export default function SavingsChart({ height, title }: { height: number; title?: string }) {
  const { goal, snapshot, today, dashboard } = useApp();
  const { transactions, recurringRules } = snapshot;
  const [range, setRange] = useState<SavingsRange>('plan');

  const model = useMemo(() => {
    const history = savingsHistory(goal, transactions, today);
    const projection = range === 'plan' ? projectionSeries(goal, transactions, recurringRules, dashboard.forecast, today) : [];
    return buildSavingsChartModel({
      goal,
      history,
      projection,
      completionDate: dashboard.metrics.achieved ? null : dashboard.forecast.estimatedCompletionDate,
      today,
      range,
    });
  }, [goal, transactions, recurringRules, dashboard, today, range]);

  const projected = dashboard.forecast.projectedBalanceAtTargetDate;

  return (
    <figure className="m-0">
      <div className={`flex items-center gap-3 px-3 ${title ? 'justify-between' : 'justify-end'}`}>
        {title && <h2 className="min-w-0 text-[17px] font-semibold">{title}</h2>}
        <Segmented label="グラフの期間" size="sm" className="shrink-0" options={RANGE_OPTIONS} value={range} onChange={setRange} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pt-3 text-[13px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <LineKey color="var(--series-1)" />
          実績
        </span>
        {model.hasProjection && (
          <span className="flex items-center gap-1.5">
            <LineKey color="var(--series-1)" dash="5 4" />
            予測
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <LineKey color="var(--series-ideal)" dash="1 4" width={2} />
          理想ペース
        </span>
        {range === 'plan' && (
          <span className="flex basis-full items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5" data-testid="chart-current">
              <svg width="14" height="14" aria-hidden="true" className="shrink-0">
                <circle cx="7" cy="7" r="5" fill="var(--series-1)" stroke="var(--surface)" strokeWidth="2" />
              </svg>
              現在 <span className="num font-semibold text-ink">{formatYen(model.current)}</span>
            </span>
            {model.completion && (
              <span className="flex items-center gap-1.5" data-testid="chart-completion">
            <svg width="14" height="14" aria-hidden="true" className="shrink-0">
              <circle cx="7" cy="7" r="5" fill="var(--surface)" stroke="var(--series-1)" strokeWidth="2.5" />
            </svg>
                達成見込み <span className="num font-semibold text-ink">{shortDate(model.completion.x)}</span>
              </span>
            )}
          </span>
        )}
        {range === 'sofar' && (
          <span className="ml-auto" data-testid="chart-gain">
            開始から{' '}
            <span className={`num font-semibold ${model.gainSinceStart >= 0 ? 'text-income' : 'text-danger'}`}>
              {formatSignedYen(model.gainSinceStart)}
            </span>
          </span>
        )}
      </div>
      <div style={{ height }} data-testid="savings-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={model.data} margin={{ top: 26, right: 18, bottom: 2, left: 2 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
            <XAxis
              dataKey="t"
              type="number"
              scale="linear"
              domain={model.xDomain}
              ticks={model.xTicks}
              tickFormatter={(t: number) => formatDateTick(t, model.tickUnit)}
              tickLine={false}
              axisLine={{ stroke: 'var(--axis)' }}
              tickMargin={8}
              allowDataOverflow
            />
            <YAxis
              width={52}
              domain={model.yDomain}
              ticks={model.yTicks}
              allowDecimals={false}
              tickFormatter={formatYenCompact}
              tickLine={false}
              axisLine={false}
              allowDataOverflow
            />
            {model.targetVisible && (
              <ReferenceLine
                y={goal.targetAmount}
                stroke="var(--ink-3)"
                strokeWidth={1.25}
                label={<TargetLabel text={`目標 ${formatYenCompact(goal.targetAmount)}`} />}
              />
            )}
            {model.showTodayLine && (
              <ReferenceLine x={model.todayX} stroke="var(--axis)" strokeWidth={1} strokeDasharray="3 3" label={<TodayLabel />} />
            )}
            <Tooltip content={<ChartTooltip today={today} />} cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }} isAnimationActive={false} />
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
            {model.hasProjection && (
              <Line
                dataKey="projection"
                stroke="var(--series-1)"
                strokeWidth={2.5}
                strokeDasharray="5 4"
                strokeOpacity={0.8}
                connectNulls
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
            <Line
              dataKey="actual"
              type="stepAfter"
              stroke="var(--series-1)"
              strokeWidth={2.75}
              connectNulls
              dot={false}
              activeDot={{ r: 5, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
            {model.completion && (
              <ReferenceDot
                x={model.completion.x}
                y={goal.targetAmount}
                r={5.5}
                fill="var(--surface)"
                stroke="var(--series-1)"
                strokeWidth={2.5}
              />
            )}
            {model.projectionEnd && (
              <ReferenceDot
                x={model.projectionEnd.x}
                y={model.projectionEnd.value}
                r={4.5}
                fill="var(--series-1)"
                stroke="var(--surface)"
                strokeWidth={2}
                label={
                  <DotLabel
                    text={`予測 ${formatYenCompact(model.projectionEnd.value)}`}
                    anchor="end"
                    placement={model.projectionEnd.placement}
                    tone="var(--ink-2)"
                  />
                }
              />
            )}
            <ReferenceDot
              x={model.todayX}
              y={model.current}
              r={5.5}
              fill="var(--series-1)"
              stroke="var(--surface)"
              strokeWidth={2.5}
              label={
                model.currentLabel ? (
                  <DotLabel
                    text={`現在 ${formatYenCompact(model.current)}`}
                    anchor={model.currentLabel.anchor}
                    placement={model.currentLabel.placement}
                  />
                ) : undefined
              }
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        貯金の推移。開始時 {formatYen(goal.initialSavings)}、現在 {formatYen(model.current)}、目標 {formatYen(goal.targetAmount)}（
        {formatDateSlash(goal.targetDate)}）。
        {projected !== null && `目標日の予測額 ${formatYen(projected)}。`}
        {model.completion && `${formatDateSlash(model.completion.date)}に達成見込み。`}
      </figcaption>
    </figure>
  );
}
