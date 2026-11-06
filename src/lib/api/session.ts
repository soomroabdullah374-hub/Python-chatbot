'use client';
// Silent anonymous identity (IDENTITY.md): no login UI, no credentials the learner ever sees.
import type { AuthError, Session, SupabaseClient } from '@supabase/supabase-js';
import { env, functionsUrl } from '@/lib/env';
import { getSupabase } from '@/lib/supabase/client';
import { getCaptchaToken } from '@/lib/turnstile';
import { ClientError } from './errors';

/** Supabase Auth refuses native anonymous sign-ins when the dashboard switch is off. */
function anonymousSignInsOff(error: AuthError | null): boolean {
  return Boolean(error && (error.code === 'anonymous_provider_disabled' || /anonymous sign-ins are disabled/i.test(error.message)));
}

/**
 * Server-side fallback (DECISIONS D13): the `session` Edge Function creates the same kind of
 * anonymous user (no email, no password) and returns its session, which we adopt locally.
 */
async function fallbackSession(supabase: SupabaseClient): Promise<Session> {
  let res: Response;
  try {
    res = await fetch(`${functionsUrl}/session`, {
      method: 'POST',
      headers: { apikey: env.supabaseKey, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
    });
  } catch {
    throw new ClientError('NETWORK');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || typeof body?.access_token !== 'string' || typeof body?.refresh_token !== 'string') {
    throw new ClientError('SESSION_REQUIRED', { detail: typeof body?.error?.code === 'string' ? body.error.code : `session ${res.status}` });
  }
  const { data, error } = await supabase.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
  if (error || !data.session) throw new ClientError('SESSION_REQUIRED', { detail: error?.message });
  return data.session;
}

let inflight: Promise<Session> | null = null;

/** Returns the existing anonymous session or silently creates one. */
export function ensureSession(): Promise<Session> {
  inflight ??= (async () => {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    let captchaToken: string | undefined;
    try {
      captchaToken = await getCaptchaToken();
    } catch {
      throw new ClientError('SESSION_REQUIRED');
    }
    const { data: signIn, error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
    if (signIn.session) return signIn.session;
    if (anonymousSignInsOff(error)) return fallbackSession(supabase);
    throw new ClientError('SESSION_REQUIRED', { detail: error?.message });
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** A fresh access token for Edge Function calls (refreshing if it is about to expire). */
export async function accessToken(): Promise<string> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  let session = data.session;
  if (session?.expires_at && session.expires_at * 1000 - Date.now() < 60_000) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session;
  }
  if (!session) session = await ensureSession();
  return session.access_token;
}

/** Drop the local session (used after "Delete all my data" or a failed restore) and start fresh. */
export async function resetSession(): Promise<Session> {
  const supabase = getSupabase();
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  return ensureSession();
}
