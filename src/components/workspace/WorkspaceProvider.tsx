'use client';
// SessionGate + workspace state (IDENTITY.md): silently creates/restores the anonymous session,
// loads the profile and conversation list, and never shows a login screen.
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  completeOnboarding,
  fetchConversations,
  fetchProfile,
  fetchSavedCount,
  touchActivity,
  updateProfile,
} from '@/lib/api/data';
import { ClientError } from '@/lib/api/errors';
import { ensureSession, resetSession } from '@/lib/api/session';
import type { Conversation, Profile, ProfilePrefs } from '@/lib/types';
import { Banner } from '@/components/ui/Banner';

type Status = 'loading' | 'ready' | 'error';

interface WorkspaceValue {
  status: Status;
  userId: string | null;
  profile: Profile | null;
  conversations: Conversation[];
  savedCount: number;
  streamingConversationId: string | null;
  reconnect(): Promise<void>;
  refreshConversations(): Promise<void>;
  upsertConversation(c: Conversation): void;
  removeConversation(id: string): void;
  clearConversations(): void;
  adjustSavedCount(delta: number): void;
  refreshSavedCount(): Promise<void>;
  updatePrefs(patch: Partial<ProfilePrefs>): Promise<void>;
  markOnboarded(): Promise<void>;
  setStreamingConversation(id: string | null): void;
  startFresh(): Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspace(): WorkspaceValue {
  const v = useContext(WorkspaceContext);
  if (!v) throw new Error('useWorkspace outside WorkspaceProvider');
  return v;
}

const TOUCH_KEY = 'cb:last-touch';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [streamingConversationId, setStreamingConversation] = useState<string | null>(null);
  const started = useRef(false);

  const load = useCallback(async (fresh = false) => {
    setStatus('loading');
    try {
      let session = fresh ? await resetSession() : await ensureSession();
      let p = await fetchProfile();
      if (!p) {
        // The session belongs to a learner whose data was deleted or purged: start a fresh one.
        session = await resetSession();
        p = await fetchProfile();
      }
      if (!p) throw new ClientError('SESSION_REQUIRED');
      const [convs, count] = await Promise.all([fetchConversations(), fetchSavedCount()]);
      setUserId(session.user.id);
      setProfile(p);
      setConversations(convs);
      setSavedCount(count);
      setStatus('ready');
      try {
        const last = Number(localStorage.getItem(TOUCH_KEY) ?? '0');
        if (Date.now() - last > 3_600_000) {
          localStorage.setItem(TOUCH_KEY, String(Date.now()));
          void touchActivity();
        }
      } catch {
        // storage unavailable (private mode) — activity is still recorded on every sent turn
      }
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  // Reduce motion follows the in-app switch (and the OS setting via CSS).
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = profile?.reduce_motion ? 'true' : 'false';
  }, [profile?.reduce_motion]);

  const markOnboarded = useCallback(async () => {
    await completeOnboarding();
    setProfile((p) => (p ? { ...p, onboarded_at: p.onboarded_at ?? new Date().toISOString() } : p));
  }, []);

  // First visit: onboarding unless the learner chose "Skip setup" (appflow.md).
  useEffect(() => {
    if (status !== 'ready' || !profile || profile.onboarded_at) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('setup') === 'skip') {
      window.history.replaceState(null, '', pathname);
      completeOnboarding()
        .then(() => setProfile((p) => (p ? { ...p, onboarded_at: p.onboarded_at ?? new Date().toISOString() } : p)))
        .catch(() => undefined);
      return;
    }
    if (pathname !== '/onboarding') router.replace('/onboarding');
  }, [status, profile, pathname, router]);

  const refreshConversations = useCallback(async () => {
    setConversations(await fetchConversations());
  }, []);

  const upsertConversation = useCallback((c: Conversation) => {
    setConversations((xs) => [c, ...xs.filter((x) => x.id !== c.id)].sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
  }, []);

  const removeConversation = useCallback((id: string) => setConversations((xs) => xs.filter((x) => x.id !== id)), []);
  const clearConversations = useCallback(() => setConversations([]), []);
  const adjustSavedCount = useCallback((delta: number) => setSavedCount((n) => Math.max(0, n + delta)), []);
  const refreshSavedCount = useCallback(async () => setSavedCount(await fetchSavedCount()), []);

  const updatePrefs = useCallback(async (patch: Partial<ProfilePrefs>) => {
    let previous: Profile | null = null;
    setProfile((p) => {
      previous = p;
      return p ? { ...p, ...patch } : p;
    });
    try {
      await updateProfile(patch);
    } catch (e) {
      setProfile(previous);
      throw e;
    }
  }, []);

  const startFresh = useCallback(async () => {
    setConversations([]);
    setSavedCount(0);
    setProfile(null);
    await load(true);
  }, [load]);

  const value = useMemo<WorkspaceValue>(
    () => ({
      status,
      userId,
      profile,
      conversations,
      savedCount,
      streamingConversationId,
      reconnect: () => load(true),
      refreshConversations,
      upsertConversation,
      removeConversation,
      clearConversations,
      adjustSavedCount,
      refreshSavedCount,
      updatePrefs,
      markOnboarded,
      setStreamingConversation,
      startFresh,
    }),
    [status, userId, profile, conversations, savedCount, streamingConversationId, load, refreshConversations, upsertConversation, removeConversation, clearConversations, adjustSavedCount, refreshSavedCount, updatePrefs, markOnboarded, startFresh],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/** Workspace skeleton while the silent session is created; reconnect banner if it fails. */
export function SessionGate({ children }: { children: ReactNode }) {
  const ws = useWorkspace();
  if (ws.status === 'ready' && ws.profile) return <>{children}</>;
  if (ws.status === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 560 }}>
          <Banner
            tone="info"
            icon="lock"
            title="We couldn't restore your private session"
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void ws.reconnect()}>
                Reconnect
              </button>
            }
          >
            Your draft is kept. Reconnecting starts a fresh session.
          </Banner>
        </div>
      </div>
    );
  }
  return (
    <div className="ws" aria-busy="true" aria-label="Opening your private workspace">
      <div className="side desktop-only" style={{ padding: '16px 10px', gap: 12 }}>
        <div className="skeleton" style={{ height: 24, width: '60%' }} />
        <div className="skeleton" style={{ height: 40 }} />
        <div className="skeleton" style={{ height: 40 }} />
        <div className="skeleton" style={{ height: 14, width: '40%', marginTop: 12 }} />
        <div className="skeleton" style={{ height: 14, width: '80%' }} />
        <div className="skeleton" style={{ height: 14, width: '70%' }} />
      </div>
      <div className="main" style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="skeleton" style={{ height: 38, width: '55%', margin: '0 auto' }} />
          <div className="skeleton" style={{ height: 16, width: '70%', margin: '0 auto' }} />
          <div className="skeleton" style={{ height: 120, marginTop: 24 }} />
        </div>
      </div>
      <span className="sr-live" role="status">Opening your private workspace…</span>
    </div>
  );
}
