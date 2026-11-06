'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchConversations } from '@/lib/api/data';
import type { Conversation } from '@/lib/types';
import { Icon, Logo } from '@/components/ui/Icon';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

function groupConversations(items: Conversation[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = startOfToday.getTime() - 6 * 86_400_000;
  const groups: Array<{ label: string; items: Conversation[] }> = [
    { label: 'Today', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Earlier', items: [] },
  ];
  for (const c of items) {
    const t = new Date(c.updated_at).getTime();
    if (t >= startOfToday.getTime()) groups[0].items.push(c);
    else if (t >= weekAgo) groups[1].items.push(c);
    else groups[2].items.push(c);
  }
  return groups.filter((g) => g.items.length);
}

export function activeConversationId(pathname: string | null): string | null {
  const m = /^\/chat\/([0-9a-f-]{36})$/.exec(pathname ?? '');
  return m ? m[1] : null;
}

/** Sidebar contents, shared by the desktop column and the mobile drawer. */
export function SidebarBody({
  variant,
  onNavigate,
  onCollapse,
  onClose,
}: {
  variant: 'desktop' | 'drawer';
  onNavigate?: () => void;
  onCollapse?: () => void;
  onClose?: () => void;
}) {
  const ws = useWorkspace();
  const pathname = usePathname();
  const currentId = activeConversationId(pathname);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ term: string; items: Conversation[] } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const big = variant === 'drawer';
  const itemStyle = big ? { minHeight: 44, fontSize: 15 } : undefined;

  // Title search results only apply while there is a search term.
  const term = query.trim();
  const results = term && found ? found.items : null;
  useEffect(() => {
    if (!term) return;
    const t = setTimeout(() => {
      fetchConversations(term)
        .then((items) => setFound({ term, items }))
        .catch(() => setFound({ term, items: [] }));
    }, 220);
    return () => clearTimeout(t);
  }, [term]);

  // "/" focuses title search (Design.md "Shell"), unless the learner is typing somewhere.
  useEffect(() => {
    if (variant !== 'desktop') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [variant]);

  const groups = useMemo(() => groupConversations(results ?? ws.conversations), [results, ws.conversations]);

  return (
    <>
      <div className="side-head" style={big ? { paddingLeft: 8 } : undefined}>
        <Link href="/" className="brand" onClick={onNavigate}>
          <Logo size={big ? 28 : 24} />
          CodeBloom
        </Link>
        {variant === 'desktop' ? (
          <button type="button" className="btn btn-ghost btn-icon btn-sm tip" data-tip="Collapse sidebar" aria-label="Collapse sidebar" onClick={onCollapse}>
            <Icon name="sidebar" size={18} />
          </button>
        ) : (
          <button type="button" className="btn btn-ghost btn-icon btn-lg" aria-label="Close menu" onClick={onClose} style={{ color: 'var(--text)' }}>
            <Icon name="close" size={18} />
          </button>
        )}
      </div>
      <Link href="/chat" className={`btn btn-primary btn-block${big ? ' btn-lg rise d1' : ''}`} onClick={onNavigate} data-testid="new-chat">
        <Icon name="plus" size={16} strokeWidth={2} />
        New chat
      </Link>
      <div className={`input-icon side-search${big ? ' rise d2' : ''}`}>
        <Icon name="search" size={15} strokeWidth={2} />
        <input
          ref={searchRef}
          className={`input${big ? ' input-lg' : ''}`}
          type="search"
          aria-label="Search conversation titles"
          placeholder="Search titles"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={big ? { fontSize: 16 } : undefined}
        />
        {!big && !query && (
          <span className="kbd" aria-hidden="true">
            /
          </span>
        )}
      </div>
      <nav className={`side-nav${big ? ' rise d3' : ''}`} aria-label="Conversations" style={big ? { flex: '1 1 auto', minHeight: 0, overflowY: 'auto' } : undefined}>
        {groups.length === 0 && (
          <p className="small faint" style={{ padding: '10px 10px' }}>
            {results ? 'No titles match your search.' : 'Your conversations will appear here.'}
          </p>
        )}
        {groups.map((g) => (
          <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span className="side-label">{g.label}</span>
            {g.items.map((c) => (
              <Link
                key={c.id}
                href={`/chat/${c.id}`}
                className="side-item"
                aria-current={c.id === currentId ? 'page' : undefined}
                onClick={onNavigate}
                style={itemStyle}
              >
                <span className={`dot dot-${c.mode}`} aria-hidden="true" />
                <span className="t">{c.title}</span>
                {ws.streamingConversationId === c.id && <span className="spinner" role="img" aria-label="Writing an answer" />}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className={`side-foot${big ? ' rise d4' : ''}`}>
        <Link href="/saved" className="side-item" aria-current={pathname === '/saved' ? 'page' : undefined} onClick={onNavigate} style={itemStyle}>
          <Icon name={pathname === '/saved' ? 'bookmarkFilled' : 'bookmark'} size={16} style={pathname === '/saved' ? { color: 'var(--primary)' } : undefined} />
          <span className="t">Saved explanations</span>
          <span className="count">{ws.savedCount}</span>
        </Link>
        <Link href="/settings" className="side-item" aria-current={pathname === '/settings' ? 'page' : undefined} onClick={onNavigate} style={itemStyle}>
          <Icon name="sliders" size={16} style={pathname === '/settings' ? { color: 'var(--primary)' } : undefined} />
          <span className="t">Settings</span>
        </Link>
        <div className="account">
          <Icon name="lock" size={15} style={{ color: 'var(--text-3)', flex: 'none' }} />
          <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Private to this browser · no account</span>
        </div>
      </div>
    </>
  );
}
