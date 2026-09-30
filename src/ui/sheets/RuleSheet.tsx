import { useId, useMemo, useState, type FormEvent } from 'react';
import { categoriesFor } from '../../domain/categories';
import { dayOfWeek, formatDateSlash, parseISODate, weekdayJa } from '../../domain/dates';
import { parseYenInput } from '../../domain/money';
import { describeSchedule } from '../../domain/recurring';
import type { Frequency, ISODate, RecurringRule, TxType } from '../../domain/types';
import { deleteRecurringRule, saveRecurringRule } from '../../storage/repository';
import { errorMessage, useApp } from '../AppContext';
import { Button } from '../components/Button';
import { AmountField, CategoryGrid, DatePill, FieldHelp, FieldLabel, Select, TextField, Toggle } from '../components/fields';
import { TrashIcon } from '../components/Icons';
import { Segmented } from '../components/Segmented';
import { Sheet } from '../components/Sheet';
import { amountToInput } from '../lib/amountInput';

const FREQ_OPTIONS = [
  { value: 'monthly', label: '毎月' },
  { value: 'weekly', label: '毎週' },
  { value: 'yearly', label: '毎年' },
] as const;

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: i + 1 === 31 ? '末日' : `${i + 1}日` }));
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` }));
const WEEKDAY_OPTIONS = Array.from({ length: 7 }, (_, i) => ({ value: String(i), label: weekdayJa(i) }));

interface Props {
  type: TxType;
  rule: RecurringRule | null;
}

export function RuleSheet({ type, rule }: Props) {
  const { snapshot, today, goal, closeSheet, toast, confirm } = useApp();
  const formId = useId();
  const t = parseISODate(today);
  const label = type === 'income' ? '定期収入' : '固定支出';

  const [name, setName] = useState(rule?.name ?? '');
  const [amount, setAmount] = useState(amountToInput(rule?.amount));
  const [categoryId, setCategoryId] = useState<string | null>(
    rule?.categoryId ?? (type === 'income' ? 'inc-job' : 'exp-subscription'),
  );
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? 'monthly');
  const [dayOfMonth, setDayOfMonth] = useState(rule?.dayOfMonth ?? t.day);
  const [weekday, setWeekday] = useState(rule?.dayOfWeek ?? dayOfWeek(today));
  const [month, setMonth] = useState(rule?.month ?? t.month);
  const [startDate, setStartDate] = useState<ISODate>(rule?.startDate ?? today);
  const [hasEnd, setHasEnd] = useState(Boolean(rule?.endDate));
  const [endDate, setEndDate] = useState<ISODate>(rule?.endDate ?? goal.targetDate);
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [errors, setErrors] = useState<{ name?: string; amount?: string; category?: string; end?: string }>({});
  const [saving, setSaving] = useState(false);

  const categories = useMemo(() => categoriesFor(snapshot.categories, type), [snapshot.categories, type]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = parseYenInput(amount);
    const next: typeof errors = {};
    if (!name.trim()) next.name = '名前を入力してください';
    if (value === null || value <= 0) next.amount = '金額を入力してください';
    if (!categoryId) next.category = 'カテゴリを選んでください';
    if (hasEnd && endDate < startDate) next.end = '終了日は開始日以降にしてください';
    setErrors(next);
    if (Object.keys(next).length > 0 || value === null || !categoryId) return;
    setSaving(true);
    try {
      const { created } = await saveRecurringRule(
        {
          type,
          name,
          amount: value,
          categoryId,
          frequency,
          dayOfMonth,
          dayOfWeek: weekday,
          month,
          startDate,
          endDate: hasEnd ? endDate : null,
          enabled,
        },
        today,
        rule?.id,
      );
      closeSheet();
      toast({
        message: created > 0 ? `${label}を保存し、${created}件を自動記録しました` : `${label}「${name.trim()}」を保存しました`,
      });
    } catch (error) {
      setSaving(false);
      toast({ message: errorMessage(error), tone: 'error' });
    }
  };

  const remove = async () => {
    if (!rule) return;
    const ok = await confirm({
      title: `「${rule.name}」を削除しますか？`,
      message: 'これまでに自動記録された取引は履歴に残ります。',
      confirmLabel: '削除',
      destructive: true,
    });
    if (!ok) return;
    await deleteRecurringRule(rule.id);
    closeSheet();
    toast({ message: `${label}を削除しました` });
  };

  const schedule = describeSchedule({ frequency, dayOfMonth, dayOfWeek: weekday, month });

  return (
    <Sheet
      title={rule ? `${label}を編集` : `${label}を追加`}
      onClose={closeSheet}
      testId="rule-sheet"
      footer={
        <div className="flex gap-2">
          {rule && (
            <Button variant="destructive" size="lg" onClick={remove} aria-label={`${label}を削除`} className="px-4">
              <TrashIcon size={20} />
            </Button>
          )}
          <Button type="submit" form={formId} size="lg" block disabled={saving} data-testid="rule-submit">
            保存する
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-5 pt-2 pb-2">
        <TextField
          label="名前"
          value={name}
          onChange={setName}
          placeholder={type === 'income' ? '例：アルバイト' : '例：スマホ代'}
          error={errors.name}
          enterKeyHint="next"
        />
        <AmountField label="金額" value={amount} onChange={setAmount} error={errors.amount} />
        <CategoryGrid categories={categories} value={categoryId} onChange={setCategoryId} error={errors.category} />

        <div>
          <FieldLabel hint={schedule}>{type === 'income' ? '入金日' : '支払日'}</FieldLabel>
          <Segmented label="頻度" options={FREQ_OPTIONS} value={frequency} onChange={setFrequency} />
          <div className="mt-2">
            {frequency === 'monthly' && <Select label="日" hideLabel value={dayOfMonth} options={DAY_OPTIONS} onChange={setDayOfMonth} />}
            {frequency === 'weekly' && (
              <Segmented label="曜日" options={WEEKDAY_OPTIONS} value={String(weekday)} onChange={(v) => setWeekday(Number(v))} />
            )}
            {frequency === 'yearly' && (
              <div className="flex gap-2">
                <Select label="月" hideLabel className="flex-1" value={month} options={MONTH_OPTIONS} onChange={setMonth} />
                <Select label="日" hideLabel className="flex-1" value={dayOfMonth} options={DAY_OPTIONS} onChange={setDayOfMonth} />
              </div>
            )}
          </div>
          {frequency !== 'weekly' && dayOfMonth >= 29 && <FieldHelp>短い月は月末に記録されます。</FieldHelp>}
        </div>

        <div>
          <FieldLabel>開始日</FieldLabel>
          <DatePill value={startDate} onChange={setStartDate} label="開始日" format="slash" />
          <FieldHelp>
            {startDate < goal.startDate
              ? `貯金開始日（${formatDateSlash(goal.startDate)}）より前の分は記録されません。`
              : '開始日以降、日付が来るたびに自動で記録されます。'}
          </FieldHelp>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-ink-2">終了日を設定</span>
            <Toggle checked={hasEnd} onChange={setHasEnd} label="終了日を設定" />
          </div>
          {hasEnd && (
            <div className="mt-1">
              <DatePill value={endDate} onChange={setEndDate} label="終了日" min={startDate} format="slash" />
              {errors.end && <p className="mt-1.5 text-[13px] text-danger">{errors.end}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-1.5">
          <div>
            <p className="text-[15px] font-medium">有効</p>
            <p className="text-[12px] text-ink-3">オフの間は自動記録しません</p>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} label="有効" />
        </div>
      </form>
    </Sheet>
  );
}
