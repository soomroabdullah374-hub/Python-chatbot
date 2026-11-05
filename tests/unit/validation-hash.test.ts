import { describe, expect, it } from 'vitest';
import { AppError } from '@shared/errors.ts';
import { clientIp, ipBucket, requestHash, sha256Hex } from '@shared/hash.ts';
import { bearerToken, parseChatRequest, readBodyLimited } from '@shared/validation.ts';

const valid = {
  conversation_id: null,
  idempotency_key: '4f3c2b1a-1111-4222-8333-444455556666',
  message: 'Explain Python loops with a small example.',
  mode: 'explain',
  programming_language: 'python',
};

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.code : 'OTHER';
  }
  return undefined;
}

describe('chat request validation', () => {
  it('accepts the documented request shape', () => {
    expect(parseChatRequest(JSON.stringify(valid))).toEqual(valid);
  });

  it.each([
    ['unknown fields (user_id)', { ...valid, user_id: 'x' }],
    ['client-supplied history', { ...valid, history: [] }],
    ['model selection', { ...valid, model: 'gpt' }],
    ['invalid uuid', { ...valid, idempotency_key: 'not-a-uuid' }],
    ['unsupported mode', { ...valid, mode: 'chat' }],
    ['unsupported language', { ...valid, programming_language: 'rust' }],
    ['blank message', { ...valid, message: '   ' }],
    ['missing message', { ...valid, message: undefined }],
  ])('rejects %s', (_name, body) => {
    expect(codeOf(() => parseChatRequest(JSON.stringify(body)))).toBe('INVALID_REQUEST');
  });

  it('rejects messages over 12,000 characters with INPUT_TOO_LARGE', () => {
    expect(codeOf(() => parseChatRequest(JSON.stringify({ ...valid, message: 'x'.repeat(12_001) })))).toBe('INPUT_TOO_LARGE');
  });

  it('rejects non-JSON bodies', () => {
    expect(codeOf(() => parseChatRequest('message=hi'))).toBe('INVALID_REQUEST');
  });

  it('enforces the body byte limit even when Content-Length is missing', async () => {
    const big = new Request('https://x/chat', { method: 'POST', body: 'x'.repeat(40_000) });
    await expect(readBodyLimited(big, 32 * 1024)).rejects.toMatchObject({ code: 'INPUT_TOO_LARGE' });
    const ok = new Request('https://x/chat', { method: 'POST', body: '{"a":"é"}' });
    await expect(readBodyLimited(ok, 32 * 1024)).resolves.toBe('{"a":"é"}');
  });

  it('reads bearer tokens strictly', () => {
    const r = (h: string) => new Request('https://x', { headers: { authorization: h } });
    expect(bearerToken(r('Bearer abc.def-ghi_jkl'))).toBe('abc.def-ghi_jkl');
    expect(bearerToken(r('Basic abc'))).toBeNull();
    expect(bearerToken(r('Bearer two tokens'))).toBeNull();
  });
});

describe('request hashing and IP buckets', () => {
  it('hashes the turn-defining fields deterministically', async () => {
    const a = await requestHash(valid as never);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await requestHash({ ...valid } as never)).toBe(a);
    expect(await requestHash({ ...valid, message: 'Different' } as never)).not.toBe(a);
    expect(await requestHash({ ...valid, mode: 'debug' } as never)).not.toBe(a);
  });

  it('uses the platform-added (right-most) forwarded address, preferring cf-connecting-ip', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIp(new Headers({ 'cf-connecting-ip': '198.51.100.4', 'x-forwarded-for': '1.1.1.1' }))).toBe('198.51.100.4');
    expect(clientIp(new Headers({ 'x-forwarded-for': 'garbage' }))).toBeNull();
    expect(clientIp(new Headers())).toBeNull();
  });

  it('never exposes the raw IP and buckets IPv6 by /64', async () => {
    const salt = 'test-salt';
    const bucket = await ipBucket('203.0.113.9', salt);
    expect(bucket).toMatch(/^[0-9a-f]{64}$/);
    expect(bucket).not.toContain('203');
    expect(await ipBucket('203.0.113.9', 'other-salt')).not.toBe(bucket);
    const a = await ipBucket('2001:db8:1:2:aaaa::1', salt);
    const b = await ipBucket('2001:db8:1:2:bbbb::2', salt);
    const c = await ipBucket('2001:db8:1:3::1', salt);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(await ipBucket('203.0.113.9', null)).toBeNull();
  });

  it('sha256Hex matches a known vector', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
