import { useMemo, useState } from 'react';
import { sumTotals } from '../../domain/calculations';
import { categoriesFor } from '../../domain/categories';
import { addMonthsToKey, formatMonthJa, formatRelativeDay, monthKey, type MonthKey } from '../../domain/dates';
import { formatSignedYen } from '../../domain/money';
import type { Transaction } from '../../domain/types';
import { useApp } from '../AppContext';
import { Button } from '../components/Button';
import { Select } from '../components/fields';
import { ChevronLeft, ChevronRight } from '../components/Icons';
import { EmptyState, ScreenHeader } from '../components/layout';
import { Money } from '../components/Money';
import { Segmented } from '../components/Segmented';
import { TransactionRow } from '../components/TransactionRow';
import { CategoryBreakdown } from '../charts/CategoryBreakdown';

type TypeFilter = 'all' | 'expense' | 'income';

const TYPE_OPTIONS = [
  { value: 'all', label: 'すべて' },
  { value: 'expense', label: '支出' },
  { value: 'income', label: '収入' },
] as const;

export function HistoryScreen() {
  const { snapshot, today, categoriesById, openSheet, openAdd } = useApp();
  const [month, setMonth] = useState<MonthKey>(() => monthKey(today));
  const [type, setType] = useState<TypeFilter>('all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [showBreakdown, setShowBreakdown] = useState(false);

  const monthTxs = useMemo(
    () => snapshot.transactions.filter((t) => monthKey(t.date) === month),
    [snapshot.transactions, month],
  );
  const totals = useMemo(() => sumTotals(monthTxs), [monthTxs]);

  const filtered = useMemo(
    () =>
      monthTxs
        .filter((t) => (type === 'all' || t.type === type) && (categoryId === 'all' || t.categoryId === categoryId))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [monthTxs, type, categoryId],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of filtered) {
      const list = map.get(tx.date);
      if (list) list.push(tx);
      else map.set(tx.date, [tx]);
    }
    return [...map.entries()];
  }, [filtered]);

  const categoryOptions = useMemo(() => {
    const kinds = type === 'all' ? (['expense', 'income'] as const) : ([type] as const);
    const cats = kinds.flatMap((k) => categoriesFor(snapshot.categories, k, true));
    return [{ value: 'all', label: 'すべてのカテゴリ' }, ...cats.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` }))];
  }, [snapshot.categories, type]);

  const expenses = useMemo(() => monthTxs.filter((t) => t.type === 'expense'), [monthTxs]);
  const edit = (tx: Transaction) => openSheet({ kind: 'tx-edit', tx });
  const filtering = type !== 'all' || categoryId !== 'all';

  return (
    <main className="mx-auto max-w-[560px]">
      <ScreenHeader title="履歴" />
      <div className="page-x">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth((m) => addMonthsToKey(m, -1))}
            aria-label="前の月"
            className="pressable grid size-11 place-items-center rounded-full bg-surface text-ink-2"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-[18px] font-semibold" aria-live="polite" data-testid="history-month">
            {formatMonthJa(month)}
          </h2>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonthsToKey(m, 1))}
            aria-label="次の月"
            className="pressable grid size-11 place-items-center rounded-full bg-surface text-ink-2"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <section className="card mt-3 p-4" aria-label="この月の収支">
          <dl className="grid grid-cols-3 gap-2">
            <div>
              <dt className="text-[12px] text-ink-3">収入</dt>
              <dd>
                <Money value={totals.income} size="md" />
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-3">支出</dt>
              <dd>
                <Money value={totals.expense} size="md" />
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-3">収支</dt>
              <dd>
                <Money value={totals.net} signed size="md" className={totals.net > 0 ? 'text-income' : totals.net < 0 ? 'text-danger' : ''} />
              </dd>
            </div>
          </dl>
          {expenses.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowBreakdown((v) => !v)}
                aria-expanded={showBreakdown}
                className="mt-3 flex min-h-[44px] w-full items-center justify-between border-t border-hairline pt-2 text-[14px] font-medium text-accent-ink"
              >
                支出の内訳
                <ChevronRight size={18} className={`transition-transform ${showBreakdown ? 'rotate-90' : ''}`} />
              </button>
              {showBreakdown && (
                <div className="pt-1">
                  <CategoryBreakdown
                    expenses={expenses}
                    categoriesById={categoriesById}
                    onSelectCategory={(id) => {
                      setType('expense');
                      setCategoryId(id);
                    }}
                  />
                </div>
              )}
            </>
          )}
        </section>

        <div className="mt-4 flex items-center gap-2">
          <Segmented
            label="種類で絞り込み"
            size="sm"
            className="shrink-0"
            options={TYPE_OPTIONS}
            value={type}
            onChange={(v) => {
              setType(v);
              setCategoryId('all');
            }}
          />
          <Select label="カテゴリで絞り込み" hideLabel className="min-w-0 flex-1" value={categoryId} options={categoryOptions} onChange={setCategoryId} />
        </div>

        {groups.length === 0 ? (
          <div className="card mt-4">
            <EmptyState
              emoji={filtering ? '🔍' : '🗒️'}
              title={filtering ? '条件に合う記録がありません' : 'この月の記録はまだありません'}
              action={
                !filtering && monthKey(today) === month ? (
                  <Button onClick={() => openAdd('expense')}>支出を記録する</Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          groups.map(([date, txs]) => (
            <section key={date} className="mt-4" aria-label={formatRelativeDay(date, today)}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h3 className="text-[13px] font-semibold text-ink-3">{formatRelativeDay(date, today)}</h3>
                <span className="num text-[12px] text-ink-3">{formatSignedYen(sumTotals(txs).net)}</span>
              </div>
              <div className="card overflow-hidden">
                {txs.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} category={categoriesById.get(tx.categoryId)} today={today} onSelect={edit} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
