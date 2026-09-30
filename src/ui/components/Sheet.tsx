import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './Icons';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Sticky footer (primary action). Stays above the keyboard and home indicator. */
  footer?: ReactNode;
  /** Optional element rendered left of the close button (e.g. a segmented control). */
  headerExtra?: ReactNode;
  /** Visually hide the title (still used as the accessible name). */
  hideTitle?: boolean;
  testId?: string;
}

let openSheets = 0;

/**
 * iOS-style bottom sheet. Positioned against the *visual* viewport (--kb / --vvh) so the
 * footer button is never hidden by the software keyboard, and padded for the home
 * indicator when the keyboard is closed.
 */
export function Sheet({ title, onClose, children, footer, headerExtra, hideTitle, testId }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    openSheets += 1;
    document.documentElement.style.overflow = 'hidden';
    // Only move focus if nothing inside already took it (e.g. autofocus amount field).
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openSheets -= 1;
      if (openSheets === 0) document.documentElement.style.overflow = '';
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div className="anim-fade absolute inset-0 bg-[var(--backdrop)]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid={testId}
        className="sheet-panel anim-sheet absolute inset-x-0 mx-auto flex max-w-[560px] flex-col rounded-t-[26px] bg-surface outline-none"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-surface-3" aria-hidden="true" />
        <header className="flex shrink-0 items-center gap-3 px-5 pt-2 pb-2">
          <h2 id={titleId} className={hideTitle ? 'sr-only' : 'min-w-0 flex-1 truncate text-[19px] font-semibold'}>
            {title}
          </h2>
          {headerExtra && <div className={hideTitle ? 'min-w-0 flex-1' : 'shrink-0'}>{headerExtra}</div>}
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="pressable -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-2"
          >
            <span className="grid size-8 place-items-center rounded-full bg-surface-2">
              <CloseIcon size={18} />
            </span>
          </button>
        </header>
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 ${footer ? 'pb-2' : 'sheet-bottom-pad'}`}>
          {children}
        </div>
        {footer && <div className="sheet-bottom-pad shrink-0 border-t border-hairline px-5 pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
