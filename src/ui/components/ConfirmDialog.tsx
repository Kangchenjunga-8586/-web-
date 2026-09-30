import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** When set, the user must type this exact text to enable the confirm button. */
  requireText?: string;
}

interface Props extends ConfirmOptions {
  onResult: (confirmed: boolean) => void;
}

/** Centered iOS-style alert used for destructive confirmations. */
export function ConfirmDialog({ title, message, confirmLabel, cancelLabel = 'キャンセル', destructive, requireText, onResult }: Props) {
  const titleId = useId();
  const [typed, setTyped] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onResultRef = useRef(onResult);
  const needsText = Boolean(requireText);
  const canConfirm = !requireText || typed.trim() === requireText;

  useEffect(() => {
    onResultRef.current = onResult;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (needsText ? inputRef.current : cancelRef.current)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onResultRef.current(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [needsText]);

  return createPortal(
    <div
      className="fixed inset-x-0 top-0 z-[60] grid place-items-center px-8"
      style={{ height: 'var(--vvh)' }}
      role="presentation"
    >
      <div className="anim-fade absolute inset-0 bg-[var(--backdrop)]" aria-hidden="true" onClick={() => onResult(false)} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="anim-pop relative w-full max-w-[340px] overflow-hidden rounded-[22px] bg-surface text-center shadow-2xl"
      >
        <div className="px-5 pt-5 pb-4">
          <h2 id={titleId} className="text-[17px] font-semibold">
            {title}
          </h2>
          {message && <p className="mt-1.5 text-[14px] leading-relaxed whitespace-pre-line text-ink-2">{message}</p>}
          {requireText && (
            <label className="mt-3 block text-left text-[13px] text-ink-2">
              確認のため「{requireText}」と入力してください
              <input
                ref={inputRef}
                className="field mt-1.5"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                enterKeyHint="done"
                aria-label={`確認のため「${requireText}」と入力`}
              />
            </label>
          )}
        </div>
        <div className="grid grid-cols-2 border-t border-hairline">
          <button
            ref={cancelRef}
            type="button"
            className="min-h-[50px] border-r border-hairline text-[17px] text-accent-ink active:bg-surface-2"
            onClick={() => onResult(false)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            className={`min-h-[50px] text-[17px] font-semibold active:bg-surface-2 disabled:opacity-35 ${destructive ? 'text-danger' : 'text-accent-ink'}`}
            onClick={() => onResult(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
