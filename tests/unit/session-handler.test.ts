import { describe, expect, it, vi } from 'vitest';
import { createSessionHandler, FALLBACK_EMAIL_DOMAIN, type SessionDeps } from '@shared/session-handler.ts';

const ORIGIN = 'https://codebloom.test';

function deps(over: Partial<SessionDeps> = {}) {
  const calls: string[] = [];
  const base: SessionDeps = {
    allowedOrigins: async () => [ORIGIN],
    ipSalt: async () => 'salt',
    reserveSlot: async () => ({ status: 'ok' }),
    createUser: async (email) => {
      calls.push(`create:${email}`);
      return { id: 'user-1' };
    },
    signIn: async () => {
      calls.push('signIn');
      return { access_token: 'a1', refresh_token: 'r1', expires_in: 3600, token_type: 'bearer' };
    },
    finish: async (id) => {
      calls.push(`finish:${id}`);
      return true;
    },
    refresh: async (rt) => {
      calls.push(`refresh:${rt}`);
      return { access_token: 'a2', refresh_token: 'r2', expires_in: 3600, expires_at: 2_000_000_000, token_type: 'bearer' };
    },
    deleteUser: async (id) => {
      calls.push(`delete:${id}`);
    },
    log: () => undefined,
    newId: () => 'fixed-id',
    randomSecret: () => 'secret',
  };
  return { d: { ...base, ...over }, calls };
}

const post = (headers: Record<string, string> = {}) =>
  new Request('https://fn.test/session', { method: 'POST', headers: { Origin: ORIGIN, 'x-forwarded-for': '203.0.113.7', ...headers } });

describe('POST /session (anonymous session fallback)', () => {
  it('rejects origins outside the allowlist and answers preflight for allowed ones', async () => {
    const { d } = deps();
    const handle = createSessionHandler(d);
    expect((await handle(post({ Origin: 'https://evil.test' }))).status).toBe(403);
    const pre = await handle(new Request('https://fn.test/session', { method: 'OPTIONS', headers: { Origin: ORIGIN } }));
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect((await handle(new Request('https://fn.test/session', { method: 'GET', headers: { Origin: ORIGIN } }))).status).toBe(405);
  });

  it('creates, signs in, strips credentials, refreshes — and returns only the refreshed session', async () => {
    const { d, calls } = deps();
    const res = await createSessionHandler(d)(post());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ access_token: 'a2', refresh_token: 'r2', expires_in: 3600, expires_at: 2_000_000_000, token_type: 'bearer' });
    expect(calls).toEqual([`create:fixed-id@${FALLBACK_EMAIL_DOMAIN}`, 'signIn', 'finish:user-1', 'refresh:r1']);
  });

  it('passes the hashed IP bucket (never the raw IP) to the rate limiter', async () => {
    const reserveSlot = vi.fn(async () => ({ status: 'ok' as const }));
    const { d } = deps({ reserveSlot });
    await createSessionHandler(d)(post());
    const bucket = (reserveSlot.mock.calls[0] as unknown[])[0] as string;
    expect(bucket).toMatch(/^[0-9a-f]{64}$/);
    expect(bucket).not.toContain('203.0.113.7');
  });

  it('relays rate limits with Retry-After and creates nothing', async () => {
    const { d, calls } = deps({ reserveSlot: async () => ({ status: 'error', code: 'RATE_LIMITED', retry_after: 120 }) });
    const res = await createSessionHandler(d)(post());
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('120');
    expect((await res.json()).error.code).toBe('RATE_LIMITED');
    expect(calls).toEqual([]);
  });

  it('reports a switched-off fallback as SESSION_REQUIRED', async () => {
    const { d } = deps({ reserveSlot: async () => ({ status: 'error', code: 'SESSION_REQUIRED' }) });
    const res = await createSessionHandler(d)(post());
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('SESSION_REQUIRED');
  });

  it('deletes the half-made user when sign-in or the credential scrub fails', async () => {
    for (const over of [
      { signIn: async () => Promise.reject(new Error('rate limited')) },
      { finish: async () => false },
    ] as Partial<SessionDeps>[]) {
      const { d, calls } = deps(over);
      const res = await createSessionHandler(d)(post());
      expect(res.status).toBe(500);
      expect(calls.at(-1)).toBe('delete:user-1');
    }
  });

  it('falls back to the first session when the refresh fails', async () => {
    const { d } = deps({ refresh: async () => null });
    const body = await (await createSessionHandler(d)(post())).json();
    expect(body.access_token).toBe('a1');
    expect(body.expires_at).toBeGreaterThan(Date.now() / 1000);
  });
});
