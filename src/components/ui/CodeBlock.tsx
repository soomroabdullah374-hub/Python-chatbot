'use client';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { tokenize, type Token } from '@/lib/highlight';
import { Icon } from './Icon';
import { useToast } from './Toasts';

function Tokens({ tokens }: { tokens: Token[] }) {
  if (!tokens.length) return <> </>;
  return (
    <>
      {tokens.map((t, i) => (t.cls ? <span key={i} className={`tok-${t.cls}`}>{t.text}</span> : <span key={i}>{t.text}</span>))}
    </>
  );
}

interface DiffRow {
  kind: 'add' | 'del' | 'ctx';
  text: string;
}

function parseDiff(code: string): DiffRow[] {
  return code.split('\n').map((line) => {
    if (/^\+\s?/.test(line) && !line.startsWith('+++')) return { kind: 'add', text: line.replace(/^\+\s?/, '') };
    if (/^-\s?/.test(line) && !line.startsWith('---')) return { kind: 'del', text: line.replace(/^-\s?/, '') };
    return { kind: 'ctx', text: line.replace(/^ /, '') };
  });
}

export interface CodeBlockProps {
  code: string;
  lang?: string;
  title?: string;
  /** 1-based lines to highlight (e.g. the line that fails). */
  highlight?: number[];
  diff?: boolean;
  diffLine?: number;
  lineNumbers?: boolean;
  head?: boolean;
  copyLabel?: string;
  badge?: React.ReactNode;
}

export const CodeBlock = memo(function CodeBlock({
  code,
  lang,
  title,
  highlight = [],
  diff = false,
  diffLine,
  lineNumbers = true,
  head = true,
  copyLabel = 'Copy',
  badge,
}: CodeBlockProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const clean = code.replace(/\s+$/, '');
  const rows = useMemo(() => (diff ? parseDiff(clean) : null), [clean, diff]);
  const lines = useMemo(() => (rows ? rows.map((r) => tokenize(r.text, lang)[0] ?? []) : tokenize(clean, lang)), [rows, clean, lang]);

  const copy = async () => {
    const text = rows ? rows.filter((r) => r.kind !== 'del').map((r) => r.text).join('\n') : clean;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.show(diff ? 'Fix copied to clipboard' : 'Code copied to clipboard');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.show('Copy failed — select the code and copy it manually', { icon: 'none' });
    }
  };

  const label = [title ?? (lang || 'code'), diff && diffLine ? `line ${diffLine}` : null].filter(Boolean).join(' · ');
  return (
    <div className="code">
      {head && (
        <div className="code-head">
          <span>{label}</span>
          {badge ?? (
            <button type="button" className={`code-copy${copied ? ' is-done pop' : ''}`} onClick={copy} aria-label={copied ? 'Copied' : `${copyLabel} code`}>
              <Icon name={copied ? 'check' : 'copy'} size={14} strokeWidth={copied ? 2.5 : 1.75} />
              {copied ? 'Copied' : copyLabel}
            </button>
          )}
        </div>
      )}
      <div className="code-rows" role="group" aria-label={`${lang || 'code'} code`}>
        {lines.map((toks, i) => {
          const kind = rows?.[i]?.kind;
          const cls = kind === 'add' ? ' add' : kind === 'del' ? ' del' : highlight.includes(i + 1) ? ' hl' : '';
          return (
            <div key={i} className={`row${cls}`}>
              {rows ? (
                <span className="sig" aria-label={kind === 'add' ? 'added' : kind === 'del' ? 'removed' : undefined}>
                  {kind === 'add' ? '+' : kind === 'del' ? '−' : ' '}
                </span>
              ) : (
                lineNumbers && <span className="ln">{i + 1}</span>
              )}
              <span style={kind === 'del' ? { opacity: 0.8 } : undefined}>
                <Tokens tokens={toks} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
