import { lazy, Suspense, useMemo } from 'react';
import { idealSavingsOn } from '../../domain/calculations';
import { diffDays, formatDateJa, formatDateSlash, todayInTokyo } from '../../domain/dates';
import type { Transaction } from '../../domain/types';
import { useApp } from '../AppContext';
import { Button } from '../components/Button';
import { ChevronRight, MinusIcon, PlusIcon } from '../components/Icons';
import { Money } from '../components/Money';
import { PaceBadge, PaceIcon } from '../components/PaceBadge';
import { ProgressBar } from '../components/ProgressBar';
import { TransactionRow } from '../components/TransactionRow';
import { ChartFallback } from '../charts/ChartFallback';

const SavingsChart = lazy(() => import('../charts/SavingsChart'));

const BACKUP_REMINDER_DAYS = 30;

export function HomeScreen() {
  const { snapshot, goal, today, dashboard, categoriesById, openAdd, openSheet, navigate } = useApp();
  const { metrics, pace, thisMonth } = dashboard;

  const recent = useMemo(
    () =>
      [...snapshot.transactions]
        .filter((t) => t.date <= today)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [snapshot.transactions, today],
  );

  const totalDays = Math.max(1, diffDays(goal.startDate, goal.targetDate));
  const idealRatio = goal.targetAmount > 0 ? idealSavingsOn(goal, today) / goal.targetAmount : null;
  const lastBackup = snapshot.settings.lastBackupAt;
  const needsBackup =
    snapshot.transactions.length >= 10 &&
    (!lastBackup || diffDays(todayInTokyo(new Date(lastBackup)), today) > BACKUP_REMINDER_DAYS);

  const edit = (tx: Transaction) => openSheet({ kind: 'tx-edit', tx });

  return (
    <main className="page-x mx-auto max-w-[560px] pt-[max(env(safe-area-inset-top),12px)]">
      <header className="flex items-end justify-between gap-3 pt-3 pb-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-3">{formatDateJa(today)}</p>
          <h1 className="truncate text-[28px] leading-tight font-bold tracking-[-0.01em]" data-testid="goal-name">
            {goal.name}
          </h1>
        </div>
        <PaceBadge status={pace.status} />
      </header>

      {/* Goal card: the three things that matter most — how much, how far, by when. */}
      <section className="card p-5" aria-label="目標の進捗" data-testid="goal-card">
        <p className="text-[13px] font-semibold text-ink-3">現在の貯金</p>
        <div className="mt-0.5 flex items-baseline justify-between gap-3">
          <span data-testid="current-savings">
            <Money value={metrics.currentSavings} size="hero" />
          </span>
          <span className="num text-[22px] font-semibold text-ink-2" data-testid="progress-percent">
            {metrics.progressPercent}%
          </span>
        </div>
        <p className="mt-1 text-[15px] text-ink-2">
          目標 <Money value={goal.targetAmount} size="sm" />
        </p>
        <div className="mt-3">
          <ProgressBar
            ratio={metrics.progressRatio}
            achieved={metrics.achieved}
            marker={metrics.achieved ? null : idealRatio}
            label={`達成率 ${metrics.progressPercent}%`}
          />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-hairline pt-3.5">
          <div>
            <dt className="text-[13px] text-ink-3">残り</dt>
            <dd data-testid="remaining-amount">
              <Money value={metrics.remainingAmount} size="lg" />
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-ink-3">購入目標日</dt>
            <dd className="num text-[17px] leading-tight font-semibold">
              {formatDateSlash(goal.targetDate)}
              <span className="mt-0.5 block text-[13px] font-medium text-ink-3">
                {metrics.daysRemaining > 0
                  ? `あと${metrics.daysRemaining}日`
                  : metrics.daysRemaining === 0
                    ? '今日が目標日'
                    : `${-metrics.daysRemaining}日経過`}
                {metrics.daysRemaining > 0 && ` · ${Math.round((1 - metrics.daysRemaining / totalDays) * 100)}%経過`}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Primary actions: one tap to start typing an amount. */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button size="lg" onClick={() => openAdd('expense')} icon={<MinusIcon size={20} strokeWidth={2.6} />} data-testid="quick-expense">
          支出
        </Button>
        <Button size="lg" variant="tinted" onClick={() => openAdd('income')} icon={<PlusIcon size={20} strokeWidth={2.6} />} data-testid="quick-income">
          収入
        </Button>
      </div>

      {/* Next action: how much to save. */}
      {!metrics.achieved && (
        <section className="card mt-3 grid grid-cols-2 divide-x divide-hairline py-4" aria-label="必要な貯金額">
          <div className="px-5">
            <p className="text-[13px] text-ink-3">毎月の目標貯金</p>
            <Money value={metrics.requiredSavingsPerMonth} size="xl" suffix="/月" />
          </div>
          <div className="px-5">
            <p className="text-[13px] text-ink-3">毎週なら</p>
            <Money value={metrics.requiredSavingsPerWeek} size="xl" suffix="/週" />
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => navigate('plan')}
        className="card pressable mt-3 flex w-full items-start gap-3 p-4 text-left"
        data-testid="pace-card"
      >
        <PaceIcon status={pace.status} size={20} />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] leading-snug font-semibold">{pace.headline}</span>
          <span className="mt-0.5 block text-[14px] leading-snug text-ink-2">{pace.reasons[0]}</span>
        </span>
        <ChevronRight size={18} className="mt-1 shrink-0 text-ink-3" />
      </button>

      <section className="card mt-3 p-4" aria-label="今月の収支" data-testid="month-card">
        <h2 className="text-[13px] font-semibold text-ink-3">今月の収支</h2>
        <dl className="mt-1.5 grid grid-cols-3 gap-2">
          <div>
            <dt className="text-[12px] text-ink-3">収入</dt>
            <dd>
              <Money value={thisMonth.income} size="md" />
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-ink-3">支出</dt>
            <dd>
              <Money value={thisMonth.expense} size="md" />
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-ink-3">純貯金</dt>
            <dd>
              <Money value={thisMonth.net} signed size="md" className={thisMonth.net > 0 ? 'text-income' : thisMonth.net < 0 ? 'text-danger' : ''} />
            </dd>
          </div>
        </dl>
      </section>

      <section className="card mt-3 px-2 pt-4 pb-2" aria-label="貯金の推移">
        <h2 className="px-3 text-[15px] font-semibold">貯金の推移</h2>
        <Suspense fallback={<ChartFallback height={210} />}>
          <SavingsChart height={210} />
        </Suspense>
      </section>

      <section className="mt-6" aria-label="最近の記録">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[13px] font-semibold text-ink-3">最近の記録</h2>
          {recent.length > 0 && (
            <button type="button" onClick={() => navigate('history')} className="-my-2 min-h-[44px] px-1 text-[15px] text-accent-ink">
              すべて見る
            </button>
          )}
        </div>
        <div className="card overflow-hidden">
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-[14px] text-ink-3">まだ記録がありません。下の ＋ から支出を記録してみましょう。</p>
          ) : (
            recent.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} category={categoriesById.get(tx.categoryId)} today={today} showDate onSelect={edit} />
            ))
          )}
        </div>
      </section>

      {needsBackup && (
        <button
          type="button"
          onClick={() => navigate('settings')}
          className="card pressable mt-3 flex w-full items-center gap-3 p-4 text-left"
        >
          <span className="text-[22px]" aria-hidden="true">
            💾
          </span>
          <span className="min-w-0 flex-1 text-[14px] leading-snug text-ink-2">
            データはこのiPhoneにだけ保存されています。設定からバックアップを書き出しておきましょう。
          </span>
          <ChevronRight size={18} className="shrink-0 text-ink-3" />
        </button>
      )}
    </main>
  );
}
