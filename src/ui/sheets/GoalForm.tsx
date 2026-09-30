import { useState, type FormEvent } from 'react';
import { addMonths, diffDays } from '../../domain/dates';
import { parseYenInput } from '../../domain/money';
import type { Goal, ISODate } from '../../domain/types';
import type { GoalInput } from '../../storage/repository';
import { AmountField, DatePill, FieldError, FieldHelp, FieldLabel, TextField } from '../components/fields';
import { amountToInput } from '../lib/amountInput';

interface Props {
  formId: string;
  today: ISODate;
  initial?: Goal | null;
  onSubmit: (input: GoalInput) => void | Promise<void>;
}

type Errors = Partial<Record<'name' | 'targetAmount' | 'initialSavings' | 'targetDate', string>>;

const PRESETS = [
  { months: 3, label: '3か月後' },
  { months: 6, label: '半年後' },
  { months: 12, label: '1年後' },
];

/** Goal fields. The submit button lives with the caller (page bottom or sheet footer). */
export function GoalForm({ formId, today, initial, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [target, setTarget] = useState(amountToInput(initial?.targetAmount));
  const [saved, setSaved] = useState(amountToInput(initial?.initialSavings));
  const [startDate, setStartDate] = useState<ISODate>(initial?.startDate ?? today);
  const [targetDate, setTargetDate] = useState<ISODate>(initial?.targetDate ?? addMonths(today, 6));
  const [errors, setErrors] = useState<Errors>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const targetAmount = parseYenInput(target);
    const initialSavings = saved.trim() === '' ? 0 : parseYenInput(saved);
    const next: Errors = {};
    if (!name.trim()) next.name = '買いたい物を入力してください';
    if (targetAmount === null || targetAmount <= 0) next.targetAmount = '目標金額を入力してください';
    if (initialSavings === null) next.initialSavings = '0以上の金額を入力してください';
    if (targetDate <= startDate) next.targetDate = '購入目標日は貯金開始日より後にしてください';
    setErrors(next);
    if (Object.keys(next).length > 0 || targetAmount === null || initialSavings === null) return;
    void onSubmit({ name: name.trim(), targetAmount, initialSavings, startDate, targetDate });
  };

  const days = diffDays(today, targetDate);

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-5">
      <TextField
        id={`${formId}-name`}
        label="買いたい物"
        value={name}
        onChange={setName}
        placeholder="例：MacBook Pro"
        error={errors.name}
        enterKeyHint="next"
      />
      <AmountField
        id={`${formId}-target`}
        label="目標金額"
        value={target}
        onChange={setTarget}
        placeholder="450,000"
        error={errors.targetAmount}
      />
      <AmountField
        id={`${formId}-saved`}
        label="すでに貯まっている金額"
        value={saved}
        onChange={setSaved}
        placeholder="0"
        error={errors.initialSavings}
        help="貯金開始日の時点で貯まっている金額です。"
      />
      <div>
        <FieldLabel>貯金開始日</FieldLabel>
        <DatePill value={startDate} onChange={setStartDate} label="貯金開始日" format="slash" />
        <FieldHelp>この日以降に記録した収支が貯金額に反映されます。通常は今日のままでOKです。</FieldHelp>
      </div>
      <div>
        <FieldLabel hint={days > 0 ? `あと${days}日` : undefined}>購入目標日</FieldLabel>
        <DatePill value={targetDate} onChange={setTargetDate} label="購入目標日" min={startDate} format="slash" />
        <div className="mt-2 flex gap-2">
          {PRESETS.map((p) => {
            const date = addMonths(today, p.months);
            const selected = date === targetDate;
            return (
              <button
                key={p.months}
                type="button"
                aria-pressed={selected}
                onClick={() => setTargetDate(date)}
                className={`pressable min-h-[44px] flex-1 rounded-xl text-[14px] font-semibold ${
                  selected ? 'bg-accent-soft text-accent-ink' : 'bg-surface-2 text-ink-2'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <FieldError>{errors.targetDate}</FieldError>
      </div>
    </form>
  );
}
