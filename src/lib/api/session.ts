'use client';
// Silent anonymous identity (IDENTITY.md): no login UI, no credentials the learner ever sees.
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { getCaptchaToken } from '@/lib/turnstile';
import { ClientError } from './errors';

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
    if (error || !signIn.session) throw new ClientError('SESSION_REQUIRED', { detail: error?.message });
    return signIn.session;
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
