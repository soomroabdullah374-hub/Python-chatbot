'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LANGUAGES, LANGUAGE_LABELS } from '@shared/constants.ts';
import { deleteAllConversations, deleteAllMyData } from '@/lib/api/data';
import { env } from '@/lib/env';
import type { Depth, ExperienceLevel, ExplanationLanguage, Language, ProfilePrefs } from '@/lib/types';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toasts';
import { useShell } from '@/components/navigation/Shell';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

const LEVELS: Array<{ id: ExperienceLevel; label: string }> = [
  { id: 'new', label: 'Brand new' },
  { id: 'basics', label: 'Some basics' },
  { id: 'comfortable', label: 'Comfortable with fundamentals' },
];
const SECTIONS = [
  { id: 'learning', label: 'Learning' },
  { id: 'composer', label: 'Composer' },
  { id: 'privacy', label: 'Privacy & data' },
  { id: 'account', label: 'Your data' },
] as const;

const COPY = {
  chats: {
    title: 'Delete all conversations?',
    body: "Every conversation and saved explanation will be removed. Answers still being written are cancelled. This can't be undone.",
    action: 'Delete all',
  },
  account: {
    title: 'Delete all your data?',
    body: "Your conversations, saved explanations and preferences will be permanently deleted and you'll start with a fresh, empty workspace. This can't be undone.",
    action: 'Delete my data',
  },
} as const;

const rowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px 24px',
  padding: '18px 20px',
  borderBottom: '1px solid var(--border)',
};
const dlRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '4px 24px', padding: '18px 20px', borderBottom: '1px solid var(--border)' };
const dtStyle: React.CSSProperties = { flex: '0 0 200px', fontSize: 15, fontWeight: 500 };
const ddStyle: React.CSSProperties = { flex: '1 1 280px', margin: 0, fontSize: 14 };

/** Settings (design/preview/settings.html): preferences save as you change them. */
export default function SettingsPage() {
  const ws = useWorkspace();
  const toast = useToast();
  const router = useRouter();
  const { openDrawer } = useShell();
  const profile = ws.profile!;
  const [pending, setPending] = useState(0);
  const [dialog, setDialog] = useState<keyof typeof COPY | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<string>('learning');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const els = Object.values(sectionRefs.current).filter(Boolean) as HTMLElement[];
    if (!('IntersectionObserver' in window) || !els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-10% 0px -60% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  async function save(patch: Partial<ProfilePrefs>) {
    setPending((n) => n + 1);
    try {
      await ws.updatePrefs(patch);
    } catch {
      toast.show("Couldn't save that change — try again", { icon: 'none' });
    } finally {
      setPending((n) => n - 1);
    }
  }

  async function confirm() {
    if (!dialog) return;
    setBusy(true);
    try {
      if (dialog === 'chats') {
        await deleteAllConversations();
        ws.clearConversations();
        await ws.refreshSavedCount().catch(() => undefined);
        setDialog(null);
        toast.show('All conversations deleted');
      } else {
        await deleteAllMyData();
        setDialog(null);
        toast.show('Your data was deleted');
        await ws.startFresh();
        router.replace('/onboarding');
      }
    } catch {
      toast.show(dialog === 'chats' ? "Couldn't delete your conversations — try again" : "Couldn't delete your data — try again", { icon: 'none' });
    } finally {
      setBusy(false);
    }
  }

  const enterDesc = profile.enter_to_send
    ? 'Shift+Enter adds a new line. Mobile always shows a Send button.'
    : 'Enter adds a new line; Ctrl+Enter sends. Mobile always shows a Send button.';
  const c = dialog ? COPY[dialog] : COPY.chats;

  return (
    <>
      <div className="mobile-bar">
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Open menu" onClick={openDrawer}>
          <Icon name="menu" size={20} />
        </button>
        <h1>Settings</h1>
        <span style={{ width: 40 }} aria-hidden="true" />
      </div>
      <main className="page-main">
        <div style={{ width: '100%', maxWidth: 1040, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 36 }}>
          <div className="rise" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h1 className="h1 desktop-only">Settings</h1>
              <p className="muted" style={{ fontSize: 15 }}>
                Preferences, privacy and your data.
              </p>
            </div>
            <span role="status" className="badge" style={{ gap: 6 }}>
              {pending > 0 ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                <>
                  <Icon name="check" size={12} strokeWidth={3} color="var(--success)" />
                  All changes saved
                </>
              )}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40 }}>
            <nav aria-label="Settings sections" className="rise d1 desktop-only" style={{ flex: '1 1 180px', maxWidth: 200, display: 'flex', flexDirection: 'column', gap: 2, alignSelf: 'flex-start', position: 'sticky', top: 24 }}>
              {SECTIONS.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="side-item" aria-current={active === s.id ? 'true' : undefined} onClick={() => setActive(s.id)}>
                  {s.label}
                </a>
              ))}
            </nav>

            <div style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 40 }}>
              <section id="learning" ref={(el) => void (sectionRefs.current.learning = el)} aria-labelledby="s-learning" className="rise d2">
                <h2 id="s-learning" className="h3" style={{ fontSize: 18 }}>
                  Learning preferences
                </h2>
                <p className="small faint" style={{ padding: '2px 0 14px' }}>
                  Defaults for every new chat.
                </p>
                <div className="card">
                  <div style={rowStyle}>
                    <div>
                      <label htmlFor="set-lang" style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>
                        Programming language
                      </label>
                      <span className="small faint">Default language for examples.</span>
                    </div>
                    <select id="set-lang" className="select" style={{ minWidth: 220 }} value={profile.preferred_language} onChange={(e) => void save({ preferred_language: e.target.value as Language })}>
                      {LANGUAGES.map((l) => (
                        <option key={l} value={l}>
                          {LANGUAGE_LABELS[l]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={rowStyle}>
                    <div>
                      <label htmlFor="set-level" style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>
                        Experience level
                      </label>
                      <span className="small faint">How many terms get defined along the way.</span>
                    </div>
                    <select id="set-level" className="select" style={{ minWidth: 220 }} value={profile.experience_level} onChange={(e) => void save({ experience_level: e.target.value as ExperienceLevel })}>
                      {LEVELS.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={rowStyle}>
                    <div>
                      <span id="set-len" style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>
                        Answer length
                      </span>
                      <span className="small faint">You can still ask for more or less in a chat.</span>
                    </div>
                    <div className="seg" role="group" aria-labelledby="set-len">
                      {(['concise', 'detailed'] as Depth[]).map((d) => (
                        <button
                          key={d}
                          type="button"
                          className="seg-btn"
                          aria-pressed={profile.explanation_depth === d}
                          onClick={() => profile.explanation_depth !== d && void save({ explanation_depth: d })}
                          style={{ minWidth: 96 }}
                        >
                          {d === 'concise' ? 'Concise' : 'Detailed'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ ...rowStyle, borderBottom: 0 }}>
                    <div>
                      <label htmlFor="set-expl" style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>
                        Explanation language
                      </label>
                      <span className="small faint">Roman Urdu is in beta. Code stays in English.</span>
                    </div>
                    <select id="set-expl" className="select" style={{ minWidth: 220 }} value={profile.explanation_language} onChange={(e) => void save({ explanation_language: e.target.value as ExplanationLanguage })}>
                      <option value="en">English</option>
                      <option value="roman_ur">Roman Urdu (beta)</option>
                    </select>
                  </div>
                </div>
              </section>

              <section id="composer" ref={(el) => void (sectionRefs.current.composer = el)} aria-labelledby="s-composer" className="rise d3">
                <h2 id="s-composer" className="h3" style={{ fontSize: 18, paddingBottom: 14 }}>
                  Composer
                </h2>
                <div className="card">
                  <div style={rowStyle}>
                    <div style={{ maxWidth: 540 }}>
                      <span id="set-enter" style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>
                        Enter sends message
                      </span>
                      <span className="small faint">{enterDesc}</span>
                    </div>
                    <button
                      type="button"
                      className="switch"
                      role="switch"
                      aria-checked={profile.enter_to_send}
                      aria-labelledby="set-enter"
                      onClick={() => void save({ enter_to_send: !profile.enter_to_send })}
                    />
                  </div>
                  <div style={{ ...rowStyle, borderBottom: 0 }}>
                    <div style={{ maxWidth: 540 }}>
                      <span id="set-motion" style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>
                        Reduce motion
                      </span>
                      <span className="small faint">Turns off animations. Also follows your system setting.</span>
                    </div>
                    <button
                      type="button"
                      className="switch"
                      role="switch"
                      aria-checked={profile.reduce_motion}
                      aria-labelledby="set-motion"
                      onClick={() => void save({ reduce_motion: !profile.reduce_motion })}
                    />
                  </div>
                </div>
              </section>

              <section id="privacy" ref={(el) => void (sectionRefs.current.privacy = el)} aria-labelledby="s-privacy" className="rise d4">
                <h2 id="s-privacy" className="h3" style={{ fontSize: 18, paddingBottom: 14 }}>
                  Privacy &amp; data
                </h2>
                <div className="card">
                  <dl style={{ margin: 0 }}>
                    <div style={dlRow}>
                      <dt style={dtStyle}>Visibility</dt>
                      <dd className="muted" style={ddStyle}>
                        Your conversations are private. There are no public share links.
                      </dd>
                    </div>
                    <div style={dlRow}>
                      <dt style={dtStyle}>Model provider</dt>
                      <dd className="muted" style={ddStyle}>
                        Prompts are sent to {env.providerName} to generate answers. Don&apos;t paste passwords, keys or personal data. Answers can be wrong — CodeBloom never runs your code.
                      </dd>
                    </div>
                    <div style={dlRow}>
                      <dt style={dtStyle}>Retention</dt>
                      <dd style={{ ...ddStyle, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                        <span className="muted">
                          A workspace with no activity for {env.retentionDays} days is deleted automatically, with everything in it. Deleting doesn&apos;t instantly purge backups.
                        </span>
                        <span className="badge mono badge-debug" style={{ height: 'auto', minHeight: 22, padding: '2px 8px', whiteSpace: 'normal', lineHeight: 1.5, maxWidth: '100%' }}>
                          [PROVIDER &amp; BACKUP RETENTION — confirm before launch]
                        </span>
                      </dd>
                    </div>
                  </dl>
                  <div style={{ ...rowStyle, borderBottom: 0 }}>
                    <div style={{ maxWidth: 540 }}>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>Delete all conversations</span>
                      <span className="small faint">Removes every conversation and saved explanation. This can&apos;t be undone.</span>
                    </div>
                    <button type="button" className="btn btn-danger-outline" onClick={() => setDialog('chats')}>
                      Delete all…
                    </button>
                  </div>
                </div>
              </section>

              <section id="account" ref={(el) => void (sectionRefs.current.account = el)} aria-labelledby="s-account" className="rise d5">
                <h2 id="s-account" className="h3" style={{ fontSize: 18, paddingBottom: 14 }}>
                  Your data
                </h2>
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={rowStyle}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, maxWidth: 620 }}>
                      <span className="feature-icon" style={{ flex: 'none', width: 36, height: 36, background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                        <Icon name="user" size={18} />
                      </span>
                      <div>
                        <span style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>No account needed</span>
                        <span className="small faint">
                          Your conversations and preferences are stored privately and linked to this browser. Anyone using this browser profile can see them. Clearing site data, using a private window or switching devices starts a fresh, empty workspace.
                        </span>
                      </div>
                    </div>
                    <span className="badge mono">This browser only</span>
                  </div>
                  <div style={{ ...rowStyle, borderBottom: 0, background: 'var(--danger-soft)' }}>
                    <div style={{ maxWidth: 540 }}>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--danger-text)' }}>Delete all my data</span>
                      <span style={{ fontSize: 13, color: '#7A271A' }}>Permanently deletes your conversations, saved explanations and preferences, then starts you fresh.</span>
                    </div>
                    <button type="button" className="btn btn-danger" onClick={() => setDialog('account')}>
                      Delete my data…
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
      <ConfirmDialog open={dialog !== null} title={c.title} body={c.body} confirmLabel={c.action} busy={busy} onConfirm={() => void confirm()} onCancel={() => !busy && setDialog(null)} />
    </>
  );
}
