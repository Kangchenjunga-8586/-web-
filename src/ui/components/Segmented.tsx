interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
  /** Keep focus where it is (e.g. the amount field keeps the keyboard open). */
  preserveFocus?: boolean;
}

/** iOS-style segmented control, implemented as an accessible radio group. */
export function Segmented<T extends string>({ options, value, onChange, label, size = 'md', className = '', preserveFocus }: Props<T>) {
  const height = size === 'sm' ? 'min-h-[36px] text-[14px]' : 'min-h-[40px] text-[15px]';
  return (
    <div role="radiogroup" aria-label={label} className={`flex rounded-[12px] bg-surface-2 p-[3px] ${className}`}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onMouseDown={preserveFocus ? (e) => e.preventDefault() : undefined}
            onClick={() => onChange(o.value)}
            className={`relative flex-1 rounded-[10px] px-2 font-medium whitespace-nowrap transition-colors ${height} ${
              selected ? 'bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-surface-3' : 'text-ink-2'
            }`}
          >
            {/* Expand the hit area to >= 44pt without changing the visual size. */}
            <span className="absolute inset-x-0 -inset-y-1" aria-hidden="true" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
