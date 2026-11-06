'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

interface ToastItem {
  id: number;
  message: string;
  icon?: 'check' | 'none';
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show(message: string, opts?: { icon?: 'check' | 'none'; action?: { label: string; onClick: () => void }; duration?: number }): void;
}

const ToastContext = createContext<ToastApi>({ show: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((t) => t.id !== id)), []);
  const show = useCallback<ToastApi['show']>(
    (message, opts = {}) => {
      const id = nextId.current++;
      setItems((xs) => [...xs.slice(-2), { id, message, icon: opts.icon ?? 'check', action: opts.action }]);
      setTimeout(() => dismiss(id), opts.duration ?? 2600);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast pop">
            {t.icon !== 'none' && <Icon name="check" size={16} strokeWidth={2.5} color="#86EFAC" />}
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
