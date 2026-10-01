import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from './Icons';

/** Large-title page header that clears the status bar / Dynamic Island. */
export function ScreenHeader({ title, subtitle, trailing, onBack, backLabel = '戻る' }: {
  title: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <header className="page-x pt-[max(env(safe-area-inset-top),12px)]">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="pressable -ml-3 flex min-h-[44px] items-center gap-0.5 pr-3 pl-1 text-[17px] text-accent-ink"
        >
          <ChevronLeft size={22} />
          {backLabel}
        </button>
      )}
      <div className={`flex items-end justify-between gap-3 ${onBack ? 'pt-0' : 'pt-3'} pb-3`}>
        <div className="min-w-0">
          {subtitle && <div className="text-[13px] font-medium text-ink-3">{subtitle}</div>}
          <h1 className="text-[30px] leading-tight font-bold tracking-[-0.01em]">{title}</h1>
        </div>
        {trailing}
      </div>
    </header>
  );
}

export function Section({
  title,
  children,
  footer,
  className = 'mt-6',
  id,
}: {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Anchor target for navigate(route, id); clears the status bar when scrolled to. */
  id?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-[calc(max(env(safe-area-inset-top),12px)+8px)] ${className}`}>
      {title && <h2 className="mb-2 px-1 text-[13px] font-semibold text-ink-3">{title}</h2>}
      <div className="card overflow-hidden">{children}</div>
      {footer && <p className="mt-2 px-1 text-[13px] leading-snug text-ink-3">{footer}</p>}
    </section>
  );
}

interface RowProps {
  icon?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  trailing?: ReactNode;
  testId?: string;
}

/** Grouped-list row. Rows separated by inset hairlines. */
export function Row({ icon, title, detail, value, onClick, chevron = !!onClick, destructive, trailing, testId }: RowProps) {
  const content = (
    <>
      {icon && <span className="grid size-8 shrink-0 place-items-center text-[20px]">{icon}</span>}
      <span className="min-w-0 flex-1 text-left">
        <span className={`block text-[16px] leading-snug ${destructive ? 'font-medium text-danger' : ''}`}>{title}</span>
        {detail && <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{detail}</span>}
      </span>
      {value !== undefined && <span className="shrink-0 text-right text-[15px] text-ink-2">{value}</span>}
      {trailing}
      {chevron && <ChevronRight size={18} className="shrink-0 text-ink-3" />}
    </>
  );
  const cls =
    'flex w-full min-h-[52px] items-center gap-3 px-4 py-2.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-hairline';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} active:bg-surface-2`} data-testid={testId}>
        {content}
      </button>
    );
  }
  return (
    <div className={cls} data-testid={testId}>
      {content}
    </div>
  );
}

export function EmptyState({ emoji, title, message, action }: { emoji: string; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="text-[40px]" aria-hidden="true">
        {emoji}
      </div>
      <p className="mt-2 text-[17px] font-semibold">{title}</p>
      {message && <p className="mt-1 text-[14px] leading-relaxed text-ink-3">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
