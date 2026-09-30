import { useId, useMemo, useState, type FormEvent } from 'react';
import { categoriesFor } from '../../domain/categories';
import { formatDateSlash } from '../../domain/dates';
import { formatYen, parseYenInput } from '../../domain/money';
import type { Transaction, TxType } from '../../domain/types';
import {
  addTransaction,
  deleteTransaction,
  restoreTransaction,
  updateTransaction,
} from '../../storage/repository';
import { errorMessage, useApp } from '../AppContext';
import { Button } from '../components/Button';
import { AmountField, CategoryGrid, DateChooser, TextField } from '../components/fields';
import { RepeatIcon, TrashIcon } from '../components/Icons';
import { Segmented } from '../components/Segmented';
import { Sheet } from '../components/Sheet';
import { amountToInput } from '../lib/amountInput';

export const TX_AMOUNT_INPUT_ID = 'tx-amount';

interface Props {
  initialType: TxType;
  editing: Transaction | null;
}

const TYPE_OPTIONS = [
  { value: 'expense', label: '− 支出' },
  { value: 'income', label: '＋ 収入' },
] as const;

/** Add / edit a transaction. Order: amount → category → date → memo. */
export function TransactionSheet({ initialType, editing }: Props) {
  const { snapshot, goal, today, closeSheet, toast, confirm, categoriesById } = useApp();
  const formId = useId();
  const [type, setType] = useState<TxType>(editing?.type ?? initialType);
  const [amount, setAmount] = useState(amountToInput(editing?.amount));
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null);
  const [date, setDate] = useState(editing?.date ?? today);
  const [memo, setMemo] = useState(editing?.memo ?? '');
  const [errors, setErrors] = useState<{ amount?: string; category?: string }>({});
  const [saving, setSaving] = useState(false);

  const categories = useMemo(() => {
    const list = categoriesFor(snapshot.categories, type);
    // Keep an archived category visible when editing a transaction that uses it.
    const current = editing && categoriesById.get(editing.categoryId);
    if (current && current.kind === type && current.archived) list.push(current);
    return list;
  }, [snapshot.categories, type, editing, categoriesById]);

  const changeType = (next: TxType) => {
    setType(next);
    if (categoryId && categoriesById.get(categoryId)?.kind !== next) setCategoryId(null);
    setErrors({});
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const value = parseYenInput(amount);
    const nextErrors: typeof errors = {};
    if (value === null || value <= 0) nextErrors.amount = '金額を入力してください';
    if (!categoryId) nextErrors.category = 'カテゴリを選んでください';
    setErrors(nextErrors);
    if (nextErrors.amount || nextErrors.category || value === null || !categoryId) return;

    setSaving(true);
    try {
      const input = { type, amount: value, categoryId, date, memo };
      const category = categoriesById.get(categoryId);
      const label = `${category?.emoji ?? ''} ${category?.name ?? ''} ${formatYen(value)}`.trim();
      if (editing) {
        await updateTransaction(editing.id, input);
        closeSheet();
        toast({ message: `${label} に更新しました` });
      } else {
        const tx = await addTransaction(input);
        closeSheet();
        toast({
          message: `${label} を記録しました`,
          actionLabel: '取り消す',
          onAction: () => void deleteTransaction(tx.id),
        });
      }
    } catch (error) {
      setSaving(false);
      toast({ message: errorMessage(error), tone: 'error' });
    }
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: 'この取引を削除しますか？',
      message: `${formatDateSlash(editing.date)}  ${formatYen(editing.amount)}`,
      confirmLabel: '削除',
      destructive: true,
    });
    if (!ok) return;
    const deleted = await deleteTransaction(editing.id);
    closeSheet();
    if (deleted) {
      toast({ message: '取引を削除しました', actionLabel: '元に戻す', onAction: () => void restoreTransaction(deleted) });
    }
  };

  const title = editing ? '取引を編集' : type === 'expense' ? '支出を記録' : '収入を記録';
  const recurringRule = editing?.recurringRuleId
    ? snapshot.recurringRules.find((r) => r.id === editing.recurringRuleId)
    : undefined;

  return (
    <Sheet
      title={title}
      hideTitle
      onClose={closeSheet}
      testId="transaction-sheet"
      headerExtra={
        <Segmented label="種類" options={TYPE_OPTIONS} value={type} onChange={changeType} preserveFocus />
      }
      footer={
        <div className="flex gap-2">
          {editing && (
            <Button variant="destructive" size="lg" onClick={remove} aria-label="この取引を削除" className="px-4">
              <TrashIcon size={20} />
            </Button>
          )}
          <Button
            type="submit"
            form={formId}
            size="lg"
            block
            disabled={saving}
            onMouseDown={(e) => e.preventDefault()}
            data-testid="tx-submit"
          >
            {editing ? '保存する' : '記録する'}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4 pt-1 pb-2">
        {editing?.recurringRuleId && (
          <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
            <RepeatIcon size={16} className="mt-0.5 shrink-0" />
            <span>
              定期{editing.type === 'income' ? '収入' : '支出'}「{recurringRule?.name ?? editing.memo}」から自動記録されました。ここでの変更はルールには影響しません。
            </span>
          </p>
        )}
        <AmountField
          id={TX_AMOUNT_INPUT_ID}
          label="金額"
          size="hero"
          value={amount}
          onChange={(v) => {
            setAmount(v);
            if (errors.amount) setErrors((x) => ({ ...x, amount: undefined }));
          }}
          error={errors.amount}
        />
        <CategoryGrid
          categories={categories}
          value={categoryId}
          onChange={(id) => {
            setCategoryId(id);
            if (errors.category) setErrors((x) => ({ ...x, category: undefined }));
          }}
          error={errors.category}
        />
        <div>
          <div className="mb-1.5 text-[14px] font-semibold text-ink-2">日付</div>
          <DateChooser value={date} onChange={setDate} today={today} />
          {date < goal.startDate && (
            <p className="mt-1.5 text-[13px] text-warn">
              貯金開始日（{formatDateSlash(goal.startDate)}）より前の取引は貯金額に含まれません。
            </p>
          )}
          {date > today && <p className="mt-1.5 text-[13px] text-ink-3">未来の日付の取引は、その日になると貯金額に反映されます。</p>}
        </div>
        <TextField label="メモ" optional value={memo} onChange={setMemo} placeholder="例：コンビニ、ランチ" maxLength={200} />
        {/* Hidden submit so the keyboard's "done/go" key can submit from the memo field. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}
