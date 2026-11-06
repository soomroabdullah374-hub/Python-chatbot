'use client';
import type { Language, Mode } from '@/lib/types';
import { Icon, Logo } from '@/components/ui/Icon';

export const STARTERS: Array<{ tag: string; badge: string; text: string; fill: string; mode: Mode; language: Language }> = [
  { tag: 'PYTHON · EXPLAIN', badge: 'badge-explain', text: 'What is a variable in Python?', fill: 'What is a variable in Python?', mode: 'explain', language: 'python' },
  { tag: 'JAVASCRIPT · EXPLAIN', badge: 'badge-explain', text: 'When do I use let instead of const?', fill: 'When do I use let instead of const?', mode: 'explain', language: 'javascript' },
  {
    tag: 'SQL · EXPLAIN',
    badge: 'badge-explain',
    text: 'Explain this SQL query line by line',
    fill: 'Explain this SQL query line by line:\n\nSELECT name, score\nFROM students\nWHERE score >= 50\nORDER BY score DESC;',
    mode: 'explain',
    language: 'sql',
  },
  { tag: 'PYTHON · PRACTICE', badge: 'badge-practice', text: 'Give me a small loop exercise', fill: 'Give me a small loop exercise.', mode: 'practice', language: 'python' },
];

export function EmptyState({ onPick, children }: { onPick: (s: (typeof STARTERS)[number]) => void; children: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 auto', width: '100%', maxWidth: 820, margin: '0 auto', padding: '64px 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 36, minHeight: 'calc(100vh - 160px)' }}>
      <div className="rise" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
        <span className="float" style={{ display: 'inline-flex', width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--sh-md)' }}>
          <Logo size={32} />
        </span>
        <h2 className="h1" style={{ fontSize: 38 }}>
          Programming, explained simply.
        </h2>
        <p className="lead" style={{ fontSize: 16 }}>
          Ask a question, paste a small code example, or explore a concept.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 12 }}>
        {STARTERS.map((s, i) => (
          <button
            key={s.text}
            type="button"
            className={`card lift rise d${i + 1}`}
            onClick={() => onPick(s)}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px', textAlign: 'left', font: 'inherit', color: 'var(--text)', cursor: 'pointer' }}
          >
            <span style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className={`badge mono ${s.badge}`} style={{ alignSelf: 'flex-start' }}>
                {s.tag}
              </span>
              <span style={{ fontSize: 15, fontWeight: 500 }}>{s.text}</span>
            </span>
            <Icon name="arrowUpRight" size={16} color="var(--text-3)" style={{ flex: 'none', marginTop: 4 }} />
          </button>
        ))}
      </div>
      <div className="rise d5" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  );
}
