import Link from 'next/link';
import type { ReactNode } from 'react';
import { env } from '@/lib/env';
import { Icon, Logo, type IconName } from '@/components/ui/Icon';

// Landing (design/preview/landing.html). Static; no session is created until the learner starts.
export const dynamic = 'force-static';

const MODES: Array<{ name: string; icon: IconName; bg: string; fg: string; body: string; steps: string[]; example: string }> = [
  {
    name: 'Explain',
    icon: 'bulb',
    bg: 'var(--primary-soft)',
    fg: 'var(--explain)',
    body: 'For new concepts. A direct answer, a plain explanation and one example you can read line by line.',
    steps: ['Short answer', 'Simple explanation', 'Small example', 'Optional check'],
    example: '“What is a list comprehension?”',
  },
  {
    name: 'Debug',
    icon: 'bug',
    bg: 'var(--warning-soft)',
    fg: 'var(--debug)',
    body: 'For broken code. The likely cause, the smallest fix and why it works — always marked “Not executed”.',
    steps: ['Likely problem', 'Minimal fix', 'Why it works', 'Test it yourself'],
    example: '“Why do I get an IndexError?”',
  },
  {
    name: 'Practice',
    icon: 'target',
    bg: 'var(--success-soft)',
    fg: 'var(--practice)',
    body: 'For confidence. One small exercise, feedback on your attempt and hints that get more specific.',
    steps: ['Exercise', 'Your attempt', 'Progressive hints', 'Solution on request'],
    example: '“Give me a small loop exercise.”',
  },
];

const ANATOMY: Array<{ n: number; label: string; body: ReactNode }> = [
  {
    n: 1,
    label: 'Short answer',
    body: (
      <>
        <code className="ic">append</code> adds one item to the end of a list.
      </>
    ),
  },
  {
    n: 2,
    label: 'Explanation',
    body: (
      <>
        A list is an ordered collection. <code className="ic">append</code> is a <em>method</em> — a function that belongs to a value — so you call it with a dot.
      </>
    ),
  },
  {
    n: 3,
    label: 'Example',
    body: (
      <div className="code">
        <pre tabIndex={0} aria-label="Python example">
          <code>
            fruits = [<span className="s">&quot;apple&quot;</span>, <span className="s">&quot;pear&quot;</span>]{'\n'}fruits.<span className="f">append</span>(<span className="s">&quot;fig&quot;</span>){'\n'}
            <span className="f">print</span>(fruits){'  '}<span className="c"># [&apos;apple&apos;, &apos;pear&apos;, &apos;fig&apos;]</span>
          </code>
        </pre>
      </div>
    ),
  },
  {
    n: 4,
    label: 'Mistake',
    body: (
      <>
        <code className="ic">fruits = fruits.append(&quot;fig&quot;)</code> — <code className="ic">append</code> returns <code className="ic">None</code>, so the list is lost.
      </>
    ),
  },
  {
    n: 5,
    label: 'Check',
    body: (
      <>
        What is <code className="ic">len(fruits)</code> after line 2? <span className="faint">Optional.</span>
      </>
    ),
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Does CodeBloom run my code?',
    a: 'No. It reads your code and explains what’s likely happening. Debug answers are labelled “Not executed” and suggest a small test you can run yourself.',
  },
  {
    q: 'Do I need to sign up?',
    a: 'No. CodeBloom opens straight to the tutor. Your conversations are stored privately and linked to this browser, so clearing site data or switching devices starts fresh.',
  },
  { q: 'Which languages does it cover?', a: 'Python, JavaScript, TypeScript, SQL and HTML/CSS.' },
  { q: 'Can it explain things in Roman Urdu?', a: 'Yes, as a beta option. Explanations switch language; code and keywords stay in English.' },
  {
    q: 'Where do my prompts go?',
    a: `To ${env.providerName}, which generates the answers. Your conversation history is stored privately and can be deleted at any time.`,
  },
];

function Plus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

const stepNum: React.CSSProperties = {
  width: 22,
  height: 22,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  background: 'var(--subtle)',
  fontSize: 11,
  color: 'var(--text-2)',
};

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <section className="hero" style={{ overflow: 'visible' }}>
        <div className="hero-grid" aria-hidden="true" />
        <div className="wrap" style={{ position: 'relative' }}>
          <header className="nav">
            <Link href="/" className="brand" style={{ color: '#FFFFFF' }}>
              <Logo size={26} />
              CodeBloom
            </Link>
            <nav aria-label="Main" className="landing-nav" style={{ display: 'flex', flexWrap: 'wrap', gap: 28 }}>
              <a href="#modes" className="navlink">
                Modes
              </a>
              <a href="#anatomy" className="navlink">
                How it teaches
              </a>
              <a href="#privacy" className="navlink">
                Privacy
              </a>
              <a href="#faq" className="navlink">
                FAQ
              </a>
            </nav>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
              <Link href="/onboarding" className="btn btn-light">
                Start learning
              </Link>
            </div>
          </header>

          <div id="main-content" style={{ padding: '104px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 28 }}>
            <a href="#modes" className="pill-dark rise">
              <span className="badge mono" style={{ height: 20, border: 0, background: '#4F46E5', color: '#FFFFFF' }}>
                v1
              </span>
              Python · JavaScript · TypeScript · SQL · HTML/CSS
              <Icon name="chevronRight" size={14} />
            </a>
            <h1 className="display rise d1" style={{ maxWidth: 980, color: '#FFFFFF' }}>
              Programming, explained <span className="hl">one idea at a time.</span>
            </h1>
            <p className="lead rise d2" style={{ maxWidth: 620, color: '#B9B9C8' }}>
              CodeBloom is a patient tutor for beginners. It explains concepts in plain language, reads the code you paste, shows why it breaks — then gives you one small next step.
            </p>
            <div className="rise d3" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, paddingTop: 4 }}>
              <Link href="/onboarding" className="btn btn-primary btn-xl">
                Start learning
                <Icon name="arrowRight" size={16} className="arrow" />
              </Link>
              <a href="#anatomy" className="btn btn-outline-light btn-xl">
                See how it teaches
              </a>
            </div>
            <p className="small rise d4" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9C9CB0' }}>
              <Icon name="lock" size={14} strokeWidth={2} />
              No sign-up, no password. Your chats stay private to this browser.
            </p>
          </div>

          <figure className="rise d5" style={{ position: 'relative', zIndex: 2, maxWidth: 1100, margin: '80px auto -220px' }} aria-label="Preview of a CodeBloom chat">
            <div className="window">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, padding: '0 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                <Logo size={20} />
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Chats</span>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>/</span>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>let vs const in JavaScript</span>
                <div className="seg window-seg" style={{ marginLeft: 'auto' }} aria-hidden="true">
                  <span className="seg-btn" aria-pressed="true" style={{ minHeight: 26, fontSize: 12 }}>
                    <span className="dot dot-explain" />
                    Explain
                  </span>
                  <span className="seg-btn" style={{ minHeight: 26, fontSize: 12 }}>
                    <span className="dot dot-debug" />
                    Debug
                  </span>
                  <span className="seg-btn" style={{ minHeight: 26, fontSize: 12 }}>
                    <span className="dot dot-practice" />
                    Practice
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: 560, textAlign: 'left' }}>
                <div className="window-sidebar" style={{ flex: '0 1 220px', minWidth: 0, background: 'var(--subtle)', borderRight: '1px solid var(--border)', padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="btn btn-primary btn-sm" style={{ marginBottom: 10 }}>
                    New chat
                  </span>
                  <span className="side-label" style={{ paddingTop: 4 }}>
                    Today
                  </span>
                  <span className="side-item" aria-current="page" style={{ minHeight: 30, fontSize: 13 }}>
                    <span className="t">let vs const in JavaScript</span>
                  </span>
                  <span className="side-item" style={{ minHeight: 30, fontSize: 13 }}>
                    <span className="t">IndexError in my average</span>
                  </span>
                  <span className="side-label">This week</span>
                  <span className="side-item" style={{ minHeight: 30, fontSize: 13 }}>
                    <span className="t">Loop practice: vowels</span>
                  </span>
                  <span className="side-item" style={{ minHeight: 30, fontSize: 13 }}>
                    <span className="t">What is a SQL JOIN?</span>
                  </span>
                  <span className="side-item" style={{ minHeight: 30, fontSize: 13 }}>
                    <span className="t">Flexbox vs grid</span>
                  </span>
                </div>
                <div style={{ flex: '999 1 420px', minWidth: 0, padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 18 }} className="window-thread">
                  <div className="msg-user rise d6" style={{ fontSize: 14 }}>
                    When should I use let instead of const?
                  </div>
                  <div className="ai-head rise d7">
                    <Logo size={22} />
                    <span className="ai-name" style={{ fontSize: 13 }}>
                      CodeBloom
                    </span>
                    <span className="badge mono badge-explain">EXPLAIN</span>
                  </div>
                  <p className="rise d7" style={{ fontSize: 15, lineHeight: 1.7 }}>
                    Use <code className="ic">const</code> by default. Switch to <code className="ic">let</code> only when you need to give the same name a new value later.
                  </p>
                  <div className="code rise d8">
                    <div className="code-head">
                      <span>javascript</span>
                      <span className="code-copy">Copy</span>
                    </div>
                    <pre tabIndex={0} aria-label="JavaScript example">
                      <code>
                        <span className="k">const</span> name = <span className="s">&quot;Sara&quot;</span>;{'\n'}
                        <span className="k">let</span> score = <span className="n">0</span>;{'\n'}
                        score = score + <span className="n">10</span>;{'  '}<span className="c">{'// fine: let can change'}</span>
                        {'\n'}
                        name = <span className="s">&quot;Ali&quot;</span>;{'      '}<span className="c">{"// TypeError: const can't"}</span>
                      </code>
                    </pre>
                  </div>
                  <p className="rise d8" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-2)' }}>
                    The name stays fixed, but that doesn&apos;t freeze the value inside it
                    <span className="caret" aria-hidden="true" />
                  </p>
                  <div className="status">
                    <span className="step now">
                      <span className="dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      Writing answer
                    </span>
                    <span className="step">2 sources</span>
                  </div>
                </div>
                <div className="window-panel" style={{ flex: '0 1 250px', minWidth: 0, borderLeft: '1px solid var(--border)', padding: '22px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span className="label">Sources</span>
                  <span className="source" style={{ padding: '10px 12px' }}>
                    <span className="source-n">1</span>
                    <span style={{ fontSize: 13, lineHeight: 1.45 }}>
                      <strong style={{ display: 'block', fontWeight: 600 }}>let and const</strong>
                      <span className="faint">JS › Variables</span>
                    </span>
                  </span>
                  <span className="source" style={{ padding: '10px 12px' }}>
                    <span className="source-n">2</span>
                    <span style={{ fontSize: 13, lineHeight: 1.45 }}>
                      <strong style={{ display: 'block', fontWeight: 600 }}>Reading a TypeError</strong>
                      <span className="faint">JS › Errors</span>
                    </span>
                  </span>
                  <span className="label" style={{ paddingTop: 10 }}>
                    Key terms
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.5 }}>
                    <strong style={{ fontWeight: 600 }}>Reassign</strong>
                    <br />
                    <span className="faint">Point a name at a new value.</span>
                  </span>
                </div>
              </div>
            </div>
          </figure>
        </div>
      </section>

      <main>
        <section id="modes" className="section" style={{ paddingTop: 320 }}>
          <div className="wrap">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16, paddingBottom: 56 }}>
              <span className="eyebrow">Three modes</span>
              <h2 className="h2" style={{ maxWidth: 720 }}>
                One tutor. Three ways to teach.
              </h2>
              <p className="lead" style={{ maxWidth: 560 }}>
                The mode changes the shape of every answer, not just its tone. Switch whenever you like.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 20 }}>
              {MODES.map((m) => (
                <article key={m.name} className="card card-lg lift" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <span className="feature-icon" style={{ background: m.bg, color: m.fg }}>
                    <Icon name={m.icon} size={20} />
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <h3 className="h3">{m.name}</h3>
                    <p className="muted" style={{ fontSize: 15 }}>
                      {m.body}
                    </p>
                  </div>
                  <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                    {m.steps.map((s, i) => (
                      <li key={s} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="mono" style={stepNum}>
                          {i + 1}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ol>
                  <p className="mono" style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-3)' }}>
                    {m.example}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="anatomy" className="section" style={{ paddingTop: 0 }}>
          <div className="wrap" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 56 }}>
            <div style={{ flex: '5 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <span className="eyebrow">How it teaches</span>
              <h2 className="h2">Your question first. Then the teaching.</h2>
              <p className="lead">Every Explain answer follows the same order, so you always know where to look. Short questions skip what they don&apos;t need.</p>
              <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14, fontSize: 15 }}>
                {['New terms are defined the first time they appear', 'One minimal example — copyable, never a wall of code', 'References only from approved, server-checked material'].map((t) => (
                  <li key={t} style={{ display: 'flex', gap: 12 }}>
                    <Icon name="check" size={20} strokeWidth={2} color="#4F46E5" style={{ flex: 'none', marginTop: 2 }} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card card-lg" style={{ flex: '7 1 560px', minWidth: 0, boxShadow: 'var(--sh-md)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--border)', background: 'var(--subtle)' }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  “What does <code className="ic">append</code> do in Python?”
                </span>
                <span className="badge mono badge-explain">EXPLAIN · PYTHON</span>
              </div>
              <dl style={{ margin: 0 }}>
                {ANATOMY.map((row, i) => (
                  <div
                    key={row.n}
                    className="row-hover"
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', padding: '16px 22px', borderBottom: i === ANATOMY.length - 1 ? undefined : '1px solid var(--border)' }}
                  >
                    <dt style={{ flex: '0 0 132px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-3)' }}>
                      <span className="source-n">{row.n}</span>
                      {row.label}
                    </dt>
                    <dd style={{ flex: '1 1 300px', margin: 0, fontSize: 15, minWidth: 0 }}>{row.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section className="section" style={{ background: 'var(--subtle)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <div className="wrap">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16, paddingBottom: 48 }}>
              <span className="eyebrow">Principles</span>
              <h2 className="h2" style={{ maxWidth: 760 }}>
                A tutor that tells you what it doesn&apos;t know.
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 20 }}>
              <div className="card card-lg" style={{ padding: 28 }}>
                <h3 className="h3" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16 }}>
                  <span className="feature-icon" style={{ width: 32, height: 32, background: 'var(--success-soft)', color: 'var(--success)' }}>
                    <Icon name="check" size={16} strokeWidth={2.5} />
                  </span>
                  CodeBloom will
                </h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 15 }}>
                  {[
                    'Answer the question you asked, first',
                    'Define every new term it uses',
                    'State its assumptions and flag uncertainty',
                    'Ask one focused question when code is ambiguous',
                    'Stay encouraging — mistakes are how you learn',
                  ].map((t) => (
                    <li key={t} style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card card-lg" style={{ padding: 28 }}>
                <h3 className="h3" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16 }}>
                  <span className="feature-icon" style={{ width: 32, height: 32, background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                    <Icon name="x" size={16} />
                  </span>
                  CodeBloom won&apos;t
                </h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 15 }}>
                  {['Pretend it ran your code', 'Invent references or links', "Jump to advanced material you didn't ask for", 'Shame you for a mistake', 'Sound certain about an ambiguous error'].map((t) => (
                    <li key={t} style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="privacy" className="section">
          <div className="wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: 48 }}>
            <div style={{ flex: '4 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span className="eyebrow">Privacy</span>
              <h2 className="h2">Private by default. Plain about the rest.</h2>
              <p className="lead">To write answers, your prompts are sent to {env.providerName}. Please don&apos;t paste passwords, API keys or personal data.</p>
            </div>
            <div className="privacy-grid" style={{ flex: '7 1 560px', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
              <div className="card lift" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="feature-icon" style={{ width: 36, height: 36, background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                  <Icon name="lock" size={18} />
                </span>
                <strong style={{ fontWeight: 600 }}>Only you see your chats</strong>
                <span className="muted" style={{ fontSize: 14 }}>
                  No public share links in v1.
                </span>
              </div>
              <div className="card lift" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="feature-icon" style={{ width: 36, height: 36, background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                  <Icon name="trash" size={18} />
                </span>
                <strong style={{ fontWeight: 600 }}>Delete anytime</strong>
                <span className="muted" style={{ fontSize: 14 }}>
                  Any conversation, or all of your data.
                </span>
              </div>
              <div className="card lift" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="feature-icon" style={{ width: 36, height: 36, background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                  <Icon name="user" size={18} />
                </span>
                <strong style={{ fontWeight: 600 }}>No account needed</strong>
                <span className="muted" style={{ fontSize: 14 }}>
                  No email, password, age or location.
                </span>
              </div>
              <div className="card lift" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="feature-icon" style={{ width: 36, height: 36, background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                  <Icon name="shield" size={18} />
                </span>
                <strong style={{ fontWeight: 600 }}>Clear retention</strong>
                <span className="muted" style={{ fontSize: 14 }}>
                  Inactive data is deleted after {env.retentionDays} days.
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--warning-text)' }}>
                  [BACKUP RETENTION — confirm before launch]
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="section" style={{ paddingTop: 0 }}>
          <div className="wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: 48 }}>
            <div style={{ flex: '4 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span className="eyebrow">FAQ</span>
              <h2 className="h2">Questions, answered simply.</h2>
            </div>
            <div className="faq" style={{ flex: '7 1 560px', minWidth: 0, borderTop: '1px solid var(--border)' }}>
              {FAQ.map((f, i) => (
                <details key={f.q} open={i === 0}>
                  <summary>
                    {f.q}
                    <Plus />
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="hero" style={{ borderRadius: 0 }}>
          <div className="hero-grid" aria-hidden="true" />
          <div className="wrap" style={{ position: 'relative', padding: '112px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 22 }}>
            <h2 className="h2" style={{ maxWidth: 720, color: '#FFFFFF' }}>
              Ask your first question.
            </h2>
            <p className="lead" style={{ color: '#B9B9C8', maxWidth: 520 }}>
              A concept, a few lines of code, or a small exercise — CodeBloom meets you where you are.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, paddingTop: 6 }}>
              <Link href="/onboarding" className="btn btn-primary btn-xl">
                Start learning
                <Icon name="arrowRight" size={16} className="arrow" />
              </Link>
              <Link href="/chat?setup=skip" className="btn btn-outline-light btn-xl">
                Skip setup, open a chat
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        <div className="wrap" style={{ paddingTop: 56, paddingBottom: 32, display: 'flex', flexWrap: 'wrap', gap: 32 }}>
          <div style={{ flex: '6 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link href="/" className="brand">
              <Logo size={22} />
              CodeBloom
            </Link>
            <p className="muted" style={{ fontSize: 14, maxWidth: 320 }}>
              A patient programming tutor for beginners.
            </p>
          </div>
          <nav aria-label="Product" style={{ flex: '2 1 140px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="label">Product</span>
            <a href="#modes" className="footlink">
              Modes
            </a>
            <a href="#anatomy" className="footlink">
              How it teaches
            </a>
            <a href="#faq" className="footlink">
              FAQ
            </a>
          </nav>
          <nav aria-label="Legal" style={{ flex: '2 1 140px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="label">Legal</span>
            <a href="#privacy" className="footlink">
              Privacy notice
            </a>
            <span className="footlink">Terms [LINK]</span>
            <span className="footlink">Contact [EMAIL]</span>
          </nav>
          <p className="mono" style={{ flex: '1 1 100%', paddingTop: 24, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)' }}>
            © 2026 CodeBloom
          </p>
        </div>
      </footer>
    </div>
  );
}
