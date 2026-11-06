// POST /functions/v1/session — server-side fallback for the silent anonymous session (DECISIONS D13).
// Used only when Supabase Auth's "Anonymous Sign-ins" is switched off: the browser tries the native
// anonymous sign-in first and calls this when it gets `anonymous_provider_disabled`.
//   1. explicit-origin CORS, POST only, per-IP + global hourly limits (reserve_session_slot)
//   2. create a user with throwaway credentials (synthetic .invalid address, random password)
//   3. sign in once to obtain a normal Supabase session
//   4. finish_fallback_session(): drop email + password, mark is_anonymous = true
//   5. refresh, so the returned access token already carries is_anonymous = true
// Any failure after the user exists deletes it again. Nothing about the learner is collected.
import { corsHeaders } from './cors.ts';
import { type ErrorCode, ERROR_CATALOG, errorResponse } from './errors.ts';
import { clientIp, ipBucket } from './hash.ts';

export const FALLBACK_EMAIL_DOMAIN = 'anon.codebloom.invalid';

export interface IssuedSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
}

export type SlotResult = { status: 'ok' } | { status: 'error'; code: string; retry_after?: number };

export interface SessionDeps {
  allowedOrigins(): Promise<readonly string[]>;
  ipSalt(): Promise<string | null>;
  reserveSlot(ipBucket: string | null): Promise<SlotResult>;
  createUser(email: string, password: string): Promise<{ id: string }>;
  signIn(email: string, password: string): Promise<IssuedSession>;
  finish(userId: string): Promise<boolean>;
  refresh(refreshToken: string): Promise<IssuedSession | null>;
  deleteUser(userId: string): Promise<void>;
  log(entry: Record<string, unknown>): void;
  newId?: () => string;
  randomSecret?: () => string;
}

function defaultSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createSessionHandler(deps: SessionDeps) {
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const secret = deps.randomSecret ?? defaultSecret;

  return async function handleSession(req: Request): Promise<Response> {
    const requestId = newId();
    let cors: Record<string, string> | null;
    try {
      cors = corsHeaders(req.headers.get('origin'), await deps.allowedOrigins());
    } catch {
      return errorResponse('INTERNAL_ERROR', requestId);
    }
    if (cors === null) return errorResponse('ACTION_FORBIDDEN', requestId);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const headers = { ...cors, 'X-Request-Id': requestId };
    if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', requestId, headers);

    let slot: SlotResult;
    try {
      slot = await deps.reserveSlot(await ipBucket(clientIp(req.headers), await deps.ipSalt()));
    } catch {
      deps.log({ level: 'error', event: 'session_slot_failed', request_id: requestId });
      return errorResponse('INTERNAL_ERROR', requestId, headers);
    }
    if (slot.status !== 'ok') {
      const code: ErrorCode = slot.code in ERROR_CATALOG ? (slot.code as ErrorCode) : 'INTERNAL_ERROR';
      deps.log({ level: 'info', event: 'session_rejected', request_id: requestId, code });
      return errorResponse(code, requestId, headers, slot.retry_after);
    }

    const email = `${newId()}@${FALLBACK_EMAIL_DOMAIN}`;
    const password = secret();
    let userId: string | null = null;
    try {
      userId = (await deps.createUser(email, password)).id;
      const first = await deps.signIn(email, password);
      if (!(await deps.finish(userId))) throw new Error('finish_fallback_session matched no user');
      const session = (await deps.refresh(first.refresh_token).catch(() => null)) ?? first;
      deps.log({ level: 'info', event: 'session_created', request_id: requestId });
      return new Response(
        JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
          token_type: 'bearer',
        }),
        { status: 200, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } },
      );
    } catch (err) {
      // Messages are our own "<step> failed: <error code>" strings, never credentials or learner content.
      deps.log({ level: 'error', event: 'session_failed', request_id: requestId, stage: userId ? 'after_create' : 'create', error: String((err as Error)?.message ?? 'Error').slice(0, 120) });
      if (userId) await deps.deleteUser(userId).catch(() => undefined);
      return errorResponse('INTERNAL_ERROR', requestId, headers);
    }
  };
}
