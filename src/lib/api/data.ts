'use client';
// User-scoped reads go straight to the Data API (RLS limits every row to auth.uid());
// mutations go through checked RPCs (DATABASE.md "Access matrix").
import { functionsUrl, env } from '@/lib/env';
import { getSupabase } from '@/lib/supabase/client';
import type { ChatMessage, Conversation, Profile, ProfilePrefs, Rating, SavedItem } from '@/lib/types';
import { accessToken } from './session';
import { ClientError, fromPostgrest } from './errors';

const PROFILE_COLUMNS =
  'id, preferred_language, explanation_language, experience_level, explanation_depth, enter_to_send, reduce_motion, onboarded_at';

export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await getSupabase().from('profiles').select(PROFILE_COLUMNS).maybeSingle();
  if (error) throw fromPostgrest(error);
  return (data as Profile | null) ?? null;
}

export async function updateProfile(patch: Partial<ProfilePrefs>): Promise<void> {
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) throw new ClientError('SESSION_REQUIRED');
  const { error } = await supabase.from('profiles').update(patch).eq('id', uid);
  if (error) throw fromPostgrest(error);
}

export async function completeOnboarding(): Promise<void> {
  const { error } = await getSupabase().rpc('complete_onboarding');
  if (error) throw fromPostgrest(error);
}

export async function touchActivity(): Promise<void> {
  await getSupabase().rpc('touch_activity');
}

export async function fetchConversations(search?: string): Promise<Conversation[]> {
  let q = getSupabase()
    .from('conversations')
    .select('id, title, mode, language, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50);
  const term = search?.trim();
  if (term) q = q.ilike('title', `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const { data, error } = await q;
  if (error) throw fromPostgrest(error);
  return (data ?? []) as Conversation[];
}

export async function fetchConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await getSupabase()
    .from('conversations')
    .select('id, title, mode, language, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw fromPostgrest(error);
  return (data as Conversation | null) ?? null;
}

interface MessageRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: ChatMessage['status'];
  mode: ChatMessage['mode'];
  language: ChatMessage['language'];
  created_at: string;
  generation_request_id: string;
  message_sources: Array<{ citation_label: string; document_title: string; source_url: string | null; section: string | null }>;
  feedback: Array<{ rating: Rating }>;
  bookmarks: Array<{ message_id: string }>;
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await getSupabase()
    .from('messages')
    .select(
      'id, role, content, status, mode, language, created_at, generation_request_id, message_sources(citation_label, document_title, source_url, section), feedback(rating), bookmarks(message_id)',
    )
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw fromPostgrest(error);
  return ((data ?? []) as unknown as MessageRow[]).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    status: m.status,
    mode: m.mode,
    language: m.language,
    created_at: m.created_at,
    turnId: m.generation_request_id,
    sources: (m.message_sources ?? [])
      .map((s) => ({ label: s.citation_label, title: s.document_title, url: s.source_url, section: s.section }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    rating: m.feedback?.[0]?.rating ?? null,
    bookmarked: (m.bookmarks ?? []).length > 0,
  }));
}

async function rpc(fn: string, args: Record<string, unknown> = {}) {
  const { data, error } = await getSupabase().rpc(fn, args);
  if (error) throw fromPostgrest(error);
  return data;
}

export const renameConversation = (id: string, title: string) =>
  rpc('rename_conversation', { p_conversation_id: id, p_title: title }) as Promise<{ id: string; title: string }>;
export const deleteConversation = (id: string) => rpc('delete_conversation', { p_conversation_id: id });
export const deleteAllConversations = () => rpc('delete_all_conversations', { p_confirm: 'DELETE_ALL_CONVERSATIONS' });
export const setFeedback = (messageId: string, rating: Rating | null) =>
  rpc('set_feedback', { p_message_id: messageId, p_rating: rating, p_reason: null });
export const addBookmark = (messageId: string) => rpc('add_bookmark', { p_message_id: messageId });
export const removeBookmark = (messageId: string) => rpc('remove_bookmark', { p_message_id: messageId });
export const cancelTurn = (turnId: string) => rpc('cancel_turn', { p_turn_id: turnId });

export async function fetchSaved(): Promise<SavedItem[]> {
  const { data, error } = await getSupabase()
    .from('saved_explanations')
    .select('message_id, saved_at, conversation_id, mode, language, content, conversation_title, question')
    .order('saved_at', { ascending: false });
  if (error) throw fromPostgrest(error);
  return (data ?? []) as SavedItem[];
}

export async function fetchSavedCount(): Promise<number> {
  const { count, error } = await getSupabase().from('bookmarks').select('message_id', { count: 'exact', head: true });
  if (error) throw fromPostgrest(error);
  return count ?? 0;
}

/** POST /data-delete — removes every row and the anonymous auth user (IDENTITY.md). */
export async function deleteAllMyData(): Promise<void> {
  const token = await accessToken();
  let res: Response;
  try {
    res = await fetch(`${functionsUrl}/data-delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: env.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE_ALL_MY_DATA' }),
    });
  } catch {
    throw new ClientError('NETWORK');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const code = body?.error?.code;
    throw new ClientError(code === 'SESSION_REQUIRED' || code === 'INVALID_REQUEST' || code === 'RATE_LIMITED' ? code : 'INTERNAL_ERROR');
  }
}
