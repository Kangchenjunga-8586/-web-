import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ToastData {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'error';
}

interface Props {
  toast: ToastData | null;
  onDismiss: () => void;
}

/** Short confirmation above the bottom navigation, with optional undo. */
export function Toast({ toast, onDismiss }: Props) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, toast.actionLabel ? 5000 : 3000);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}
      role="status"
      aria-live="polite"
    >
      {toast && (
        <div
          key={toast.id}
          className={`anim-sheet pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-2xl px-4 py-2 shadow-xl ${
            toast.tone === 'error' ? 'bg-danger text-white' : 'bg-[#1d1d1f] text-white dark:bg-[#3a3a3c]'
          }`}
          data-testid="toast"
        >
          <p className="min-w-0 flex-1 py-1.5 text-[15px] leading-snug">{toast.message}</p>
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              className="-my-1 min-h-[44px] shrink-0 rounded-xl px-2 text-[15px] font-semibold text-[#8cc0ff]"
              onClick={() => {
                toast.onAction?.();
                onDismiss();
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
