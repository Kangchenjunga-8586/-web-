import { memo } from 'react';
import { UNKNOWN_CATEGORY } from '../../domain/categories';
import { formatRelativeDay } from '../../domain/dates';
import type { Category, ISODate, Transaction } from '../../domain/types';
import { RepeatIcon } from './Icons';
import { Money } from './Money';

interface Props {
  tx: Transaction;
  category: Category | undefined;
  today: ISODate;
  showDate?: boolean;
  onSelect: (tx: Transaction) => void;
}

export const TransactionRow = memo(function TransactionRow({ tx, category, today, showDate, onSelect }: Props) {
  const cat = category ?? UNKNOWN_CATEGORY;
  const income = tx.type === 'income';
  const title = tx.memo || cat.name;
  const meta = [showDate ? formatRelativeDay(tx.date, today) : null, tx.memo ? cat.name : null].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={() => onSelect(tx)}
      className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-hairline"
      data-testid="tx-row"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-[20px]" aria-hidden="true">
        {cat.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[16px] leading-snug">{title}</span>
          {tx.recurringRuleId && (
            <span className="shrink-0 text-ink-3" title="定期">
              <RepeatIcon size={14} />
              <span className="sr-only">（定期）</span>
            </span>
          )}
        </span>
        {meta && <span className="block truncate text-[13px] leading-snug text-ink-3">{meta}</span>}
      </span>
      <span className="sr-only">{income ? '収入' : '支出'}</span>
      <Money value={income ? tx.amount : -tx.amount} signed size="md" className={income ? 'text-income' : 'text-ink'} />
    </button>
  );
});
