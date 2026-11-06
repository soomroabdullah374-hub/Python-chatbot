/// <reference path="../_shared/edge-runtime.d.ts" />
// Edge Function: POST /functions/v1/session — fallback silent anonymous session (DECISIONS D13).
// See _shared/session-handler.ts for the flow. The service client is needed because no user exists yet.
import { createClient } from '@supabase/supabase-js';
import { createSessionHandler, type IssuedSession, type SlotResult } from '../_shared/session-handler.ts';
import { adminClient, jsonLog, loadRuntime, serverEnv } from '../_shared/server.ts';

const env = serverEnv();
const admin = adminClient(env);
// Plain publishable-key client for the one password sign-in and refresh; nothing is persisted.
const auth = createClient(env.url, env.anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function issued(s: { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; token_type: string } | null | undefined): IssuedSession {
  if (!s) throw new Error('no session');
  return { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, expires_at: s.expires_at, token_type: s.token_type };
}

const handler = createSessionHandler({
  allowedOrigins: async () => (await loadRuntime(admin)).allowedOrigins,
  ipSalt: async () => (await loadRuntime(admin)).ipHashSalt,
  reserveSlot: async (bucket) => {
    const { data, error } = await admin.rpc('reserve_session_slot', { p_ip_bucket: bucket });
    if (error) throw new Error(`reserve_session_slot failed: ${error.code ?? 'unknown'}`);
    return data as SlotResult;
  },
  createUser: async (email, password) => {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.code ?? error?.status ?? 'unknown'}`);
    return { id: data.user.id };
  },
  signIn: async (email, password) => {
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`signIn failed: ${error.code ?? error.status ?? 'unknown'}`);
    return issued(data.session);
  },
  finish: async (userId) => {
    const { data, error } = await admin.rpc('finish_fallback_session', { p_user_id: userId });
    if (error) throw new Error(`finish_fallback_session failed: ${error.code ?? 'unknown'}`);
    return data === true;
  },
  refresh: async (refreshToken) => {
    const { data, error } = await auth.auth.refreshSession({ refresh_token: refreshToken });
    return error || !data.session ? null : issued(data.session);
  },
  deleteUser: async (userId) => {
    await admin.auth.admin.deleteUser(userId);
  },
  log: jsonLog,
});

Deno.serve(handler);
