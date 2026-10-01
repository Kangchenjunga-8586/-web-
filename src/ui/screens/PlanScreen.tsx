import { Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { buildRateTable, MIN_HISTORY_DAYS } from '../../domain/calculations';
import { formatDateSlash, formatMonthShort, monthKey } from '../../domain/dates';
import { useApp } from '../AppContext';
import { Button } from '../components/Button';
import { EmptyState, Row, ScreenHeader, Section } from '../components/layout';
import { Money } from '../components/Money';
import { PaceIcon } from '../components/PaceBadge';
import { RateTable } from '../components/RateTable';
import { CategoryBreakdown } from '../charts/CategoryBreakdown';
import { ChartFallback } from '../charts/ChartFallback';
import { CashFlowChart, SavingsChart } from '../charts/lazy';
import { takePendingAnchor } from '../hooks/useRoute';
import { scrollToAnchor } from '../lib/scrollToAnchor';


function Stat({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

export function PlanScreen() {
  const { goal, dashboard, snapshot, today, categoriesById, openSheet, navigate } = useApp();
  const { metrics, forecast, pace } = dashboard;
  const ready = forecast.status === 'ok';
  const rateTable = useMemo(
    () => buildRateTable(metrics, forecast, snapshot.recurringRules, today),
    [metrics, forecast, snapshot.recurringRules, today],
  );

  const monthExpenses = useMemo(
    () => snapshot.transactions.filter((t) => t.type === 'expense' && monthKey(t.date) === monthKey(today)),
    [snapshot.transactions, today],
  );

  // Arrived from a Home shortcut (e.g. 収支の目安 / 見通し): jump to that section.
  useEffect(() => {
    const anchor = takePendingAnchor();
    if (anchor) scrollToAnchor(anchor);
  }, []);

  return (
    <main className="mx-auto max-w-[560px]">
      <ScreenHeader
        title="グラフ"
        trailing={
          <Button variant="tinted" onClick={() => openSheet({ kind: 'goal' })} data-testid="edit-goal">
            目標を編集
          </Button>
        }
      />
      <div className="page-x">
        {/* Charts first: one tap on the グラフ tab shows them without scrolling. */}
        <Section title="貯金の推移" id="savings" className="mt-1">
          <div className="px-2 pt-3 pb-2">
            <Suspense fallback={<ChartFallback height={400} />}>
              <SavingsChart height={300} />
            </Suspense>
          </div>
        </Section>

        <Section title="月別の収支" id="monthly">
          {snapshot.transactions.length === 0 ? (
            <EmptyState emoji="📊" title="まだ記録がありません" message="収入や支出を記録すると、月ごとの推移が表示されます。" />
          ) : (
            <div className="px-2 pt-3 pb-2">
              <Suspense fallback={<ChartFallback height={420} />}>
                <CashFlowChart />
              </Suspense>
            </div>
          )}
        </Section>

        <Section title={`今月の支出（${formatMonthShort(monthKey(today))}・カテゴリ別）`} id="categories">
          {monthExpenses.length === 0 ? (
            <EmptyState emoji="🧾" title="今月の支出はまだありません" />
          ) : (
            <div className="px-3 py-3">
              <CategoryBreakdown expenses={monthExpenses} categoriesById={categoriesById} />
            </div>
          )}
        </Section>

        <Section title="見通し" id="outlook">
          <div className="p-5" data-testid="plan-pace">
            <div className="flex items-start gap-3">
              <PaceIcon status={pace.status} />
              <div className="min-w-0 flex-1">
                <p className="text-[17px] leading-snug font-semibold">{pace.headline}</p>
                <ul className="mt-1.5 space-y-1 text-[14px] leading-relaxed text-ink-2">
                  {pace.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
            {pace.extraSavingsPerMonth !== null && pace.extraSavingsPerMonth > 0 && (
              <div className="mt-4 rounded-2xl bg-accent-soft px-4 py-3">
                <p className="text-[13px] text-accent-ink">毎月あとこれだけ節約すると目標ペース</p>
                <Money value={pace.extraSavingsPerMonth} size="xl" suffix="/月" className="text-accent-ink" />
              </div>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-hairline pt-4">
              <Stat label="予測達成日" testId="plan-estimated-date">
                <span className="num text-[18px] font-semibold">
                  {metrics.achieved
                    ? '達成済み'
                    : forecast.estimatedCompletionDate
                      ? formatDateSlash(forecast.estimatedCompletionDate)
                      : ready
                        ? '見込みなし'
                        : '—'}
                </span>
              </Stat>
              <Stat label="目標日の予測額" testId="plan-projected">
                {forecast.projectedBalanceAtTargetDate !== null ? (
                  <Money value={forecast.projectedBalanceAtTargetDate} size="lg" />
                ) : (
                  <span className="text-[18px] font-semibold">—</span>
                )}
              </Stat>
            </dl>
            {!ready && (
              <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed text-ink-2" data-testid="insufficient-data">
                支出データがまだ十分ありません。記録が{MIN_HISTORY_DAYS}日分たまると（あと{forecast.daysUntilReady}日）、
                直近の支出ペースを使った予測を表示します。
              </p>
            )}
          </div>
        </Section>

        <Section title="1日・1週・1か月の収支" id="rates">
          <RateTable table={rateTable} />
        </Section>

        <Section title="目標" id="goal">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-[22px]" aria-hidden="true">
                🎯
              </span>
              <h3 className="min-w-0 flex-1 truncate text-[20px] font-bold">{goal.name}</h3>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5">
              <Stat label="目標金額">
                <Money value={goal.targetAmount} size="lg" />
              </Stat>
              <Stat label="現在額" testId="plan-current">
                <Money value={metrics.currentSavings} size="lg" />
              </Stat>
              <Stat label="残り" testId="plan-remaining">
                <Money value={metrics.remainingAmount} size="lg" />
              </Stat>
              <Stat label="達成率">
                <span className="num text-[22px] font-semibold">{metrics.progressPercent}%</span>
              </Stat>
              <Stat label="貯金開始日">
                <span className="num text-[16px] font-semibold">{formatDateSlash(goal.startDate)}</span>
              </Stat>
              <Stat label="購入目標日">
                <span className="num text-[16px] font-semibold">{formatDateSlash(goal.targetDate)}</span>
                <span className="block text-[13px] text-ink-3">
                  {metrics.daysRemaining >= 0 ? `あと${metrics.daysRemaining}日` : `${-metrics.daysRemaining}日経過`}
                </span>
              </Stat>
            </dl>
          </div>
        </Section>

        <Section title="定期的なお金">
          <Row icon="💼" title="定期収入" detail="バイト代・お小遣いなど" onClick={() => navigate('settings/income')} />
          <Row icon="📱" title="固定支出" detail="スマホ・サブスクなど" onClick={() => navigate('settings/expenses')} />
        </Section>
      </div>
    </main>
  );
}
