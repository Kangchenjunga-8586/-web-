import { useId, type ReactNode, type Ref } from 'react';
import { addDays, formatDateJa, formatDateSlash } from '../../domain/dates';
import type { Category, ISODate } from '../../domain/types';
import { formatAmountInput } from '../lib/amountInput';
import { CalendarIcon, ChevronDown } from './Icons';

export function FieldLabel({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[14px] font-semibold text-ink-2">
        {children}
      </label>
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-[13px] font-medium text-danger" role="alert">
      {children}
    </p>
  );
}

export function FieldHelp({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[13px] leading-snug text-ink-3">{children}</p>;
}

interface AmountFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  size?: 'hero' | 'md';
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  hint?: ReactNode;
  help?: ReactNode;
  placeholder?: string;
}

/** Integer-yen input that brings up the iPhone numeric keypad. */
export function AmountField({
  id,
  label,
  value,
  onChange,
  error,
  size = 'md',
  autoFocus,
  inputRef,
  hint,
  help,
  placeholder = '0',
}: AmountFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hero = size === 'hero';
  return (
    <div>
      <FieldLabel htmlFor={inputId} hint={hint}>
        {label}
      </FieldLabel>
      <div
        className={`flex items-baseline rounded-2xl border bg-surface-2 px-4 focus-within:border-progress focus-within:bg-surface ${
          error ? 'border-danger' : 'border-transparent'
        } ${hero ? 'py-2' : ''}`}
      >
        <span aria-hidden="true" className={`font-semibold text-ink-3 ${hero ? 'mr-1 text-[28px]' : 'mr-1 text-[18px]'}`}>
          ¥
        </span>
        <input
          ref={inputRef}
          id={inputId}
          className={`num w-full min-w-0 bg-transparent font-semibold outline-none placeholder:text-ink-3/60 ${
            hero ? 'min-h-[56px] text-[40px] tracking-[-0.01em]' : 'min-h-[48px] text-[20px]'
          }`}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          enterKeyHint="done"
          placeholder={placeholder}
          value={value}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(formatAmountInput(e.target.value))}
        />
      </div>
      {help && !error && <FieldHelp>{help}</FieldHelp>}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  maxLength?: number;
  id?: string;
  optional?: boolean;
  enterKeyHint?: 'done' | 'next';
}

export function TextField({ label, value, onChange, placeholder, error, maxLength = 100, id, optional, enterKeyHint = 'done' }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div>
      <FieldLabel htmlFor={inputId} hint={optional ? '任意' : undefined}>
        {label}
      </FieldLabel>
      <input
        id={inputId}
        className="field"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        enterKeyHint={enterKeyHint}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** A pill that shows a formatted date and opens the native iOS date picker. */
export function DatePill({
  value,
  onChange,
  label,
  min,
  max,
  className = '',
  format = 'ja',
}: {
  value: ISODate;
  onChange: (value: ISODate) => void;
  label: string;
  min?: ISODate;
  max?: ISODate;
  className?: string;
  format?: 'ja' | 'slash';
}) {
  return (
    <label
      className={`relative flex min-h-[48px] items-center gap-2 rounded-[14px] bg-surface-2 px-3.5 text-[16px] font-medium focus-within:ring-2 focus-within:ring-progress ${className}`}
    >
      <CalendarIcon size={18} className="shrink-0 text-ink-3" />
      <span className="num truncate">{format === 'ja' ? formatDateJa(value) : formatDateSlash(value)}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        aria-label={label}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}

interface DateChooserProps {
  value: ISODate;
  onChange: (value: ISODate) => void;
  today: ISODate;
}

/** 今日 / 昨日 quick chips + native date picker. */
export function DateChooser({ value, onChange, today }: DateChooserProps) {
  const yesterday = addDays(today, -1);
  const chip = (date: ISODate, text: string) => {
    const selected = value === date;
    return (
      <button
        type="button"
        aria-pressed={selected}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChange(date)}
        className={`pressable min-h-[48px] shrink-0 rounded-[14px] px-4 text-[15px] font-semibold ${
          selected ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink'
        }`}
      >
        {text}
      </button>
    );
  };
  return (
    <div className="flex gap-2">
      {chip(today, '今日')}
      {chip(yesterday, '昨日')}
      <DatePill value={value} onChange={onChange} label="日付を選ぶ" className="min-w-0 flex-1" />
    </div>
  );
}

interface CategoryGridProps {
  categories: Category[];
  value: string | null;
  onChange: (id: string) => void;
  error?: string;
}

/** Big emoji tiles; keeps the keyboard open while choosing (no focus steal). */
export function CategoryGrid({ categories, value, onChange, error }: CategoryGridProps) {
  const labelId = useId();
  return (
    <div>
      <div id={labelId} className="mb-1.5 text-[14px] font-semibold text-ink-2">
        カテゴリ
      </div>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-5 gap-1.5">
        {categories.map((c) => {
          const selected = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange(c.id)}
              className={`pressable flex min-h-[62px] flex-col items-center justify-center gap-0.5 rounded-[14px] border-2 px-0.5 ${
                selected ? 'border-progress bg-accent-soft' : 'border-transparent bg-surface-2'
              }`}
            >
              <span className="text-[24px] leading-none" aria-hidden="true">
                {c.emoji}
              </span>
              <span className={`w-full truncate text-center text-[11.5px] leading-tight ${selected ? 'font-semibold text-accent-ink' : 'text-ink-2'}`}>
                {c.name}
              </span>
            </button>
          );
        })}
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

interface SelectProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
  hideLabel?: boolean;
}

export function Select<T extends string | number>({ label, value, options, onChange, className = '', hideLabel }: SelectProps<T>) {
  const id = useId();
  return (
    <div className={className}>
      {!hideLabel && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <div className="relative">
        <select
          id={id}
          aria-label={hideLabel ? label : undefined}
          className="field appearance-none pr-10 font-medium"
          value={String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            const match = options.find((o) => String(o.value) === raw);
            if (match) onChange(match.value);
          }}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={18} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-3" />
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative grid min-h-[44px] min-w-[56px] shrink-0 place-items-center"
    >
      <span className={`block h-[31px] w-[51px] rounded-full transition-colors ${checked ? 'bg-good' : 'bg-surface-3'}`} />
      <span
        className={`absolute top-1/2 h-[27px] w-[27px] -translate-y-1/2 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[10px]' : '-translate-x-[10px]'
        }`}
      />
    </button>
  );
}
