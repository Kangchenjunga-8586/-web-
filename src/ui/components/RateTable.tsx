import type { ReactNode } from 'react';
import { MIN_HISTORY_DAYS, type RateCells, type RateTable as RateTableData } from '../../domain/calculations';
import { formatNumber } from '../../domain/money';

function signed(n: number): string {
  if (n > 0) return `+${formatNumber(n)}`;
  if (n < 0) return `−${formatNumber(-n)}`;
  return '0';
}

type Tone = 'default' | 'muted' | 'strong' | 'surplus';

function Row({
  label,
  note,
  cells,
  tone = 'default',
  sub = false,
  divider = false,
  unsigned = false,
  testId,
}: {
  label: ReactNode;
  note?: string;
  cells: RateCells | null;
  tone?: Tone;
  sub?: boolean;
  divider?: boolean;
  unsigned?: boolean;
  testId?: string;
}) {
  const cellTone = (n: number) => {
    if (tone === 'surplus') return n >= 0 ? 'text-income font-semibold' : 'text-danger font-semibold';
    if (tone === 'strong') return 'font-semibold text-ink';
    if (sub || tone === 'muted') return 'text-ink-2';
    return 'text-ink';
  };
  const value = (n: number) => (unsigned ? formatNumber(n) : signed(n));
  const pad = sub ? 'py-1.5' : 'py-2.5';
  return (
    <tr className={divider ? 'border-t border-hairline' : undefined} data-testid={testId}>
      <th
        scope="row"
        className={`${pad} pr-1 text-left align-top font-normal ${sub ? 'pl-7 text-[0.9em] text-ink-2' : 'pl-4'} ${
          tone === 'strong' || tone === 'surplus' ? 'font-semibold' : ''
        }`}
      >
        <span className={`block ${sub ? 'truncate' : ''}`}>{label}</span>
        {note && <span className="block text-[11px] leading-tight font-normal text-ink-3">{note}</span>}
      </th>
      {cells ? (
        <>
          <td className={`${pad} pr-2 text-right align-top whitespace-nowrap ${sub ? 'text-[0.9em]' : ''} ${cellTone(cells.day)}`}>{value(cells.day)}</td>
          <td className={`${pad} pr-2 text-right align-top whitespace-nowrap ${sub ? 'text-[0.9em]' : ''} ${cellTone(cells.week)}`}>{value(cells.week)}</td>
          <td className={`${pad} pr-4 text-right align-top whitespace-nowrap ${sub ? 'text-[0.9em]' : ''} ${cellTone(cells.month)}`}>{value(cells.month)}</td>
        </>
      ) : (
        <td colSpan={3} className={`${pad} pr-4 text-right align-top text-[12px] text-ink-3`}>
          記録中
        </td>
      )}
    </tr>
  );
}

/**
 * Income / expenses / savings per day, week and month. Recurring rules are listed one by one
 * (nominal frequency → 日割り・週割り); every column adds up exactly.
 */
export function RateTable({ table }: { table: RateTableData }) {
  const { recurringIncome, recurringExpense, variableIncome, variableExpense, net, netIncludesVariable, required, surplus } = table;
  return (
    <div>
      <table className="num w-full table-fixed border-collapse text-[clamp(12px,3.3vw,14px)]" data-testid="rate-table">
        <caption className="sr-only">1日・1週・1か月あたりの収支（単位：円）</caption>
        <colgroup>
          <col className="w-[32%]" />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr className="text-[12px] text-ink-3">
            <th scope="col" className="py-2 pl-4 text-left font-medium">
              単位：円
            </th>
            <th scope="col" className="py-2 pr-2 text-right font-semibold text-ink-2">
              1日
            </th>
            <th scope="col" className="py-2 pr-2 text-right font-semibold text-ink-2">
              1週
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold text-ink-2">
              1か月
            </th>
          </tr>
        </thead>
        <tbody>
          <Row label="定期収入" cells={recurringIncome.total} divider testId="rate-recurring-income" />
          {recurringIncome.rules.map((r) => (
            <Row key={r.ruleId} label={r.name} cells={r.cells} sub />
          ))}
          <Row label="固定支出" cells={recurringExpense.total} divider testId="rate-recurring-expense" />
          {recurringExpense.rules.map((r) => (
            <Row key={r.ruleId} label={r.name} cells={r.cells} sub />
          ))}
          <Row label="その他の収入" note="記録の平均" cells={variableIncome} divider />
          <Row label="その他の支出" note="記録の平均" cells={variableExpense} />
          <Row
            label="収支"
            note={netIncludesVariable ? undefined : '定期分のみ'}
            cells={net}
            tone="strong"
            divider
            testId="rate-net"
          />
          {required && <Row label="必要な貯金" note="目標日に間に合う額" cells={required} unsigned tone="muted" testId="rate-required" />}
          {surplus && <Row label="目標との差" note="＋余裕 / −不足" cells={surplus} tone="surplus" testId="rate-surplus" />}
        </tbody>
      </table>
      <p className="border-t border-hairline px-4 py-3 text-[12px] leading-relaxed text-ink-3">
        1日・1週の金額は、1か月（平均30.4日）を日割り・週割りした目安です。
        {netIncludesVariable
          ? `その他の収入・支出は、直近${table.historyDays}日間の記録の平均です。`
          : `その他の収入・支出は、記録が${MIN_HISTORY_DAYS}日分たまると計算されます（あと${table.daysUntilReady}日）。`}
      </p>
    </div>
  );
}
