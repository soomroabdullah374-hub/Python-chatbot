'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGES, LANGUAGE_LABELS, LIMITS, MODES, MODE_LABELS } from '@shared/constants.ts';
import type { ErrorCode } from '@shared/errors.ts';
import { splitSections } from '@/lib/answer';
import { streamChat, type TerminalError } from '@/lib/api/chat-stream';
import {
  addBookmark,
  cancelTurn,
  deleteConversation,
  fetchConversation,
  fetchMessages,
  removeBookmark,
  renameConversation,
  setFeedback,
} from '@/lib/api/data';
import { ClientError, describeRetry } from '@/lib/api/errors';
import { accessToken } from '@/lib/api/session';
import { env } from '@/lib/env';
import type { ChatMessage, Conversation, Language, MessageStatus, Mode, Rating, Source, TurnStage } from '@/lib/types';
import { Banner } from '@/components/ui/Banner';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toasts';
import { activeConversationId } from '@/components/navigation/Sidebar';
import { useShell } from '@/components/navigation/Shell';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { AssistantMessage } from './AssistantMessage';
import { Composer, type ComposerHandle } from './Composer';
import { EmptyState, STARTERS } from './EmptyState';
import { LearningPanel, type PracticeState } from './LearningPanel';
import { UserMessage } from './UserMessage';

type LocalMessage = ChatMessage & { errorCode?: ErrorCode | 'NETWORK' | null };

interface LiveTurn {
  key: string;
  message: string;
  mode: Mode;
  language: Language;
  stage: TurnStage;
  sourcesFound: number | null;
  text: string;
  sources: Source[];
  turnId: string | null;
  userMessageId: string | null;
  assistantMessageId: string | null;
  conversationId: string | null;
}

interface Notice {
  tone: 'warn' | 'danger' | 'info' | 'neutral';
  icon: IconName;
  title: string;
  body: string;
  action?: 'reconnect' | 'resend' | 'new-chat';
}

const PLACEHOLDER: Record<Mode, string> = {
  explain: 'Ask about a concept — e.g. “What is a function?”',
  debug: 'Paste a few lines of code and the error you see…',
  practice: 'Name a concept to practise — e.g. “for loops”',
};
const LEVEL_LABEL = { new: 'Beginner', basics: 'Some basics', comfortable: 'Comfortable' } as const;
const PRACTICE_KEY = 'cb:practice';

const draftKey = (id: string | null) => `cb:draft:${id ?? 'new'}`;
function readDraft(id: string | null): string {
  try {
    return sessionStorage.getItem(draftKey(id)) ?? '';
  } catch {
    return '';
  }
}
function writeDraft(id: string | null, v: string) {
  try {
    if (v) sessionStorage.setItem(draftKey(id), v);
    else sessionStorage.removeItem(draftKey(id));
  } catch {
    // storage unavailable
  }
}

function noticeFor(err: { code: ErrorCode | 'NETWORK'; retry_after?: number; message?: string }): Notice {
  switch (err.code) {
    case 'RATE_LIMITED':
    case 'DAILY_LIMIT_REACHED':
    case 'NETWORK_LIMIT_REACHED':
      return {
        tone: 'warn',
        icon: 'clock',
        title: "You've reached the limit for now",
        body: `Your draft is saved. You can send again ${describeRetry(err.retry_after)}.`,
      };
    case 'SESSION_REQUIRED':
      return { tone: 'info', icon: 'lock', title: "We couldn't restore your private session", body: 'Your draft is kept. Reconnecting starts a fresh session.', action: 'reconnect' };
    case 'TURN_IN_PROGRESS':
      return { tone: 'warn', icon: 'clock', title: 'CodeBloom is still writing', body: 'Wait for the previous answer to finish (or stop it), then send again. Your draft is kept.' };
    case 'NOT_FOUND':
      return { tone: 'danger', icon: 'warning', title: 'This conversation was deleted', body: 'Start a new chat to keep learning.', action: 'new-chat' };
    case 'MODEL_UNAVAILABLE':
      return { tone: 'danger', icon: 'warning', title: "The tutor isn't responding", body: "This isn't anything you did. Your message is kept.", action: 'resend' };
    case 'BUDGET_PAUSED':
    case 'GENERATION_PAUSED':
      return { tone: 'warn', icon: 'clock', title: 'New answers are paused', body: `${err.message ?? 'Please try again later.'} Your draft is kept.` };
    case 'INPUT_TOO_LARGE':
      return { tone: 'warn', icon: 'alertCircle', title: 'That message is too long', body: 'Try a shorter question or a smaller piece of code (up to 12,000 characters).' };
    case 'NETWORK':
      return { tone: 'neutral', icon: 'wifi', title: 'Connection lost', body: "Your message wasn't sent. Check your connection and try again — your draft is kept.", action: 'resend' };
    default:
      return { tone: 'danger', icon: 'warning', title: 'Something went wrong', body: err.message ?? 'Please try again. Your draft is kept.', action: 'resend' };
  }
}

function statusFrom(s: string | undefined): MessageStatus {
  if (s === 'interrupted' || s === 'incomplete' || s === 'failed') return s;
  return 'failed';
}

function readPractice(): PracticeState {
  try {
    const raw = localStorage.getItem(PRACTICE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<PracticeState>;
      return { hints: v.hints ?? {}, solutions: v.solutions ?? {} };
    }
  } catch {
    // storage unavailable or corrupt
  }
  return { hints: {}, solutions: {} };
}

export function ChatView() {
  const pathname = usePathname();
  const routeId = activeConversationId(pathname);
  const router = useRouter();
  const ws = useWorkspace();
  const profile = ws.profile!;
  const toast = useToast();
  const shell = useShell();

  const [conversationId, setConversationId] = useState<string | null>(routeId);
  const currentRef = useRef<string | null>(routeId);
  const initialised = useRef(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const conversationRef = useRef<Conversation | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [load, setLoad] = useState<'loading' | 'ready' | 'notfound' | 'error'>(routeId ? 'loading' : 'ready');
  const [mode, setMode] = useState<Mode>('explain');
  const [language, setLanguage] = useState<Language>(profile.preferred_language);
  const [draft, setDraftState] = useState('');
  const [live, setLive] = useState<LiveTurn | null>(null);
  const liveRef = useRef<LiveTurn | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const [practice, setPractice] = useState<PracticeState>(readPractice);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [atBottom, setAtBottom] = useState(true);
  const stickRef = useRef(true);
  const composerRef = useRef<ComposerHandle>(null);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  const savePractice = (next: PracticeState) => {
    setPractice(next);
    try {
      localStorage.setItem(PRACTICE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const setDraft = useCallback((v: string) => {
    setDraftState(v);
    writeDraft(currentRef.current, v);
  }, []);

  const loadConversation = useCallback(async (id: string, quiet = false) => {
    if (!quiet) setLoad('loading');
    try {
      const [conv, msgs] = await Promise.all([fetchConversation(id), fetchMessages(id)]);
      if (currentRef.current !== id) return;
      if (!conv) {
        setLoad('notfound');
        return;
      }
      setConversation(conv);
      setMessages(msgs);
      if (!quiet) {
        setMode(conv.mode);
        setLanguage(conv.language);
        // Deep link from Saved explanations: /chat/<id>#m-<message id>.
        const hash = window.location.hash;
        if (/^#m-[0-9a-f-]{36}$/.test(hash)) {
          requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }));
        }
      }
      setLoad('ready');
    } catch {
      if (!quiet) setLoad('error');
    }
  }, []);

  // Route → view state. Our own replaceState to /chat/<new id> leaves currentRef equal, so the
  // live stream keeps running; navigating elsewhere aborts the stream and resets the view.
  // This synchronises with the router and an in-flight fetch, so it belongs in an effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialised.current && routeId === currentRef.current) return;
    initialised.current = true;
    if (abortRef.current) {
      abortRef.current.abort(); // the server keeps writing and saves the answer
      abortRef.current = null;
    }
    liveRef.current = null;
    setLive(null);
    ws.setStreamingConversation(null);
    currentRef.current = routeId;
    setConversationId(routeId);
    setNotice(null);
    setMessages([]);
    setConversation(null);
    setPanelOpen(false);
    setRenaming(false);
    setMenuOpen(false);
    setDraftState(readDraft(routeId));
    if (routeId) void loadConversation(routeId);
    else {
      setLoad('ready');
      setMode('explain');
      setLanguage(profile.preferred_language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // An answer that was still being written when this page loaded: poll until it is saved.
  const waitingOnServer = !live && messages.some((m) => m.role === 'assistant' && m.status === 'streaming');
  useEffect(() => {
    if (!waitingOnServer || !conversationId) return;
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (n > 60) clearInterval(t);
      else void loadConversation(conversationId, true);
    }, 2500);
    return () => clearInterval(t);
  }, [waitingOnServer, conversationId, loadConversation]);

  // Follow the stream only while the learner is at the bottom (Design.md "Interaction").
  useEffect(() => {
    const onScroll = () => {
      const bottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 140;
      stickRef.current = bottom;
      setAtBottom(bottom);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (live && stickRef.current) window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [live?.text, live?.stage, live]);

  const jumpToLatest = () => {
    stickRef.current = true;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  };

  const send = useCallback(
    async (text: string, opts: { mode?: Mode; fromDraft?: boolean } = {}) => {
      if (liveRef.current) return;
      const message = text.replace(/\s+$/, '');
      if (!message.trim()) return;
      if (message.length > LIMITS.maxMessageChars) {
        setNotice(noticeFor({ code: 'INPUT_TOO_LARGE' }));
        return;
      }
      const turnMode = opts.mode ?? mode;
      if (opts.mode && opts.mode !== mode) setMode(opts.mode);
      const key = crypto.randomUUID();
      const abort = new AbortController();
      abortRef.current = abort;
      const turn: LiveTurn = {
        key,
        message,
        mode: turnMode,
        language,
        stage: 'submitting',
        sourcesFound: null,
        text: '',
        sources: [],
        turnId: null,
        userMessageId: null,
        assistantMessageId: null,
        conversationId: currentRef.current,
      };
      liveRef.current = turn;
      setLive(turn);
      setNotice(null);
      if (opts.fromDraft) setDraftState('');
      ws.setStreamingConversation(currentRef.current);
      setAnnounce('CodeBloom is writing an answer.');
      stickRef.current = true;
      requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight }));

      const update = (fn: (t: LiveTurn) => LiveTurn) => {
        if (!liveRef.current || liveRef.current.key !== key) return;
        liveRef.current = fn(liveRef.current);
        setLive(liveRef.current);
      };
      const finish = (status: MessageStatus, code: ErrorCode | 'NETWORK' | null) => {
        const t = liveRef.current;
        if (!t || t.key !== key) return;
        liveRef.current = null;
        setLive(null);
        abortRef.current = null;
        ws.setStreamingConversation(null);
        const now = new Date().toISOString();
        const base = { mode: t.mode, language: t.language, created_at: now, turnId: t.turnId, rating: null, bookmarked: false };
        setMessages((ms) => [
          ...ms,
          { ...base, id: t.userMessageId ?? `local-u-${key}`, role: 'user', content: t.message, status: 'completed', sources: [] },
          {
            ...base,
            id: t.assistantMessageId ?? `local-a-${key}`,
            role: 'assistant',
            content: t.text,
            status,
            sources: status === 'completed' ? t.sources : [],
            errorCode: code,
          },
        ]);
        if (status === 'completed') {
          writeDraft(t.conversationId, '');
          writeDraft(null, '');
          setAnnounce('Answer complete.');
        } else {
          setAnnounce(status === 'interrupted' ? 'Answer stopped.' : 'The answer could not be completed.');
        }
        const conv = conversationRef.current;
        if (conv) ws.upsertConversation({ ...conv, mode: t.mode, language: t.language, updated_at: now });
      };

      let token: string;
      try {
        token = await accessToken();
      } catch {
        liveRef.current = null;
        setLive(null);
        abortRef.current = null;
        ws.setStreamingConversation(null);
        setDraft(message);
        setNotice(noticeFor({ code: 'SESSION_REQUIRED' }));
        return;
      }

      let pending = '';
      let raf = 0;
      const flush = () => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        if (!pending) return;
        const add = pending;
        pending = '';
        update((t) => ({ ...t, text: t.text + add, stage: t.stage === 'retrieving' ? 'streaming' : t.stage }));
      };

      const outcome = await streamChat(
        { conversation_id: currentRef.current, idempotency_key: key, message, mode: turnMode, programming_language: language },
        token,
        {
          onMeta(e) {
            update((t) => ({ ...t, stage: 'retrieving', turnId: e.turn_id, userMessageId: e.user_message_id, assistantMessageId: e.assistant_message_id, conversationId: e.conversation_id }));
            if (!currentRef.current) {
              currentRef.current = e.conversation_id;
              setConversationId(e.conversation_id);
              const now = new Date().toISOString();
              const conv: Conversation = { id: e.conversation_id, title: e.conversation_title, mode: turnMode, language, created_at: now, updated_at: now };
              conversationRef.current = conv;
              setConversation(conv);
              ws.upsertConversation(conv);
              window.history.replaceState(null, '', `/chat/${e.conversation_id}`);
            }
            ws.setStreamingConversation(e.conversation_id);
          },
          onStatus(e) {
            update((t) => ({ ...t, stage: e.stage, sourcesFound: e.sources_found ?? t.sourcesFound }));
          },
          onDelta(chunk) {
            pending += chunk;
            if (!raf) raf = requestAnimationFrame(flush);
          },
          onSources(items) {
            update((t) => ({ ...t, sources: items }));
          },
          onDone() {
            flush();
            finish('completed', null);
          },
          onError(err: TerminalError) {
            flush();
            if (err.code === 'NOT_FOUND') setNotice(noticeFor({ code: 'NOT_FOUND' }));
            finish(statusFrom(err.status), err.code);
          },
        },
        abort.signal,
      );

      if (outcome.kind === 'rejected') {
        if (liveRef.current?.key === key) {
          liveRef.current = null;
          setLive(null);
          abortRef.current = null;
          ws.setStreamingConversation(null);
        }
        setDraft(message);
        setNotice(noticeFor({ code: outcome.error.code, retry_after: outcome.error.retry_after, message: outcome.error.message }));
        if (outcome.error.code === 'TURN_IN_PROGRESS' && currentRef.current) void loadConversation(currentRef.current, true);
      } else if (outcome.kind === 'replay') {
        if (liveRef.current?.key === key) {
          liveRef.current = null;
          setLive(null);
          abortRef.current = null;
          ws.setStreamingConversation(null);
        }
        if (currentRef.current) void loadConversation(currentRef.current, true);
      } else if (outcome.kind === 'network' || (outcome.kind === 'streamed' && outcome.terminal === 'eof')) {
        const t = liveRef.current?.key === key ? liveRef.current : null;
        if (t) {
          liveRef.current = null;
          setLive(null);
          abortRef.current = null;
          ws.setStreamingConversation(null);
          if (t.turnId && currentRef.current) {
            // The turn reached the server: reload the authoritative state, never resend.
            setNotice({ tone: 'neutral', icon: 'wifi', title: 'Connection lost', body: 'Reloaded the latest saved state. Nothing was sent twice.' });
            const id = currentRef.current;
            setTimeout(() => void loadConversation(id, true), 1500);
          } else {
            setDraft(message);
            setNotice(noticeFor({ code: 'NETWORK' }));
          }
        }
      }
    },
    [language, mode, ws, setDraft, loadConversation],
  );

  const stop = useCallback(() => {
    const t = liveRef.current;
    if (!t) return;
    abortRef.current?.abort();
    abortRef.current = null;
    liveRef.current = null;
    setLive(null);
    ws.setStreamingConversation(null);
    const now = new Date().toISOString();
    const base = { mode: t.mode, language: t.language, created_at: now, turnId: t.turnId, rating: null, bookmarked: false };
    setMessages((ms) => [
      ...ms,
      { ...base, id: t.userMessageId ?? `local-u-${t.key}`, role: 'user', content: t.message, status: 'completed', sources: [] },
      { ...base, id: t.assistantMessageId ?? `local-a-${t.key}`, role: 'assistant', content: t.text, status: 'interrupted', sources: [], errorCode: 'GENERATION_INTERRUPTED' },
    ]);
    if (t.turnId) void cancelTurn(t.turnId).catch(() => undefined);
    setAnnounce('Answer stopped.');
  }, [ws]);

  const retryFor = (index: number) => {
    const question = [...messages.slice(0, index)].reverse().find((m) => m.role === 'user');
    if (question) void send(question.content, { mode: messages[index].mode });
  };

  const toggleSave = async (m: LocalMessage) => {
    const next = !m.bookmarked;
    setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, bookmarked: next } : x)));
    try {
      if (next) await addBookmark(m.id);
      else await removeBookmark(m.id);
      ws.adjustSavedCount(next ? 1 : -1);
      toast.show(next ? 'Saved to your explanations' : 'Removed from saved explanations');
    } catch {
      setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, bookmarked: !next } : x)));
      toast.show("Couldn't update saved explanations. Please try again.", { icon: 'none' });
    }
  };

  const rate = async (m: LocalMessage, rating: Rating | null) => {
    const previous = m.rating;
    setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, rating } : x)));
    setVoted((v) => ({ ...v, [m.id]: rating !== null }));
    try {
      await setFeedback(m.id, rating);
    } catch {
      setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, rating: previous } : x)));
      setVoted((v) => ({ ...v, [m.id]: false }));
    }
  };

  const copyAnswer = async (m: LocalMessage) => {
    try {
      await navigator.clipboard.writeText(m.content);
      toast.show('Answer copied to clipboard');
    } catch {
      toast.show('Copy failed — select the text and copy it manually', { icon: 'none' });
    }
  };

  const saveRename = async () => {
    if (!conversation) return;
    const title = titleDraft.replace(/\s+/g, ' ').trim();
    if (!title) {
      setTitleError("A title can't be empty.");
      return;
    }
    try {
      const res = await renameConversation(conversation.id, title);
      const conv = { ...conversation, title: res.title };
      setConversation(conv);
      ws.upsertConversation(conv);
      setRenaming(false);
      setTitleError(null);
    } catch (e) {
      setTitleError(e instanceof ClientError ? e.detail ?? e.message : 'Rename failed.');
    }
  };

  const doDelete = async () => {
    if (!conversation) return;
    setDeleting(true);
    try {
      if (liveRef.current) stop();
      await deleteConversation(conversation.id);
      ws.removeConversation(conversation.id);
      writeDraft(conversation.id, '');
      setConfirmDelete(false);
      toast.show('Conversation deleted');
      router.push('/chat');
    } catch {
      toast.show("Couldn't delete the conversation. Please try again.", { icon: 'none' });
    } finally {
      setDeleting(false);
    }
  };

  const pickStarter = (s: (typeof STARTERS)[number]) => {
    setMode(s.mode);
    setLanguage(s.language);
    composerRef.current?.setValue(s.fill);
  };

  const exerciseNumbers = useMemo(() => {
    const map: Record<string, number> = {};
    let n = 0;
    for (const m of messages) {
      if (m.role === 'assistant' && splitSections(m.content).some((s) => s.kind === 'exercise')) map[m.id] = ++n;
    }
    return map;
  }, [messages]);

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) if (messages[i].role === 'assistant') return i;
    return -1;
  })();

  const streaming = Boolean(live);
  const hasThread = messages.length > 0 || streaming;
  const showEmpty = !conversationId && !hasThread && load === 'ready';
  const title = conversation?.title ?? (conversationId ? '' : 'New chat');
  const panelMode: Mode = live?.mode ?? mode;
  const showPanel = hasThread && (panelOpen || panelMode !== 'debug');
  const placeholder = streaming
    ? 'You can type your next message while CodeBloom writes…'
    : !hasThread
      ? PLACEHOLDER[mode]
      : mode === 'practice'
        ? 'Paste your next attempt…'
        : 'Ask a follow-up…';
  const topic = (conversation?.title ?? 'this topic').replace(/[?.!]+$/, '');

  const composer = (
    <>
      {notice && (
        <Banner
          tone={notice.tone}
          icon={notice.icon}
          title={notice.title}
          action={
            notice.action === 'reconnect' ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void ws.reconnect()}>
                Reconnect
              </button>
            ) : notice.action === 'resend' && draft.trim() ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void send(draft, { fromDraft: true })}>
                Retry
              </button>
            ) : notice.action === 'new-chat' ? (
              <Link href="/chat" className="btn btn-secondary btn-sm">
                New chat
              </Link>
            ) : undefined
          }
        >
          {notice.body}
        </Banner>
      )}
      <Composer
        ref={composerRef}
        value={draft}
        onChange={setDraft}
        onSend={() => void send(draft, { fromDraft: true })}
        onStop={stop}
        streaming={streaming}
        mode={mode}
        language={language}
        enterToSend={profile.enter_to_send}
        placeholder={placeholder}
        rows={!hasThread ? 3 : 2}
        mono={hasThread && mode === 'practice' && !streaming}
        label={hasThread && mode === 'practice' ? 'Send your next attempt' : 'Message CodeBloom'}
      />
      <p className="fineprint">
        {streaming
          ? 'Stopping keeps the partial answer, marked as interrupted. Nothing is retried automatically.'
          : `CodeBloom never runs your code and can make mistakes. Prompts are sent to ${env.providerName} — don't paste passwords or keys.`}
      </p>
    </>
  );

  const modeOptions = MODES.map((m) => ({
    value: m,
    label: (
      <>
        <span className={`dot dot-${m}`} aria-hidden="true" />
        {MODE_LABELS[m]}
      </>
    ),
  }));

  return (
    <>
      {/* Mobile header + full-width modes (Design.md "Layout" — 390 reference, 320 minimum) */}
      <header className="mobile-bar">
        <button type="button" className="btn btn-ghost" onClick={shell.openDrawer} style={{ minHeight: 44, padding: '0 10px', color: 'var(--text)' }}>
          <Icon name="menu" size={18} />
          Menu
        </button>
        <h1>{title}</h1>
        <Link href="/chat" className="btn btn-ghost btn-icon btn-lg" aria-label="New chat" style={{ color: 'var(--text)' }}>
          <Icon name="newChat" size={18} />
        </Link>
      </header>
      <div className="mobile-modes">
        <Segmented options={modeOptions} value={mode} onChange={setMode} label="Mode" full large btnStyle={{ minHeight: 38 }} />
      </div>

      <header className="topbar">
        {shell.sidebarCollapsed && (
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Expand sidebar" onClick={shell.expandSidebar}>
            <Icon name="sidebar" size={18} />
          </button>
        )}
        {renaming && conversation ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveRename();
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
          >
            <label htmlFor="rename" className="sr-only">
              Conversation title
            </label>
            <input
              id="rename"
              className="input"
              value={titleDraft}
              maxLength={LIMITS.maxTitleChars}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)}
              aria-invalid={titleError ? true : undefined}
              autoFocus
              style={{ minHeight: 34, width: 'min(360px, 60vw)' }}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Save
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(false)}>
              Cancel
            </button>
            {titleError && (
              <span className="field-error" role="alert">
                <Icon name="alertCircle" size={14} />
                {titleError}
              </span>
            )}
          </form>
        ) : (
          <>
            <h1 className="topbar-title">{title}</h1>
            {conversation && (
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm tip"
                data-tip="Rename"
                aria-label="Rename conversation"
                style={{ marginLeft: -6 }}
                onClick={() => {
                  setTitleDraft(conversation.title);
                  setTitleError(null);
                  setRenaming(true);
                }}
              >
                <Icon name="pencil" size={14} />
              </button>
            )}
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <label htmlFor="lang-select" className="sr-only">
            Language
          </label>
          <select id="lang-select" className="select" style={{ minHeight: 36 }} value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_LABELS[l]}
              </option>
            ))}
          </select>
          <Segmented options={modeOptions} value={mode} onChange={setMode} label="Mode" />
          {hasThread && (
            <button
              type="button"
              className={`btn btn-secondary btn-icon${panelMode === 'debug' ? '' : ' panel-toggle-auto'}`}
              aria-label={panelOpen ? 'Hide learning panel' : 'Show learning panel'}
              aria-pressed={panelOpen}
              onClick={() => setPanelOpen((v) => !v)}
            >
              <Icon name="panel" size={16} />
            </button>
          )}
          {conversation && (
            <div style={{ position: 'relative' }}>
              <button type="button" className="btn btn-secondary btn-icon" aria-label="Conversation actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
                <Icon name="dots" size={16} />
              </button>
              {menuOpen && (
                <div className="menu pop" role="menu" onKeyDown={(e) => e.key === 'Escape' && setMenuOpen(false)}>
                  <button
                    type="button"
                    role="menuitem"
                    autoFocus
                    onClick={() => {
                      setMenuOpen(false);
                      setTitleDraft(conversation.title);
                      setRenaming(true);
                    }}
                  >
                    <Icon name="pencil" size={14} />
                    Rename
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmDelete(true);
                    }}
                  >
                    <Icon name="trash" size={14} />
                    Delete conversation
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="content">
        <main className="thread" aria-label="Conversation">
          <div className="conv" style={panelMode === 'debug' ? { maxWidth: 800 } : undefined}>
            {load === 'loading' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} aria-busy="true">
                <div className="skeleton" style={{ height: 44, width: '60%', alignSelf: 'flex-end', borderRadius: 18 }} />
                <div className="skeleton" style={{ height: 14, width: '40%' }} />
                <div className="skeleton" style={{ height: 14, width: '90%' }} />
                <div className="skeleton" style={{ height: 120 }} />
              </div>
            )}
            {load === 'notfound' && (
              <div className="card pop" style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
                <span className="feature-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                  <Icon name="search" size={20} />
                </span>
                <h2 className="h3">We couldn&apos;t find that conversation</h2>
                <p className="muted" style={{ fontSize: 14, maxWidth: 380 }}>
                  It may have been deleted, or it belongs to a different browser. Conversations are private to the browser that started them.
                </p>
                <Link href="/chat" className="btn btn-secondary btn-sm">
                  Start a new chat
                </Link>
              </div>
            )}
            {load === 'error' && conversationId && (
              <Banner
                tone="danger"
                icon="warning"
                title="This conversation didn't load"
                action={
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadConversation(conversationId)}>
                    Retry
                  </button>
                }
              >
                Check your connection and try again.
              </Banner>
            )}

            {showEmpty ? (
              <EmptyState onPick={pickStarter}>{composer}</EmptyState>
            ) : (
              load === 'ready' && (
                <>
                  {messages.map((m, i) =>
                    m.role === 'user' ? (
                      <UserMessage key={m.id} content={m.content} language={m.language} />
                    ) : (
                      <AssistantMessage
                        key={m.id}
                        message={m}
                        isLast={i === lastAssistantIdx && !streaming}
                        exerciseNumber={exerciseNumbers[m.id]}
                        level={LEVEL_LABEL[profile.experience_level]}
                        hintsShown={practice.hints[m.id] ?? 1}
                        solutionShown={Boolean(practice.solutions[m.id])}
                        onHint={() => savePractice({ ...practice, hints: { ...practice.hints, [m.id]: (practice.hints[m.id] ?? 1) + 1 } })}
                        onSolution={() => savePractice({ ...practice, solutions: { ...practice.solutions, [m.id]: true } })}
                        onRetry={!streaming ? () => retryFor(i) : undefined}
                        onCopy={() => void copyAnswer(m)}
                        onToggleSave={() => void toggleSave(m)}
                        onRate={(r) => void rate(m, r)}
                        voted={Boolean(voted[m.id])}
                        onFollowUp={(text, followMode) => void send(text, { mode: followMode })}
                        onAnswerCheck={() => composerRef.current?.setValue('My answer: ')}
                      />
                    ),
                  )}
                  {live && (
                    <>
                      <UserMessage content={live.message} language={live.language} />
                      <AssistantMessage
                        message={{ id: null, content: live.text, status: 'streaming', mode: live.mode, language: live.language, sources: [], rating: null, bookmarked: false }}
                        live={{ stage: live.stage, sourcesFound: live.sourcesFound }}
                        isLast={false}
                        level={LEVEL_LABEL[profile.experience_level]}
                        hintsShown={1}
                        solutionShown={false}
                        onHint={() => undefined}
                        onSolution={() => undefined}
                        onCopy={() => undefined}
                        onToggleSave={() => undefined}
                        onRate={() => undefined}
                        voted={false}
                        onFollowUp={() => undefined}
                        onAnswerCheck={() => undefined}
                      />
                    </>
                  )}
                  {streaming && !atBottom && (
                    <div style={{ position: 'sticky', bottom: 150, display: 'flex', justifyContent: 'center', zIndex: 5 }}>
                      <button type="button" className="btn btn-secondary btn-sm pop" style={{ borderRadius: 999, boxShadow: 'var(--sh-md)' }} onClick={jumpToLatest}>
                        <Icon name="arrowDown" size={14} strokeWidth={2} />
                        Jump to latest
                      </button>
                    </div>
                  )}
                  <div className="composer-dock" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {composer}
                  </div>
                </>
              )
            )}
          </div>
        </main>
        {showPanel && (
          <LearningPanel
            mode={panelMode}
            messages={messages}
            profile={profile}
            topic={topic.length > 48 ? `${topic.slice(0, 46)}…` : topic}
            practice={practice}
            className={panelOpen ? 'panel-open' : 'panel-auto'}
            onClose={panelOpen ? () => setPanelOpen(false) : undefined}
            onStartPractice={() => void send(`Give me one short exercise about: ${topic}`, { mode: 'practice' })}
            onExplainConcept={(concept) => void send(`Explain this concept first: ${concept}`, { mode: 'explain' })}
          />
        )}
      </div>

      <div className="sr-live" role="status" aria-live="polite">
        {announce}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete “${conversation?.title ?? 'this conversation'}”?`}
        body="This removes its messages and saved explanations. An answer still being written is cancelled."
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
