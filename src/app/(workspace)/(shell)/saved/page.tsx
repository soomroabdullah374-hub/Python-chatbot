'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LANGUAGES, LANGUAGE_LABELS, MODE_LABELS } from '@shared/constants.ts';
import { excerpt } from '@/lib/answer';
import { addBookmark, fetchSaved, removeBookmark } from '@/lib/api/data';
import type { Language, SavedItem } from '@/lib/types';
import { Banner } from '@/components/ui/Banner';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toasts';
import { useShell } from '@/components/navigation/Shell';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

const BADGE = { explain: 'badge-explain', debug: 'badge-debug', practice: 'badge-practice' } as const;
const VIEW_KEY = 'cb:saved-view';
type Filter = 'all' | Language;

function titleOf(item: SavedItem): string {
  const q = (item.question ?? '').replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim();
  const t = q || item.conversation_title || 'Saved explanation';
  return t.length > 90 ? `${t.slice(0, 89).replace(/\s+\S*$/, '')}…` : t;
}

function dateOf(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Saved explanations (design/preview/saved.html): bookmarks only; conversations are untouched. */
export default function SavedPage() {
  const ws = useWorkspace();
  const toast = useToast();
  const { openDrawer } = useShell();
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setItems(await fetchSaved());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    fetchSaved()
      .then(setItems)
      .catch(() => setFailed(true));
  }, []);

  const pickView = (v: 'grid' | 'list') => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // ignore
    }
  };

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (items ?? [])
      .filter((i) => filter === 'all' || i.language === filter)
      .map((i) => ({ item: i, title: titleOf(i), text: excerpt(i.content) }))
      .filter((r) => !term || `${r.title} ${r.text} ${r.item.conversation_title}`.toLowerCase().includes(term));
  }, [items, filter, query]);

  async function remove(item: SavedItem) {
    const title = titleOf(item);
    setItems((xs) => (xs ?? []).filter((x) => x.message_id !== item.message_id));
    ws.adjustSavedCount(-1);
    try {
      await removeBookmark(item.message_id);
    } catch {
      setItems((xs) => [...(xs ?? []), item].sort((a, b) => b.saved_at.localeCompare(a.saved_at)));
      ws.adjustSavedCount(1);
      toast.show("Couldn't remove it — try again", { icon: 'none' });
      return;
    }
    toast.show(`Removed “${title}”`, {
      icon: 'none',
      duration: 4000,
      action: {
        label: 'Undo',
        onClick: () => {
          void addBookmark(item.message_id)
            .then(() => {
              setItems((xs) => [...(xs ?? []).filter((x) => x.message_id !== item.message_id), item].sort((a, b) => b.saved_at.localeCompare(a.saved_at)));
              ws.adjustSavedCount(1);
            })
            .catch(() => toast.show("Couldn't restore it", { icon: 'none' }));
        },
      },
    });
  }

  const filters: Array<{ value: Filter; label: string }> = [{ value: 'all', label: 'All' }, ...LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))];
  const href = (i: SavedItem) => `/chat/${i.conversation_id}#m-${i.message_id}`;

  return (
    <>
      <div className="mobile-bar">
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Open menu" onClick={openDrawer}>
          <Icon name="menu" size={20} />
        </button>
        <h1>Saved explanations</h1>
        <span style={{ width: 40 }} aria-hidden="true" />
      </div>
      <main className="page-main">
        <div style={{ width: '100%', maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="rise" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h1 className="h1 desktop-only">Saved explanations</h1>
              <p className="muted" style={{ fontSize: 15 }}>
                Answers you bookmarked. Removing one doesn&apos;t touch its conversation.
              </p>
            </div>
            <span className="badge mono">
              {rows.length} {rows.length === 1 ? 'explanation' : 'explanations'}
            </span>
          </div>

          <div className="rise d1" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <div className="input-icon" style={{ flex: '1 1 260px', maxWidth: 340 }}>
              <Icon name="search" size={16} />
              <input className="input" type="search" aria-label="Search saved explanations" placeholder="Search saved" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
              <div className="seg" role="group" aria-label="Filter by language">
                {filters.map((f) => (
                  <button key={f.value} type="button" className="seg-btn" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="seg" role="group" aria-label="View" style={{ marginLeft: 'auto' }}>
              <button type="button" className="seg-btn" aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => pickView('grid')} style={{ padding: '0 10px' }}>
                <Icon name="grid" size={16} />
              </button>
              <button type="button" className="seg-btn" aria-label="List view" aria-pressed={view === 'list'} onClick={() => pickView('list')} style={{ padding: '0 10px' }}>
                <Icon name="list" size={16} />
              </button>
            </div>
          </div>

          {failed && (
            <Banner
              tone="danger"
              icon="alertCircle"
              title="We couldn't load your saved explanations"
              action={
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
                  Try again
                </button>
              }
            >
              Check your connection and try again.
            </Banner>
          )}

          {!items && !failed && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: 16 }} aria-busy="true" aria-label="Loading saved explanations">
              {[0, 1, 2].map((k) => (
                <div key={k} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="skeleton" style={{ height: 20, width: '40%' }} />
                  <div className="skeleton" style={{ height: 18, width: '80%' }} />
                  <div className="skeleton" style={{ height: 40 }} />
                </div>
              ))}
            </div>
          )}

          {items && rows.length > 0 && view === 'grid' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
              {rows.map(({ item, title, text }, i) => (
                <article key={item.message_id} className={`card lift rise d${Math.min(i + 1, 8)}`} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge mono ${BADGE[item.mode]}`}>{MODE_LABELS[item.mode].toUpperCase()}</span>
                    <span className="badge">{LANGUAGE_LABELS[item.language]}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm tip"
                      data-tip="Remove"
                      aria-label={`Remove “${title}” from saved`}
                      onClick={() => void remove(item)}
                      style={{ marginLeft: 'auto' }}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                  <Link href={href(item)} style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--text)', textDecoration: 'none' }}>
                    {title}
                  </Link>
                  <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
                    {text}
                  </p>
                  <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, color: 'var(--text-3)' }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>From “{item.conversation_title}”</span>
                    <span className="mono" style={{ flex: 'none' }}>
                      {dateOf(item.saved_at)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}

          {items && rows.length > 0 && view === 'list' && (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    <th scope="col" className="label" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      Explanation
                    </th>
                    <th scope="col" className="label" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', textAlign: 'left', width: 120 }}>
                      Language
                    </th>
                    <th scope="col" className="label" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', textAlign: 'left', width: 110 }}>
                      Mode
                    </th>
                    <th scope="col" className="label" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', textAlign: 'left', width: 120 }}>
                      Saved
                    </th>
                    <th scope="col" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', width: 60 }}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ item, title, text }) => (
                    <tr key={item.message_id} className="row-hover">
                      <td style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                        <Link href={href(item)} style={{ display: 'block', fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
                          {title}
                        </Link>
                        <span className="small faint">{text}</span>
                      </td>
                      <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                        <span className="badge">{LANGUAGE_LABELS[item.language]}</span>
                      </td>
                      <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                        <span className={`badge mono ${BADGE[item.mode]}`}>{MODE_LABELS[item.mode].toUpperCase()}</span>
                      </td>
                      <td className="mono small faint" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                        {dateOf(item.saved_at)}
                      </td>
                      <td style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove “${title}” from saved`} onClick={() => void remove(item)}>
                          <Icon name="trash" size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {items && rows.length === 0 && (
            <div className="card pop" style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
              <span className="feature-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                <Icon name="bookmark" size={20} />
              </span>
              <strong style={{ fontSize: 16, fontWeight: 600 }}>{items.length === 0 ? 'Nothing saved yet' : 'Nothing saved here yet'}</strong>
              <span className="muted" style={{ fontSize: 14, maxWidth: 360 }}>
                {items.length === 0 || (!query && filter !== 'all') ? (
                  <>
                    Use <strong>Save</strong> under any answer to keep it in this list.
                  </>
                ) : (
                  'No saved explanations match your search.'
                )}
              </span>
              <Link href="/chat" className="btn btn-secondary btn-sm">
                Start a chat
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
