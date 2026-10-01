import type { ReactNode } from 'react';
import { totalsByCategory } from '../../domain/calculations';
import { UNKNOWN_CATEGORY } from '../../domain/categories';
import type { Category, Transaction } from '../../domain/types';
import { Money } from '../components/Money';

interface Props {
  expenses: Transaction[];
  categoriesById: Map<string, Category>;
  onSelectCategory?: (id: string) => void;
}

/** A tappable row when it filters something, otherwise plain content (no dead buttons). */
function RowShell({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  const cls = 'flex min-h-[44px] w-full items-center gap-3 rounded-xl px-1 text-left';
  if (!onClick) return <div className={cls}>{children}</div>;
  return (
    <button type="button" onClick={onClick} className={`${cls} active:bg-surface-2`}>
      {children}
    </button>
  );
}

/** Spending by category: single-hue horizontal bars, labelled directly. */
export function CategoryBreakdown({ expenses, categoriesById, onSelectCategory }: Props) {
  const totals = totalsByCategory(expenses);
  const total = totals.reduce((s, t) => s + t.amount, 0);
  if (total === 0) return null;
  const max = totals[0]!.amount;
  return (
    <ul className="space-y-1" aria-label="カテゴリ別の支出" data-testid="category-breakdown">
      {totals.map((t) => {
        const cat = categoriesById.get(t.categoryId) ?? UNKNOWN_CATEGORY;
        const pct = Math.round((t.amount / total) * 100);
        return (
          <li key={t.categoryId}>
            <RowShell onClick={onSelectCategory ? () => onSelectCategory(t.categoryId) : undefined}>
              <span className="w-6 shrink-0 text-center text-[18px]" aria-hidden="true">
                {cat.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[14px]">{cat.name}</span>
                  <span className="flex shrink-0 items-baseline gap-1.5">
                    <Money value={t.amount} size="sm" />
                    <span className="num w-9 text-right text-[12px] text-ink-3">{pct}%</span>
                  </span>
                </span>
                <span className="mt-1 block h-1.5 w-full rounded-full bg-surface-2" aria-hidden="true">
                  <span className="block h-full rounded-full bg-series-1" style={{ width: `${Math.max(2, (t.amount / max) * 100)}%` }} />
                </span>
              </span>
            </RowShell>
          </li>
        );
      })}
    </ul>
  );
}
