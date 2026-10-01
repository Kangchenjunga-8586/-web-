import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { monthlySeries, type MonthSummary } from '../../domain/calculations';
import { formatMonthJa, formatMonthShort, monthKey } from '../../domain/dates';
import { formatSignedYen, formatYen, formatYenCompact } from '../../domain/money';
import { useApp } from '../AppContext';
import { yAxisScale } from './chartData';

const MONTHS = 6;
const MIN_MONTHS = 3;

function Swatch({ color }: { color: string }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} aria-hidden="true" />;
}

/** Value on the cap of the latest month's bars only (selective direct labels). */
function LatestValueLabel(props: {
  lastIndex: number;
  index?: number;
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: number | string;
}) {
  const { lastIndex, index, value } = props;
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  if (index !== lastIndex || !value) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      textAnchor="middle"
      fontSize={11}
      fontWeight={600}
      fill="var(--ink-2)"
      stroke="var(--surface)"
      strokeWidth={3}
      paintOrder="stroke"
    >
      {formatYenCompact(Number(value)).replace('¥', '')}
    </text>
  );
}

function CashTooltip({ active, payload }: { active?: boolean; payload?: { payload: MonthSummary }[] }) {
  const m = payload?.[0]?.payload;
  if (!active || !m) return null;
  return (
    <div className="rounded-xl border border-hairline bg-surface px-3 py-2 text-[12px] shadow-lg">
      <div className="mb-1 font-medium text-ink-3">{formatMonthJa(m.month)}</div>
      <div className="flex items-center gap-2 py-0.5">
        <Swatch color="var(--series-1)" />
        <span className="num text-[14px] font-semibold">{formatYen(m.income)}</span>
        <span className="text-ink-3">収入</span>
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <Swatch color="var(--series-2)" />
        <span className="num text-[14px] font-semibold">{formatYen(m.expense)}</span>
        <span className="text-ink-3">支出</span>
      </div>
      <div className="mt-1 border-t border-hairline pt-1 text-ink-2">
        純貯金 <span className="num font-semibold text-ink">{formatSignedYen(m.net)}</span>
      </div>
    </div>
  );
}

/** Income vs. expenses for the last 6 months, with the same numbers as a table. */
export default function CashFlowChart() {
  const { snapshot, today } = useApp();
  const series = useMemo(() => {
    const all = monthlySeries(snapshot.transactions, monthKey(today), MONTHS);
    // Drop empty months before the first record, but keep at least MIN_MONTHS bars.
    const first = all.findIndex((m) => m.income > 0 || m.expense > 0);
    return all.slice(Math.min(first === -1 ? all.length : first, MONTHS - MIN_MONTHS));
  }, [snapshot.transactions, today]);
  const y = yAxisScale(Math.max(...series.flatMap((m) => [m.income, m.expense])));

  return (
    <figure className="m-0">
      <div className="flex items-center gap-4 px-3 pt-1 pb-1 text-[13px] text-ink-2" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <Swatch color="var(--series-1)" />
          収入
        </span>
        <span className="flex items-center gap-1.5">
          <Swatch color="var(--series-2)" />
          支出
        </span>
      </div>
      <div style={{ height: 220 }} data-testid="cashflow-chart" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 22, right: 8, bottom: 2, left: 2 }} barGap={2} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="month" tickFormatter={formatMonthShort} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tickMargin={8} />
            <YAxis width={50} domain={y.domain} ticks={y.ticks} allowDecimals={false} tickFormatter={formatYenCompact} tickLine={false} axisLine={false} />
            <Tooltip content={<CashTooltip />} cursor={{ fill: 'var(--surface-2)' }} isAnimationActive={false} />
            <Bar dataKey="income" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false}>
              <LabelList dataKey="income" content={<LatestValueLabel lastIndex={series.length - 1} />} />
            </Bar>
            <Bar dataKey="expense" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false}>
              <LabelList dataKey="expense" content={<LatestValueLabel lastIndex={series.length - 1} />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">過去{series.length}か月の収入と支出。数値は下の表を参照。</figcaption>
      <table className="mt-2 w-full text-[13px]" data-testid="cashflow-table">
        <caption className="sr-only">月別の収支</caption>
        <thead>
          <tr className="text-ink-3">
            <th scope="col" className="px-3 py-1.5 text-left font-medium">月</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">収入</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">支出</th>
            <th scope="col" className="px-3 py-1.5 text-right font-medium">純貯金</th>
          </tr>
        </thead>
        <tbody className="num">
          {[...series].reverse().map((m) => (
            <tr key={m.month} className="border-t border-hairline">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                {formatMonthJa(m.month)}
              </th>
              <td className="px-2 py-2 text-right">{formatYen(m.income)}</td>
              <td className="px-2 py-2 text-right">{formatYen(m.expense)}</td>
              <td className={`px-3 py-2 text-right font-semibold ${m.net > 0 ? 'text-income' : m.net < 0 ? 'text-danger' : 'text-ink-3'}`}>
                {formatSignedYen(m.net)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
