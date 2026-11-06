'use client';
import { memo, useMemo } from 'react';
import { safeSourceUrl } from '@shared/citations.ts';
import { LANGUAGE_LABELS, MODE_LABELS } from '@shared/constants.ts';
import type { ErrorCode } from '@shared/errors.ts';
import {
  extractFirstFence,
  flaggedLines,
  parseConcept,
  parseExercise,
  parseLineNotes,
  parseList,
  parseTerms,
  prepareCitations,
  type Section,
  splitSections,
} from '@/lib/answer';
import type { Language, MessageStatus, Mode, Rating, Source, TurnStage } from '@/lib/types';
import { Banner } from '@/components/ui/Banner';
import { CARET } from '@/components/ui/caret';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { Icon, Logo } from '@/components/ui/Icon';
import { Markdown } from '@/components/ui/Markdown';

export interface AnswerView {
  id: string | null;
  content: string;
  status: MessageStatus;
  mode: Mode;
  language: Language;
  sources: Source[];
  rating: Rating | null;
  bookmarked: boolean;
  errorCode?: ErrorCode | 'NETWORK' | null;
}

export interface LiveInfo {
  stage: TurnStage;
  sourcesFound: number | null;
}

const MODE_BADGE: Record<Mode, string> = { explain: 'badge-explain', debug: 'badge-debug', practice: 'badge-practice' };
const EXT: Record<Language, string> = { python: 'py', javascript: 'js', typescript: 'ts', sql: 'sql', html_css: 'html' };

function Label({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 className="label" id={id}>
      {children}
    </h2>
  );
}

function Check() {
  return <Icon name="check" size={13} color="#15803D" strokeWidth={2.5} />;
}

function Dots() {
  return (
    <span className="dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function StatusRow({ live }: { live: LiveInfo }) {
  const stages: TurnStage[] = ['submitting', 'retrieving', 'streaming', 'saving'];
  const at = stages.indexOf(live.stage === 'accepted' ? 'retrieving' : live.stage);
  const done = (i: number) => at > i;
  if (live.stage === 'submitting') {
    return (
      <div className="status" style={{ paddingTop: 6 }}>
        <span className="step now">
          <span className="spinner" aria-hidden="true" />
          Sending…
        </span>
      </div>
    );
  }
  const found = live.sourcesFound;
  return (
    <div className="status" style={{ paddingTop: 6 }}>
      <span className="step">
        <Check />
        Accepted
      </span>
      {at === 1 ? (
        <span className="step now">
          <Dots />
          Finding approved material
        </span>
      ) : (
        <span className="step">
          <Check />
          {found ? `Retrieved ${found} source${found === 1 ? '' : 's'}` : 'No matching references'}
        </span>
      )}
      {at === 2 && (
        <span className="step now">
          <Dots />
          Writing answer
        </span>
      )}
      {done(2) && (
        <span className="step">
          <Check />
          Written
        </span>
      )}
      {at === 3 ? (
        <span className="step now">
          <Dots />
          Saving
        </span>
      ) : (
        <span className="step" style={{ opacity: 0.6 }}>
          Save
        </span>
      )}
    </div>
  );
}

function LineList({ body }: { body: string }) {
  const notes = parseLineNotes(body);
  if (!notes) return <Markdown className="prose">{body}</Markdown>;
  return (
    <ol className="line-list">
      {notes.map((n, i) => (
        <li key={i} className="row-hover">
          <span className={`badge mono${n.flagged ? ' badge-debug' : ''}`} style={{ flex: 'none' }}>
            {n.label}
          </span>
          <Markdown className="prose" >{n.text}</Markdown>
        </li>
      ))}
    </ol>
  );
}

export function TermsInline({ body }: { body: string }) {
  const terms = parseTerms(body);
  if (!terms.length) return null;
  return (
    <section className="sec terms-inline">
      <Label>Key terms</Label>
      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
        {terms.map((t) => (
          <div key={t.term} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
            <dt style={{ fontWeight: 600 }}>{t.term}</dt>
            <dd style={{ margin: '2px 0 0', color: 'var(--text-2)' }}>{t.definition}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function HintsCard({
  hints,
  shown,
  onMore,
  hasSolution,
  solutionShown,
  onSolution,
}: {
  hints: string[];
  shown: number;
  onMore: () => void;
  hasSolution: boolean;
  solutionShown: boolean;
  onSolution: () => void;
}) {
  const total = hints.length;
  return (
    <section className="card rise" aria-labelledby="hints-h" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <h2 id="hints-h" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600 }}>
          <Icon name="bulb" size={16} color="#B45309" />
          Hints
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div aria-hidden="true" style={{ display: 'flex', gap: 4 }}>
            {hints.map((_, i) => (
              <span key={i} style={{ width: 22, height: 4, borderRadius: 2, background: i < shown ? 'var(--debug)' : 'var(--sunken)', transition: 'background-color 300ms var(--ease)' }} />
            ))}
          </div>
          <span className="mono small faint">
            {shown} of {total}
          </span>
        </div>
      </div>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none' }} aria-live="polite">
        {hints.slice(0, shown).map((h, i) => (
          <li key={i} className="rise" style={{ display: 'flex', gap: 14, padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 15 }}>
            <span className="badge mono badge-debug" style={{ flex: 'none' }}>
              {i + 1}
            </span>
            <Markdown className="prose">{h}</Markdown>
          </li>
        ))}
      </ol>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '12px 18px', background: 'var(--subtle)' }}>
        {shown < total && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onMore}>
            Show hint {shown + 1} of {total}
          </button>
        )}
        {hasSolution && !solutionShown && (
          <button type="button" className="btn btn-link btn-sm" onClick={onSolution}>
            Show full solution
          </button>
        )}
        <span className="small faint" style={{ marginLeft: 'auto' }}>
          Try again first, then send your new attempt.
        </span>
      </div>
    </section>
  );
}

export interface AssistantMessageProps {
  message: AnswerView;
  live?: LiveInfo | null;
  isLast: boolean;
  exerciseNumber?: number;
  level: string;
  hintsShown: number;
  solutionShown: boolean;
  onHint: () => void;
  onSolution: () => void;
  onRetry?: () => void;
  onCopy: () => void;
  onToggleSave: () => void;
  onRate: (r: Rating | null) => void;
  voted: boolean;
  onFollowUp: (text: string, mode?: Mode) => void;
  onAnswerCheck: (question: string) => void;
}

function bannerFor(status: MessageStatus, code: AnswerView['errorCode']) {
  if (status === 'interrupted') return { tone: 'warn' as const, icon: 'stopSquare' as const, title: 'Answer interrupted', body: "The partial text is kept, but it won't be used as context." };
  if (code === 'SAVE_FAILED') return { tone: 'danger' as const, icon: 'unsaved' as const, title: 'Answer received, but could not be saved', body: "It won't appear in your history after you leave." };
  if (code === 'GENERATION_TIMEOUT') return { tone: 'warn' as const, icon: 'clock' as const, title: 'The answer took too long', body: 'The partial text is kept; you can retry.' };
  if (status === 'incomplete') return { tone: 'warn' as const, icon: 'stopSquare' as const, title: 'This answer was cut short', body: "The partial text is kept, but it won't be used as context." };
  if (status === 'failed') return { tone: 'danger' as const, icon: 'warning' as const, title: "The tutor isn't responding", body: "This isn't anything you did. Your message is kept." };
  return null;
}

export const AssistantMessage = memo(function AssistantMessage(props: AssistantMessageProps) {
  const { message, live, isLast } = props;
  const streaming = Boolean(live);
  const valid = useMemo(() => new Set(message.sources.map((s) => s.label)), [message.sources]);
  const citeBase = message.id ?? 'live';
  const anchorId = message.id ? `m-${message.id}` : undefined;
  const liveSources = live?.sourcesFound ?? 0;
  const sections = useMemo(() => {
    const allowed = streaming && liveSources ? new Set(Array.from({ length: liveSources }, (_, i) => `S${i + 1}`)) : valid;
    return splitSections(prepareCitations(message.content, allowed));
  }, [message.content, streaming, liveSources, valid]);
  const highlight = useMemo(() => flaggedLines(sections), [sections]);

  const exercise = sections.find((s) => s.kind === 'exercise');
  const feedback = sections.find((s) => s.kind === 'feedback');
  const hintsSec = sections.find((s) => s.kind === 'hints');
  const solutionSec = sections.find((s) => s.kind === 'solution');
  const conceptSec = sections.find((s) => s.kind === 'concept');
  const followSec = sections.find((s) => s.kind === 'followups');
  const isPractice = message.mode === 'practice';

  // Streaming caret goes at the end of the last visible text block.
  const lastTextIdx = (() => {
    if (!streaming) return -1;
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      if (!['terms', 'followups', 'concept', 'hints', 'solution'].includes(sections[i].kind)) return i;
    }
    return -1;
  })();
  const withCaret = (s: Section, i: number) => (i === lastTextIdx && !/```[^`]*$/.test(s.body) ? s.body + CARET : s.body);

  const banner = !streaming ? bannerFor(message.status, message.errorCode) : null;
  const completed = message.status === 'completed' && !streaming;

  // In a practice feedback turn the understanding check is about the solution, so it waits until
  // the learner has revealed it (or there is no solution to reveal).
  const checkSec = sections.find((s) => s.kind === 'check');
  const deferCheck = Boolean(hintsSec || solutionSec) && Boolean(checkSec);
  const renderSection = (s: Section, i: number, force = false) => {
    if (deferCheck && !force && s.kind === 'check') return null;
    const body = withCaret(s, i);
    const key = `${s.kind}-${i}`;
    const d = `d${Math.min(i + 2, 8)}`;
    switch (s.kind) {
      case 'lead':
        return (
          <section key={key} className={`sec rise ${d}`}>
            {s.heading && <Label>{s.heading}</Label>}
            <Markdown className="answer-lead" citePrefix={citeBase}>
              {body}
            </Markdown>
          </section>
        );
      case 'feedback': {
        const [first, ...rest] = body.split(/\n\s*\n/);
        return (
          <section key={key} className={`sec rise ${d}`} style={{ gap: 14 }}>
            <Markdown className="answer-lead" citePrefix={citeBase}>
              {first}
            </Markdown>
            {rest.length > 0 && (
              <Markdown className="prose" citePrefix={citeBase}>
                {rest.join('\n\n')}
              </Markdown>
            )}
          </section>
        );
      }
      case 'example':
      case 'fix':
        return (
          <section key={key} className={`sec rise ${d}`}>
            {s.heading && <Label>{s.heading}</Label>}
            <Markdown className="prose" highlight={s.kind === 'example' ? highlight : []} citePrefix={citeBase}>
              {body}
            </Markdown>
          </section>
        );
      case 'lines':
        return (
          <section key={key} className={`sec rise ${d}`}>
            <Label>{s.heading}</Label>
            <LineList body={s.body} />
          </section>
        );
      case 'mistake':
        return (
          <section key={key} className={`note rise ${d}`} aria-label={s.heading ?? 'Common mistake'}>
            <Icon name="warning" size={18} color="#B45309" style={{ flex: 'none', marginTop: 3 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning-text)' }}>{s.heading}</h2>
              <Markdown className="note-md" citePrefix={citeBase}>
                {body}
              </Markdown>
            </div>
          </section>
        );
      case 'check':
      case 'question': {
        const text = body.replace(CARET, '');
        return (
          <section key={key} className={`check rise ${d}`}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flex: '1 1 260px', minWidth: 0 }}>
              <span className="badge mono badge-explain" style={{ flex: 'none' }}>
                {s.kind === 'check' ? 'CHECK' : 'QUESTION'}
              </span>
              <Markdown className="check-md" citePrefix={citeBase}>
                {body}
              </Markdown>
            </div>
            {completed && isLast && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => props.onAnswerCheck(text)}>
                {s.kind === 'check' ? 'Answer the check' : 'Answer'}
              </button>
            )}
          </section>
        );
      }
      case 'terms':
        return <TermsInline key={key} body={s.body} />;
      case 'concept': {
        const c = parseConcept(s.body);
        return c ? (
          <section key={key} className="sec terms-inline">
            <Label>Concept</Label>
            <div className="card" style={{ padding: '14px 16px', fontSize: 14, lineHeight: 1.55 }}>
              <strong style={{ display: 'block', fontWeight: 600 }}>{c.name}</strong>
              {c.definition && <span className="muted">{c.definition}</span>}
            </div>
          </section>
        ) : null;
      }
      case 'hints':
      case 'solution':
      case 'followups':
      case 'exercise':
        return null;
      default:
        return (
          <section key={key} className={`sec rise ${d}`}>
            {s.heading && <Label>{s.heading}</Label>}
            <Markdown className="prose" citePrefix={citeBase}>
              {body}
            </Markdown>
          </section>
        );
    }
  };

  const hints = hintsSec ? parseList(hintsSec.body, 3) : [];
  const solution = solutionSec ? extractFirstFence(solutionSec.body) : null;
  const concept = conceptSec ? parseConcept(conceptSec.body) : null;

  const head = !exercise && (
    <div className="ai-head rise d1">
      <Logo size={26} />
      <span className="ai-name">CodeBloom</span>
      {feedback ? (
        <span className="badge mono badge-practice">FEEDBACK</span>
      ) : (
        <span className={`badge mono ${MODE_BADGE[message.mode]}`}>
          {MODE_LABELS[message.mode].toUpperCase()} · {LANGUAGE_LABELS[message.language].toUpperCase()}
        </span>
      )}
      {message.mode === 'debug' ? (
        <span className="badge" style={{ marginLeft: 'auto' }}>
          <Icon name="notExecuted" size={12} />
          Not executed — based on reading your code
        </span>
      ) : feedback || (isPractice && !exercise) ? (
        <span className="badge" style={{ marginLeft: 'auto' }}>
          <Icon name="notExecuted" size={12} />
          Not executed
        </span>
      ) : message.sources.length > 0 ? (
        <span className="small faint" style={{ marginLeft: 'auto' }}>
          {message.sources.length} source{message.sources.length === 1 ? '' : 's'}
        </span>
      ) : null}
    </div>
  );

  return (
    <>
      {exercise && (() => {
        const ex = parseExercise(withCaret(exercise, sections.indexOf(exercise)));
        const lang = ex.starter?.info.lang || message.language;
        const tag = `EXERCISE ${props.exerciseNumber ?? 1}${concept ? ` · ${concept.name.toUpperCase()}` : ''}`;
        return (
          <article id={anchorId} className="card card-lg rise d1 msg-anchor" aria-label="Exercise" style={{ overflow: 'hidden', boxShadow: 'var(--sh-sm)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--subtle)' }}>
              <span className="badge mono badge-practice">{tag}</span>
              <span className="small faint">
                {props.level} · {LANGUAGE_LABELS[message.language]}
              </span>
            </div>
            <div style={{ padding: '22px 22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {ex.title && <h2 className="h3">{ex.title}</h2>}
              {ex.task && <Markdown className="prose">{ex.task}</Markdown>}
              {ex.starter && <CodeBlock code={ex.starter.code} lang={lang} title={ex.starter.info.title ?? `starter.${EXT[message.language]}`} lineNumbers={false} />}
            </div>
          </article>
        );
      })()}

      <article id={exercise ? undefined : anchorId} className="msg-ai msg-anchor" aria-label="CodeBloom answer" aria-busy={streaming}>
        {head}
        {sections.map((s, i) => renderSection(s, i))}

        {hints.length > 0 && (completed || !streaming) && (
          <HintsCard
            hints={hints}
            shown={Math.max(1, Math.min(props.hintsShown, hints.length))}
            onMore={props.onHint}
            hasSolution={Boolean(solution?.fence)}
            solutionShown={props.solutionShown}
            onSolution={props.onSolution}
          />
        )}
        {solution?.fence && props.solutionShown && (
          <section className="sec rise" aria-labelledby={`${citeBase}-sol`}>
            <Label id={`${citeBase}-sol`}>Solution</Label>
            {solution.before && <Markdown className="prose">{solution.before}</Markdown>}
            <CodeBlock code={solution.fence.code} lang={solution.fence.info.lang || message.language} title={solution.fence.info.title ?? `solution.${EXT[message.language]}`} />
            {solution.after && <Markdown className="prose">{solution.after}</Markdown>}
          </section>
        )}
        {deferCheck && checkSec && (props.solutionShown || !solution?.fence) && renderSection(checkSec, sections.indexOf(checkSec), true)}
        {solution?.fence && !hints.length && !props.solutionShown && completed && (
          <div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={props.onSolution}>
              Show full solution
            </button>
          </div>
        )}

        {streaming && live && (
          <>
            {(live.stage === 'submitting' || live.stage === 'retrieving' || !message.content) && (
              <div className="sec">
                <div className="skeleton" style={{ height: 12, width: '92%' }} />
                <div className="skeleton" style={{ height: 12, width: '64%' }} />
              </div>
            )}
            <StatusRow live={live} />
          </>
        )}
        {!streaming && message.status === 'streaming' && (
          <div className="status" role="status">
            <span className="step now">
              <span className="dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              Still writing — this answer will appear when it&apos;s saved
            </span>
          </div>
        )}

        {banner && (
          <Banner
            tone={banner.tone}
            icon={banner.icon}
            title={banner.title}
            action={
              props.onRetry && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={props.onRetry}>
                  <Icon name="retry" size={14} strokeWidth={2} />
                  Retry
                </button>
              )
            }
          >
            {banner.body}
          </Banner>
        )}

        {completed && message.sources.length > 0 && (
          <div className="sec rise">
            <Label>Sources</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              {message.sources.map((s) => {
                const n = s.label.replace(/^S/, '');
                const url = safeSourceUrl(s.url);
                const inner = (
                  <>
                    <span className="source-n">{n}</span>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{s.title}</strong>
                      <span className="small faint">CodeBloom library{s.section ? ` · ${LANGUAGE_LABELS[message.language]} › ${s.section.split(' › ')[0]}` : ''}</span>
                    </span>
                  </>
                );
                return url ? (
                  <a key={s.label} id={`${citeBase}-src-${n}`} href={url} target="_blank" rel="noopener noreferrer" className="source">
                    {inner}
                  </a>
                ) : (
                  <div key={s.label} id={`${citeBase}-src-${n}`} className="source" tabIndex={-1}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {completed && message.id && (
          <div className="actions">
            <button type="button" className="btn btn-ghost btn-icon btn-sm tip" data-tip="Copy answer" aria-label="Copy answer" onClick={props.onCopy}>
              <Icon name="copy" size={16} />
            </button>
            {message.bookmarked ? (
              <button type="button" className="btn btn-sm pop" aria-pressed="true" onClick={props.onToggleSave} style={{ background: 'var(--primary-soft)', color: 'var(--primary-text)' }}>
                <Icon name="bookmarkFilled" size={15} />
                Saved
              </button>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" aria-pressed="false" onClick={props.onToggleSave}>
                <Icon name="bookmark" size={15} />
                Save
              </button>
            )}
            <span className="vsep" aria-hidden="true" />
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm tip"
              data-tip="Helpful"
              aria-label="Helpful"
              aria-pressed={message.rating === 'helpful'}
              onClick={() => props.onRate(message.rating === 'helpful' ? null : 'helpful')}
              style={message.rating === 'helpful' ? { background: 'var(--primary-soft)', color: 'var(--primary-text)' } : undefined}
            >
              <Icon name="thumbUp" size={16} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm tip"
              data-tip="Not helpful"
              aria-label="Not helpful"
              aria-pressed={message.rating === 'not_helpful'}
              onClick={() => props.onRate(message.rating === 'not_helpful' ? null : 'not_helpful')}
              style={message.rating === 'not_helpful' ? { background: 'var(--primary-soft)', color: 'var(--primary-text)' } : undefined}
            >
              <Icon name="thumbUp" size={16} style={{ transform: 'rotate(180deg)' }} />
            </button>
            {props.onRetry && isLast && (
              <button type="button" className="btn btn-ghost btn-icon btn-sm tip" data-tip="Retry" aria-label="Retry answer" onClick={props.onRetry}>
                <Icon name="retry" size={16} />
              </button>
            )}
            {props.voted && (
              <span className="small faint pop" role="status" style={{ marginLeft: 8 }}>
                Thanks — that helps us improve.
              </span>
            )}
          </div>
        )}
      </article>

      {completed && isLast && (
        <div className="rise" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {message.mode !== 'practice' && (
            <>
              <button type="button" className="chip" onClick={() => props.onFollowUp('Explain it more simply.')}>
                <Icon name="arrowRight" size={14} strokeWidth={2} />
                Explain it more simply
              </button>
              <button type="button" className="chip" onClick={() => props.onFollowUp('Show more detail.')}>
                <Icon name="arrowRight" size={14} strokeWidth={2} />
                Show more detail
              </button>
            </>
          )}
          {followSec &&
            parseList(followSec.body, 2).map((q) => (
              <button key={q} type="button" className="chip" onClick={() => props.onFollowUp(q.replace(/\*\*/g, ''))}>
                <Icon name="arrowRight" size={14} strokeWidth={2} />
                {q.replace(/\*\*/g, '').replace(/`/g, '')}
              </button>
            ))}
          {message.mode !== 'practice' ? (
            <button type="button" className="chip" onClick={() => props.onFollowUp('Give me a short practice exercise on this.', 'practice')}>
              <span className="dot dot-practice" aria-hidden="true" />
              Give me a practice exercise
            </button>
          ) : (
            <button type="button" className="chip" onClick={() => props.onFollowUp('Give me another exercise like this one.', 'practice')}>
              <span className="dot dot-practice" aria-hidden="true" />
              Another exercise
            </button>
          )}
        </div>
      )}
    </>
  );
});
