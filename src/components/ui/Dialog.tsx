'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/** Destructive confirmation (Design.md "ConfirmDialog"): focus trap, Escape, focus return. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
  icon = true,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Tab' && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea');
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="dialog-wrap scrim" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-b`}
        className="dialog pop"
        style={{ width: '100%', maxWidth: 440, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {icon && (
          <span className="feature-icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            <Icon name="warning" size={20} />
          </span>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2 id={`${id}-t`} className="h3">
            {title}
          </h2>
          <div id={`${id}-b`} className="muted" style={{ fontSize: 14 }}>
            {body}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" style={{ borderColor: 'rgb(255 255 255 / 35%)', borderTopColor: '#fff' }} /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
