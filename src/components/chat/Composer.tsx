'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { LANGUAGE_LABELS, LIMITS, MODE_LABELS } from '@shared/constants.ts';
import type { Language, Mode } from '@/lib/types';
import { Icon } from '@/components/ui/Icon';

export interface ComposerHandle {
  focus(): void;
  setValue(v: string): void;
}

const MODE_BADGE: Record<Mode, string> = { explain: 'badge-explain', debug: 'badge-debug', practice: 'badge-practice' };

function isCoarsePointer() {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
}

export const Composer = forwardRef<
  ComposerHandle,
  {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    onStop?: () => void;
    streaming: boolean;
    submitting?: boolean;
    mode: Mode;
    language: Language;
    enterToSend: boolean;
    placeholder: string;
    rows?: number;
    mono?: boolean;
    label?: string;
  }
>(function Composer({ value, onChange, onSend, onStop, streaming, submitting = false, mode, language, enterToSend, placeholder, rows = 2, mono = false, label = 'Message CodeBloom' }, ref) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [composing, setComposing] = useState(false);
  const [coarse, setCoarse] = useState(false);
  useEffect(() => setCoarse(isCoarsePointer()), []);

  useImperativeHandle(ref, () => ({
    focus: () => ta.current?.focus(),
    setValue: (v: string) => {
      onChange(v);
      requestAnimationFrame(() => {
        ta.current?.focus();
        const len = ta.current?.value.length ?? 0;
        ta.current?.setSelectionRange(len, len);
      });
    },
  }));

  // Grow with the text (capped by CSS max-height).
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.4)}px`;
  }, [value]);

  const empty = value.trim().length === 0;
  const tooLong = value.length > LIMITS.maxMessageChars;
  const canSend = !empty && !tooLong && !streaming && !submitting;

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || composing || e.nativeEvent.isComposing) return;
    const wantsSend = enterToSend && !coarse ? !e.shiftKey && !e.altKey : e.metaKey || e.ctrlKey;
    if (wantsSend) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
    >
      <label htmlFor="composer" className="sr-only">
        {label}
      </label>
      <textarea
        id="composer"
        ref={ta}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        aria-invalid={tooLong || undefined}
        aria-describedby={tooLong ? 'composer-err' : undefined}
        style={mono ? { fontFamily: 'var(--mono)', fontSize: 14 } : undefined}
        spellCheck={!mono}
      />
      {tooLong && (
        <p id="composer-err" className="field-error" style={{ padding: '0 16px' }}>
          <Icon name="alertCircle" size={14} strokeWidth={2} />
          That&apos;s {value.length.toLocaleString()} characters — the limit is {LIMITS.maxMessageChars.toLocaleString()}. Try a smaller piece of code.
        </p>
      )}
      <div className="composer-foot">
        <span className={`badge ${MODE_BADGE[mode]}`}>
          <span className={`dot dot-${mode}`} aria-hidden="true" />
          {MODE_LABELS[mode]}
        </span>
        <span className="badge">{LANGUAGE_LABELS[language]}</span>
        {streaming ? (
          <button type="button" className="btn btn-dark btn-sm" onClick={onStop} style={{ marginLeft: 'auto', minHeight: 36, borderRadius: 10 }}>
            <Icon name="stop" size={11} />
            Stop
          </button>
        ) : (
          <>
            <span className="composer-meta desktop-only" style={{ marginLeft: 'auto' }}>
              {enterToSend && !coarse ? (
                <>
                  <span className="kbd">Enter</span> send <span className="kbd">Shift</span>+<span className="kbd">Enter</span> new line
                </>
              ) : (
                <>
                  <span className="kbd">Ctrl</span>+<span className="kbd">Enter</span> send
                </>
              )}
            </span>
            <button
              type="submit"
              className="btn btn-primary btn-icon"
              aria-label="Send message"
              disabled={!canSend}
              style={{ borderRadius: 10, marginLeft: coarse ? 'auto' : undefined }}
            >
              {submitting ? <span className="spinner" aria-hidden="true" style={{ borderColor: 'rgb(255 255 255 / 35%)', borderTopColor: '#fff' }} /> : <Icon name="arrowUp" size={16} />}
            </button>
          </>
        )}
      </div>
    </form>
  );
});
