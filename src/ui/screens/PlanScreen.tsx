import { lazy, Suspense, type ReactNode } from 'react';
import { MIN_HISTORY_DAYS } from '../../domain/calculations';
import { formatDateSlash } from '../../domain/dates';
import { useApp } from '../AppContext';
import { Button } from '../components/Button';
import { EmptyState, Row, ScreenHeader, Section } from '../components/layout';
import { Money } from '../components/Money';
import { PaceIcon } from '../components/PaceBadge';
import { ChartFallback } from '../charts/ChartFallback';

const CashFlowChart = lazy(() => import('../charts/CashFlowChart'));

function Stat({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

export function PlanScreen() {
  const { goal, dashboard, snapshot, openSheet, navigate } = useApp();
  const { metrics, forecast, pace } = dashboard;
  const ready = forecast.status === 'ok';

  const incomeRules = snapshot.recurringRules.filter((r) => r.type === 'income' && r.enabled).length;
  const expenseRules = snapshot.recurringRules.filter((r) => r.type === 'expense' && r.enabled).length;

  return (
    <main className="mx-auto max-w-[560px]">
      <ScreenHeader
        title="プラン"
        trailing={
          <Button variant="tinted" onClick={() => openSheet({ kind: 'goal' })} data-testid="edit-goal">
            目標を編集
          </Button>
        }
      />
      <div className="page-x">
        <section className="card p-5" aria-label="目標">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-[22px]" aria-hidden="true">
              🎯
            </span>
            <h2 className="min-w-0 flex-1 truncate text-[20px] font-bold">{goal.name}</h2>
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
        </section>

        {!metrics.achieved && !metrics.targetDatePassed && (
          <Section title="目標日に間に合わせるには">
            <dl className="grid grid-cols-2 divide-x divide-hairline py-4">
              <div className="px-5">
                <dt className="text-[13px] text-ink-3">毎月</dt>
                <dd data-testid="plan-required-month">
                  <Money value={metrics.requiredSavingsPerMonth} size="xl" suffix="/月" />
                </dd>
              </div>
              <div className="px-5">
                <dt className="text-[13px] text-ink-3">毎週</dt>
                <dd data-testid="plan-required-week">
                  <Money value={metrics.requiredSavingsPerWeek} size="xl" suffix="/週" />
                </dd>
              </div>
            </dl>
          </Section>
        )}

        <Section title="見通し">
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

        <Section title="予測の内訳（1か月あたり）" footer={ready ? `変動収支は直近${forecast.historyDays}日間の記録の平均です。` : undefined}>
          <Row title="定期収入" detail={`${incomeRules}件の有効なルール`} value={<Money value={forecast.recurringIncomeMonthly} signed size="sm" />} />
          <Row title="固定支出" detail={`${expenseRules}件の有効なルール`} value={<Money value={-forecast.recurringExpenseMonthly} signed size="sm" />} />
          <Row
            title="その他の収入（平均）"
            value={forecast.variableIncomeMonthly === null ? <span className="text-ink-3">記録中</span> : <Money value={forecast.variableIncomeMonthly} signed size="sm" />}
          />
          <Row
            title="その他の支出（平均）"
            value={forecast.variableExpenseMonthly === null ? <span className="text-ink-3">記録中</span> : <Money value={-forecast.variableExpenseMonthly} signed size="sm" />}
          />
          <Row
            title={<span className="font-semibold">平均の純貯金</span>}
            value={
              forecast.averageMonthlyNetSavings === null ? (
                <span className="text-ink-3">—</span>
              ) : (
                <Money value={forecast.averageMonthlyNetSavings} signed size="md" className={forecast.averageMonthlyNetSavings > 0 ? 'text-income' : 'text-danger'} />
              )
            }
          />
        </Section>

        <Section title="月別の収支">
          {snapshot.transactions.length === 0 ? (
            <EmptyState emoji="📊" title="まだ記録がありません" message="収入や支出を記録すると、月ごとの推移が表示されます。" />
          ) : (
            <div className="px-2 pt-3 pb-2">
              <Suspense fallback={<ChartFallback height={220} />}>
                <CashFlowChart />
              </Suspense>
            </div>
          )}
        </Section>

        <Section title="定期的なお金">
          <Row icon="💼" title="定期収入" detail="バイト代・お小遣いなど" onClick={() => navigate('settings/income')} />
          <Row icon="📱" title="固定支出" detail="スマホ・サブスクなど" onClick={() => navigate('settings/expenses')} />
        </Section>
      </div>
    </main>
  );
}
