'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LANGUAGES, LANGUAGE_LABELS } from '@shared/constants.ts';
import type { Depth, ExperienceLevel, ExplanationLanguage, Language } from '@/lib/types';
import { Icon, Logo } from '@/components/ui/Icon';
import { Banner } from '@/components/ui/Banner';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

const LEVELS: Array<{ id: ExperienceLevel; label: string; desc: string }> = [
  { id: 'new', label: 'Brand new', desc: "I'm writing my first lines of code." },
  { id: 'basics', label: 'Some basics', desc: 'I know variables and loops but get stuck often.' },
  { id: 'comfortable', label: 'Comfortable', desc: "Fundamentals are fine; I'm filling gaps." },
];
const LENGTHS: Array<{ id: Depth; label: string }> = [
  { id: 'concise', label: 'Concise' },
  { id: 'detailed', label: 'Detailed' },
];
const EXPL: Array<{ id: ExplanationLanguage; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'roman_ur', label: 'Roman Urdu · beta' },
];

type Key = 'lang' | 'level' | 'length' | 'expl';

/** First-visit setup (design/preview/onboarding.html). Every answer has a default. */
export default function OnboardingPage() {
  const ws = useWorkspace();
  const router = useRouter();
  const p = ws.profile;
  const [lang, setLang] = useState<Language>(p?.preferred_language ?? 'python');
  const [level, setLevel] = useState<ExperienceLevel>(p?.experience_level ?? 'new');
  const [length, setLength] = useState<Depth>(p?.explanation_depth ?? 'concise');
  const [expl, setExpl] = useState<ExplanationLanguage>(p?.explanation_language ?? 'en');
  const [touched, setTouched] = useState<Partial<Record<Key, true>>>({});
  const [busy, setBusy] = useState<'save' | 'skip' | null>(null);
  const [failed, setFailed] = useState(false);
  const answered = Object.keys(touched).length;
  // A returning learner who follows "Start learning" goes straight to their chats; preferences
  // live in Settings from then on.
  const [returning] = useState(() => Boolean(p?.onboarded_at));
  useEffect(() => {
    if (returning) router.replace('/chat');
  }, [returning, router]);
  const touch = (k: Key) => setTouched((t) => ({ ...t, [k]: true }));

  async function finish(save: boolean) {
    setBusy(save ? 'save' : 'skip');
    setFailed(false);
    try {
      if (save) {
        await ws.updatePrefs({ preferred_language: lang, experience_level: level, explanation_depth: length, explanation_language: expl });
      }
      await ws.markOnboarded();
      router.push('/chat');
    } catch {
      setFailed(true);
      setBusy(null);
    }
  }

  if (returning) return null;

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="wrap" style={{ minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Link href="/" className="brand">
            <Logo size={24} />
            CodeBloom
          </Link>
          <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="small faint">Setup</span>
            <div
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={answered}
              style={{ width: 160, height: 6, borderRadius: 999, background: 'var(--sunken)', overflow: 'hidden' }}
            >
              <div style={{ height: '100%', width: `${(answered / 4) * 100}%`, borderRadius: 999, background: 'var(--primary)', transition: 'width 400ms var(--ease)' }} />
            </div>
            <span className="mono small faint">{answered}/4</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void finish(false)} disabled={busy !== null}>
            Skip for now
          </button>
        </div>
      </header>

      <main id="main-content" style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px 96px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
          <span className="eyebrow">Personalise your tutor</span>
          <h1 className="h1" style={{ fontSize: 38 }}>
            How should CodeBloom explain things?
          </h1>
          <p className="lead" style={{ fontSize: 16 }}>
            Everything has a sensible default, and you can change it later in Settings.
          </p>
        </div>

        <section className="card card-lg rise d1" aria-labelledby="ob-lang" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingBottom: 16 }}>
            <h2 id="ob-lang" style={{ fontSize: 16, fontWeight: 600 }}>
              Which language are you learning?
            </h2>
            <span className="small faint">Switchable per chat</span>
          </div>
          <div role="group" aria-labelledby="ob-lang" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(124px, 1fr))', gap: 8 }}>
            {LANGUAGES.map((l) => (
              <button
                key={l}
                type="button"
                className="opt"
                aria-pressed={lang === l}
                onClick={() => {
                  setLang(l);
                  touch('lang');
                }}
                style={{ alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}
              >
                <span style={{ fontSize: 14, fontWeight: 500 }}>{LANGUAGE_LABELS[l]}</span>
                <span className="tick" aria-hidden="true">
                  <Icon name="check" size={12} strokeWidth={3} />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="card card-lg rise d2" aria-labelledby="ob-level" style={{ padding: 24 }}>
          <h2 id="ob-level" style={{ fontSize: 16, fontWeight: 600, paddingBottom: 4 }}>
            How much programming have you done?
          </h2>
          <p className="small faint" style={{ paddingBottom: 16 }}>
            Sets how many terms get defined along the way.
          </p>
          <div role="radiogroup" aria-labelledby="ob-level" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
            {LEVELS.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                className="opt"
                aria-checked={level === o.id}
                onClick={() => {
                  setLevel(o.id);
                  touch('level');
                }}
              >
                <span className="radio" aria-hidden="true" />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
                  <strong style={{ fontSize: 15, fontWeight: 600 }}>{o.label}</strong>
                  <span className="small muted" style={{ lineHeight: 1.45 }}>
                    {o.desc}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="rise d3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 24 }}>
          <section className="card card-lg" aria-labelledby="ob-len" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <h2 id="ob-len" style={{ fontSize: 16, fontWeight: 600 }}>
                Answer length
              </h2>
              <p className="small faint">You can always ask for more or less.</p>
            </div>
            <div className="seg seg-full seg-lg" role="group" aria-labelledby="ob-len">
              {LENGTHS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="seg-btn"
                  aria-pressed={length === o.id}
                  onClick={() => {
                    setLength(o.id);
                    touch('length');
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>
          <section className="card card-lg" aria-labelledby="ob-expl" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <h2 id="ob-expl" style={{ fontSize: 16, fontWeight: 600 }}>
                Explanation language
              </h2>
              <p className="small faint">Code and keywords stay in English.</p>
            </div>
            <div className="seg seg-full seg-lg" role="group" aria-labelledby="ob-expl">
              {EXPL.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="seg-btn"
                  aria-pressed={expl === o.id}
                  onClick={() => {
                    setExpl(o.id);
                    touch('expl');
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        {failed && (
          <Banner tone="danger" icon="alertCircle" title="We couldn't save your choices">
            Check your connection and try again.
          </Banner>
        )}

        <div className="rise d4" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingTop: 12 }}>
          <p className="small faint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="lock" size={14} style={{ flex: 'none' }} />
            No account needed — we never ask for your email, age, school, phone or location.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => void finish(false)} disabled={busy !== null}>
              {busy === 'skip' && <span className="spinner" aria-hidden="true" />}
              Use defaults
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void finish(true)} disabled={busy !== null}>
              {busy === 'save' && <span className="spinner" aria-hidden="true" style={{ borderColor: 'rgb(255 255 255 / 35%)', borderTopColor: '#fff' }} />}
              Continue
              <Icon name="arrowRight" size={16} className="arrow" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
