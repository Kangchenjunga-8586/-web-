import { formatNumber } from '../../domain/money';

type Size = 'hero' | 'xl' | 'lg' | 'md' | 'sm';

const SIZES: Record<Size, { num: string; yen: string }> = {
  // Fluid sizes: full size at 440pt wide, shrinking gracefully with Safari text zoom.
  hero: { num: 'text-[clamp(34px,10vw,44px)] leading-[1.05] font-semibold tracking-[-0.02em]', yen: 'text-[clamp(20px,5.9vw,26px)] font-semibold mr-0.5' },
  xl: { num: 'text-[clamp(22px,6.8vw,30px)] leading-tight font-semibold tracking-[-0.01em]', yen: 'text-[clamp(15px,4.3vw,19px)] font-semibold mr-px' },
  lg: { num: 'text-[22px] leading-tight font-semibold', yen: 'text-[15px] font-semibold mr-px' },
  md: { num: 'text-[17px] font-semibold', yen: 'text-[13px] font-semibold mr-px' },
  sm: { num: 'text-[15px] font-medium', yen: 'text-[12px] font-medium' },
};

interface MoneyProps {
  value: number;
  size?: Size;
  /** Show + for positive values (− is always shown for negatives). */
  signed?: boolean;
  suffix?: string;
  className?: string;
}

/**
 * Amount with a clear number/unit hierarchy: the ¥ sign is set smaller than the digits.
 * Screen readers get a plain "¥450,000" label.
 */
export function Money({ value, size = 'md', signed = false, suffix, className = '' }: MoneyProps) {
  const s = SIZES[size];
  const sign = value < 0 ? '−' : signed && value > 0 ? '+' : '';
  const digits = formatNumber(Math.abs(value));
  const label = `${sign}¥${digits}${suffix ?? ''}`;
  return (
    <span className={`inline-flex items-baseline whitespace-nowrap ${className}`}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className={s.num}>
        {sign}
      </span>
      <span aria-hidden="true" className={s.yen}>
        ¥
      </span>
      <span aria-hidden="true" className={s.num}>
        {digits}
      </span>
      {suffix && (
        <span aria-hidden="true" className="ml-0.5 text-[0.8em] font-medium text-ink-3">
          {suffix}
        </span>
      )}
    </span>
  );
}
