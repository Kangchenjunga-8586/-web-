import { useMemo } from 'react';
import { UNKNOWN_CATEGORY } from '../../domain/categories';
import { addMonths, formatDateSlash } from '../../domain/dates';
import { describeSchedule, nextOccurrence, recurringNetBetween } from '../../domain/recurring';
import type { TxType } from '../../domain/types';
import { useApp } from '../AppContext';
import { Button } from '../components/Button';
import { PlusIcon } from '../components/Icons';
import { EmptyState, ScreenHeader } from '../components/layout';
import { Money } from '../components/Money';

export function RecurringScreen({ type }: { type: TxType }) {
  const { snapshot, today, back, openSheet, categoriesById } = useApp();
  const label = type === 'income' ? '定期収入' : '固定支出';
  const rules = useMemo(
    () =>
      snapshot.recurringRules
        .filter((r) => r.type === type)
        .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.createdAt.localeCompare(b.createdAt)),
    [snapshot.recurringRules, type],
  );
  const monthly = Math.abs(Math.round(recurringNetBetween(rules, today, addMonths(today, 12)) / 12));
  const add = () => openSheet({ kind: 'rule', type, rule: null });

  return (
    <main className="mx-auto max-w-[560px]">
      <ScreenHeader
        title={label}
        onBack={back}
        backLabel="設定"
        trailing={
          <Button variant="tinted" onClick={add} icon={<PlusIcon size={18} strokeWidth={2.6} />} data-testid="add-rule">
            追加
          </Button>
        }
      />
      <div className="page-x">
        {rules.length > 0 && (
          <div className="card flex items-baseline justify-between px-5 py-4">
            <span className="text-[14px] text-ink-2">1か月あたり約</span>
            <Money value={monthly} size="xl" />
          </div>
        )}
        <div className="card mt-4 overflow-hidden">
          {rules.length === 0 ? (
            <EmptyState
              emoji={type === 'income' ? '💼' : '📱'}
              title={`${label}はまだありません`}
              message={
                type === 'income'
                  ? 'バイト代やお小遣いを登録すると、入金日に自動で記録されます。'
                  : 'スマホ代やサブスクを登録すると、支払日に自動で記録されます。'
              }
              action={<Button onClick={add}>{label}を追加</Button>}
            />
          ) : (
            rules.map((rule) => {
              const cat = categoriesById.get(rule.categoryId) ?? UNKNOWN_CATEGORY;
              const next = nextOccurrence(rule, today);
              return (
                <button
                  key={rule.id}
                  type="button"
                  onClick={() => openSheet({ kind: 'rule', type, rule })}
                  className="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-hairline"
                  data-testid="rule-row"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-[20px]" aria-hidden="true">
                    {cat.emoji}
                  </span>
                  <span className={`min-w-0 flex-1 ${rule.enabled ? '' : 'opacity-60'}`}>
                    <span className="block truncate text-[16px]">{rule.name}</span>
                    <span className="block truncate text-[13px] text-ink-3">
                      {describeSchedule(rule)}
                      {rule.enabled ? (next ? ` · 次回 ${formatDateSlash(next)}` : ' · 終了') : ' · 停止中'}
                    </span>
                  </span>
                  <Money value={rule.amount} size="md" className={rule.enabled ? '' : 'opacity-60'} />
                </button>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
