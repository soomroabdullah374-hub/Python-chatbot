'use client';
import Link from 'next/link';
import { LANGUAGE_LABELS } from '@shared/constants.ts';
import { parseConcept, parseList, parseTerms, splitSections } from '@/lib/answer';
import type { ChatMessage, Mode, Profile } from '@/lib/types';
import { Icon } from '@/components/ui/Icon';

const LEVEL: Record<Profile['experience_level'], string> = { new: 'Brand new', basics: 'Some basics', comfortable: 'Comfortable' };

export interface PracticeState {
  hints: Record<string, number>;
  solutions: Record<string, boolean>;
}

function practiceProgress(messages: ChatMessage[], state: PracticeState) {
  let exerciseIdx = -1;
  messages.forEach((m, i) => {
    if (m.role === 'assistant' && m.status === 'completed' && splitSections(m.content).some((s) => s.kind === 'exercise')) exerciseIdx = i;
  });
  const after = exerciseIdx >= 0 ? messages.slice(exerciseIdx + 1) : [];
  const attempts = after.filter((m) => m.role === 'user').length;
  const withHints = [...after].reverse().find((m) => m.role === 'assistant' && splitSections(m.content).some((s) => s.kind === 'hints'));
  const hintsShown = withHints ? Math.max(1, state.hints[withHints.id] ?? 1) : 0;
  const hintTotal = withHints ? Math.max(1, Math.min(3, parseList(splitSections(withHints.content).find((s) => s.kind === 'hints')?.body ?? '', 3).length)) : 3;
  const solutionShown = withHints ? Boolean(state.solutions[withHints.id]) : false;
  const checkSeen = after.some((m) => m.role === 'assistant' && splitSections(m.content).some((s) => s.kind === 'check'));
  const steps = [
    { label: 'Exercise', done: exerciseIdx >= 0, meta: exerciseIdx >= 0 ? 'done' : '' },
    { label: 'Attempt 1', done: attempts >= 1, meta: attempts >= 1 ? 'done' : '' },
    { label: 'Hints', done: hintsShown >= hintTotal || attempts >= 2 || solutionShown, meta: withHints ? `${hintsShown}/${hintTotal}` : '' },
    { label: 'Attempt 2', done: attempts >= 2, meta: attempts >= 2 ? 'done' : solutionShown ? 'skipped' : '' },
    { label: 'Understanding check', done: checkSeen && (attempts >= 2 || solutionShown), meta: '' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const active = steps.findIndex((s) => !s.done);
  return { steps, doneCount, active };
}

export function LearningPanel({
  mode,
  messages,
  profile,
  topic,
  practice,
  onStartPractice,
  onExplainConcept,
  className,
  onClose,
}: {
  mode: Mode;
  messages: ChatMessage[];
  profile: Profile;
  topic: string;
  practice: PracticeState;
  onStartPractice: () => void;
  onExplainConcept: (concept: string) => void;
  className: string;
  onClose?: () => void;
}) {
  const assistants = messages.filter((m) => m.role === 'assistant' && m.status === 'completed');
  const latestWith = (kind: string) => [...assistants].reverse().map((m) => splitSections(m.content).find((s) => s.kind === kind)).find(Boolean);

  const closeBtn = onClose && (
    <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Hide learning panel" onClick={onClose} style={{ alignSelf: 'flex-end', marginBottom: -20 }}>
      <Icon name="close" size={16} />
    </button>
  );

  if (mode === 'practice') {
    const { steps, doneCount, active } = practiceProgress(messages, practice);
    const conceptSec = latestWith('concept');
    const concept = conceptSec ? parseConcept(conceptSec.body) : null;
    return (
      <aside className={`panel ${className}`} aria-label="Exercise progress">
        {closeBtn}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="label">Progress</h2>
            <span className="mono small faint">{doneCount}/5</span>
          </div>
          <div aria-hidden="true" style={{ height: 6, borderRadius: 999, background: 'var(--sunken)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(doneCount / 5) * 100}%`, borderRadius: 999, background: 'var(--practice)', transition: 'width 500ms var(--ease)' }} />
          </div>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', fontSize: 14 }}>
            {steps.map((st, i) => (
              <li key={st.label} aria-current={i === active ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0' }}>
                {st.done ? (
                  <span className="pop" style={{ display: 'inline-flex', width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--practice)' }}>
                    <Icon name="check" size={12} strokeWidth={3} color="#FFFFFF" />
                  </span>
                ) : i === active ? (
                  <span className="live-dot" style={{ width: 22, height: 22, borderRadius: '50%', border: '6px solid var(--primary)', background: 'var(--surface)' }} />
                ) : (
                  <span style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid var(--control)' }} />
                )}
                <span style={{ flex: '1 1 auto' }}>{st.label}</span>
                <span className="mono small faint">{st.meta}</span>
              </li>
            ))}
          </ol>
        </section>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 className="label">Concept</h2>
          {concept ? (
            <div className="card" style={{ padding: '14px 16px', fontSize: 14, lineHeight: 1.55 }}>
              <span className="badge mono badge-explain">{LANGUAGE_LABELS[profile.preferred_language].toUpperCase()} · PRACTICE</span>
              <strong style={{ display: 'block', paddingTop: 8, fontWeight: 600 }}>{concept.name}</strong>
              {concept.definition && <span className="muted">{concept.definition}</span>}
            </div>
          ) : (
            <p className="small faint">Ask for an exercise and its concept appears here.</p>
          )}
          {concept && (
            <button type="button" className="btn-link btn" style={{ alignSelf: 'flex-start', fontSize: 14, fontWeight: 500 }} onClick={() => onExplainConcept(concept.name)}>
              Explain this concept first
            </button>
          )}
        </section>
      </aside>
    );
  }

  const termsSec = latestWith('terms');
  const terms = termsSec ? parseTerms(termsSec.body) : [];
  return (
    <aside className={`panel ${className}`} aria-label="Learning panel">
      {closeBtn}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="label">Key terms</h2>
          <span className="badge mono">{terms.length}</span>
        </div>
        {terms.length ? (
          <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
            {terms.map((t) => (
              <div key={t.term} className="row-hover" style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <dt style={{ fontWeight: 600 }}>{t.term}</dt>
                <dd style={{ margin: '2px 0 0', color: 'var(--text-2)' }}>{t.definition}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="small faint">New terms from your answers show up here.</p>
        )}
      </section>
      {mode === 'explain' && assistants.length > 0 && (
        <section className="hero" style={{ borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="hero-grid" aria-hidden="true" />
          <span className="badge mono" style={{ position: 'relative', alignSelf: 'flex-start', background: 'rgb(22 163 74 / 18%)', borderColor: 'rgb(134 239 172 / 30%)', color: '#86EFAC' }}>
            NEXT STEP
          </span>
          <p style={{ position: 'relative', fontSize: 15, fontWeight: 500, color: '#FFFFFF' }}>
            Try one short exercise on <span style={{ color: '#C4B5FD' }}>{topic}</span>.
          </p>
          <button type="button" className="btn btn-light btn-sm" style={{ position: 'relative', alignSelf: 'flex-start' }} onClick={onStartPractice}>
            Start practice
            <Icon name="arrowRight" size={14} strokeWidth={2} className="arrow" />
          </button>
        </section>
      )}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 className="label">Answer settings</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span className="badge">{profile.explanation_depth === 'detailed' ? 'Detailed' : 'Concise'}</span>
          <span className="badge">{LEVEL[profile.experience_level]}</span>
          <span className="badge">{profile.explanation_language === 'roman_ur' ? 'Roman Urdu' : 'English'}</span>
        </div>
        <Link href="/settings" style={{ fontSize: 14, fontWeight: 500 }}>
          Change preferences
        </Link>
      </section>
    </aside>
  );
}
