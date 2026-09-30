import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { monthlySeries, type MonthSummary } from '../../domain/calculations';
import { formatMonthJa, formatMonthShort, monthKey } from '../../domain/dates';
import { formatSignedYen, formatYen, formatYenCompact } from '../../domain/money';
import { useApp } from '../AppContext';
import { niceMax } from './chartData';

const MONTHS = 6;

function Swatch({ color }: { color: string }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} aria-hidden="true" />;
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
  const series = useMemo(() => monthlySeries(snapshot.transactions, monthKey(today), MONTHS), [snapshot.transactions, today]);
  const yMax = niceMax(Math.max(...series.flatMap((m) => [m.income, m.expense])) * 1.05);

  return (
    <figure className="m-0">
      <div className="flex items-center gap-4 px-3 pt-2 pb-1 text-[12px] text-ink-2" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <Swatch color="var(--series-1)" />
          収入
        </span>
        <span className="flex items-center gap-1.5">
          <Swatch color="var(--series-2)" />
          支出
        </span>
      </div>
      <div style={{ height: 190 }} data-testid="cashflow-chart" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="26%">
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="month" tickFormatter={formatMonthShort} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tickMargin={6} />
            <YAxis width={46} domain={[0, yMax]} tickCount={4} allowDecimals={false} tickFormatter={formatYenCompact} tickLine={false} axisLine={false} />
            <Tooltip content={<CashTooltip />} cursor={{ fill: 'var(--surface-2)' }} isAnimationActive={false} />
            <Bar dataKey="income" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
            <Bar dataKey="expense" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">過去{MONTHS}か月の収入と支出。数値は下の表を参照。</figcaption>
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
