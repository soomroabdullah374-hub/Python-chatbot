import { describe, expect, it } from 'vitest';
import {
  type ChatDeps,
  createChatHandler,
  type FinalizeArgs,
  type ReserveArgs,
  type ReservedTurn,
  type RetrievedChunk,
} from '@shared/chat-handler.ts';
import { ProviderHttpError, ProviderStreamError, type ProviderEvent } from '@shared/providers.ts';
import { readSse } from '@shared/sse.ts';
import { collect } from './helpers';

const body = {
  conversation_id: null,
  idempotency_key: '4f3c2b1a-1111-4222-8333-444455556666',
  message: 'When should I use let instead of const?',
  mode: 'explain',
  programming_language: 'javascript',
};

const reserved: ReservedTurn = {
  status: 'reserved',
  turn_id: 'turn-1',
  conversation_id: 'conv-1',
  conversation_title: 'When should I use let instead of const?',
  user_message_id: 'um-1',
  assistant_message_id: 'am-1',
  history: [],
  preferences: { explanation_language: 'en', experience_level: 'new', explanation_depth: 'concise' },
};

const chunks: RetrievedChunk[] = [
  { chunk_id: 'c-1', title: 'Declaring variables with let and const', section: 'JavaScript › Variables', source_url: null, source_version: 'v1', heading: 'let vs const', content: 'const cannot be reassigned.', similarity: 0.9 },
  { chunk_id: 'c-2', title: 'Reading a TypeError', section: 'JavaScript › Errors', source_url: null, source_version: 'v1', heading: null, content: 'A TypeError means…', similarity: 0.85 },
];

async function* events(list: ProviderEvent[]): AsyncGenerator<ProviderEvent> {
  for (const e of list) yield e;
}

const okStream: ProviderEvent[] = [
  { type: 'delta', text: '## Short answer\n\nUse `const` by default' },
  { type: 'delta', text: ' and `let` when you reassign [S1]. Never [S7].' },
  { type: 'usage', inputTokens: 900, outputTokens: 40, reasoningTokens: 12 },
  { type: 'done', finishReason: 'stop', providerRequestId: 'req_groq_1' },
];

function setup(overrides: Partial<ChatDeps> = {}, stream?: (model: string, signal: AbortSignal) => AsyncIterable<ProviderEvent> | Promise<AsyncIterable<ProviderEvent>>) {
  const calls = { reserve: [] as ReserveArgs[], finalize: [] as FinalizeArgs[], heartbeat: [] as Array<string | undefined>, models: [] as string[], logs: [] as Record<string, unknown>[] };
  let finalized: () => void = () => undefined;
  const finalizedPromise = new Promise<void>((r) => {
    finalized = r;
  });
  const deps: ChatDeps = {
    allowedOrigins: async () => ['https://app.test'],
    verifyUser: async (token) => (token === 'good-token' ? 'user-1' : null),
    ipSalt: async () => 'salt',
    provider: async () => ({
      name: 'groq',
      model: 'openai/gpt-oss-120b',
      fallbackModel: 'openai/gpt-oss-20b',
      stream: async (model, _messages, signal) => {
        calls.models.push(model);
        return stream ? await stream(model, signal) : events(okStream);
      },
    }),
    reserveTurn: async (a) => {
      calls.reserve.push(a);
      return reserved;
    },
    heartbeat: async (_id, status) => {
      calls.heartbeat.push(status);
      return { exists: true, cancel: false };
    },
    finalize: async (a) => {
      calls.finalize.push(a);
      finalized();
      return { ok: true, status: a.status };
    },
    retrieve: async () => chunks,
    log: (e) => calls.logs.push(e),
    newId: () => 'req-1',
    ...overrides,
  };
  return { deps, calls, finalizedPromise, handler: createChatHandler(deps) };
}

function post(b: unknown = body, headers: Record<string, string> = {}) {
  return new Request('https://fn.test/functions/v1/chat', {
    method: 'POST',
    headers: {
      origin: 'https://app.test',
      authorization: 'Bearer good-token',
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.9',
      ...headers,
    },
    body: JSON.stringify(b),
  });
}

async function sse(res: Response) {
  return (await collect(readSse(res.body!))).map((e) => ({ event: e.event, data: JSON.parse(e.data) }));
}

describe('POST /chat lifecycle', () => {
  it('streams meta → status → deltas → sources → done and finalises once as completed', async () => {
    const { handler, calls } = setup();
    const res = await handler(post());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.test');
    const evs = await sse(res);
    expect(evs.map((e) => e.event)).toEqual(['meta', 'status', 'status', 'delta', 'delta', 'status', 'sources', 'done']);
    expect(evs[0].data).toMatchObject({ turn_id: 'turn-1', conversation_id: 'conv-1', assistant_message_id: 'am-1' });
    expect(evs[2].data).toEqual({ stage: 'streaming', sources_found: 2 });
    expect(evs[5].data).toEqual({ stage: 'saving' });
    // Only the supplied label the answer cites becomes a source; the fabricated [S7] is dropped.
    expect(evs[6].data.items).toEqual([{ label: 'S1', title: 'Declaring variables with let and const', url: null, section: 'JavaScript › Variables › let vs const' }]);
    expect(evs[7].data).toEqual({ turn_id: 'turn-1', status: 'completed', usage: { input_tokens: 900, output_tokens: 40 } });
    expect(calls.finalize).toHaveLength(1);
    expect(calls.finalize[0]).toMatchObject({ status: 'completed', sources: [{ label: 'S1', chunk_id: 'c-1' }], model: 'openai/gpt-oss-120b', providerRequestId: 'req_groq_1', retrievalCount: 2 });
    expect(calls.reserve[0]).toMatchObject({ userId: 'user-1', promptVersion: 'codebloom-tutor-v1', provider: 'groq' });
    expect(calls.reserve[0].ipBucket).toMatch(/^[0-9a-f]{64}$/);
    expect(calls.heartbeat).toEqual(expect.arrayContaining(['retrieving', 'streaming']));
  });

  it('never logs message content or raw IPs', async () => {
    const { handler, calls } = setup();
    await sse(await handler(post()));
    const logged = JSON.stringify(calls.logs);
    expect(logged).not.toContain('let instead of const');
    expect(logged).not.toContain('Use `const`');
    expect(logged).not.toContain('203.0.113.9');
  });

  it('replays a completed turn as JSON instead of calling the model again', async () => {
    const { handler, calls } = setup({
      reserveTurn: async () => ({
        status: 'replay',
        turn_id: 'turn-1',
        turn_status: 'completed',
        conversation_id: 'conv-1',
        assistant_message: { id: 'am-1', content: 'Stored answer', status: 'completed', mode: 'explain', language: 'javascript' },
        sources: [],
      }),
    });
    const res = await handler(post());
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toMatchObject({ replay: true, status: 'completed', assistant_message: { content: 'Stored answer' } });
    expect(calls.models).toEqual([]);
  });

  it('maps reservation errors to the public envelope with Retry-After', async () => {
    const { handler } = setup({ reserveTurn: async () => ({ status: 'error', code: 'RATE_LIMITED', http: 429, retry_after: 42 }) });
    const res = await handler(post());
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('42');
    expect(await res.json()).toMatchObject({ error: { code: 'RATE_LIMITED', retryable: true, request_id: 'req-1', retry_after: 42 } });
  });

  it('requires a verified session', async () => {
    const { handler } = setup();
    expect((await handler(post(body, { authorization: '' }))).status).toBe(401);
    const res = await handler(post(body, { authorization: 'Bearer forged' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: 'SESSION_REQUIRED' } });
  });

  it('rejects unknown fields and oversized messages before reserving', async () => {
    const { handler, calls } = setup();
    expect((await handler(post({ ...body, user_id: 'someone-else' }))).status).toBe(400);
    expect((await handler(post({ ...body, message: 'x'.repeat(12_001) }))).status).toBe(413);
    expect(calls.reserve).toHaveLength(0);
  });

  it('answers CORS preflight for allowed origins only', async () => {
    const { handler } = setup();
    const ok = await handler(new Request('https://fn.test/chat', { method: 'OPTIONS', headers: { origin: 'https://app.test' } }));
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-headers')).toContain('authorization');
    const bad = await handler(new Request('https://fn.test/chat', { method: 'OPTIONS', headers: { origin: 'https://evil.test' } }));
    expect(bad.status).toBe(403);
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('falls back to the second model when the first is rate limited before streaming', async () => {
    const { handler, calls } = setup({}, (model) => {
      if (model === 'openai/gpt-oss-120b') throw new ProviderHttpError(429, 10);
      return events(okStream);
    });
    const evs = await sse(await handler(post()));
    expect(calls.models).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
    expect(evs.at(-1)?.event).toBe('done');
    expect(calls.finalize[0]).toMatchObject({ status: 'completed', model: 'openai/gpt-oss-20b' });
  });

  it('reports MODEL_UNAVAILABLE (failed, nothing saved as completed) when the provider is down', async () => {
    const { handler, calls } = setup({}, () => {
      throw new ProviderHttpError(401);
    });
    const evs = await sse(await handler(post()));
    expect(evs.at(-1)).toMatchObject({ event: 'error', data: { code: 'MODEL_UNAVAILABLE', retryable: true, turn_id: 'turn-1' } });
    expect(calls.finalize[0]).toMatchObject({ status: 'failed', errorCode: 'MODEL_UNAVAILABLE' });
    expect(evs.some((e) => e.event === 'done')).toBe(false);
  });

  it('keeps partial text as incomplete when the stream breaks mid-way', async () => {
    const { handler, calls } = setup({}, () =>
      (async function* () {
        yield { type: 'delta', text: 'The loop runs one step' } as ProviderEvent;
        throw new ProviderStreamError('malformed');
      })(),
    );
    const evs = await sse(await handler(post()));
    expect(evs.at(-1)).toMatchObject({ event: 'error', data: { code: 'GENERATION_INTERRUPTED', status: 'incomplete' } });
    expect(calls.finalize[0]).toMatchObject({ status: 'incomplete', content: 'The loop runs one step', sources: [] });
  });

  it('stops and records an interrupted answer when the learner presses Stop', async () => {
    let polls = 0;
    const { handler, calls } = setup(
      {
        limits: { cancelPollMs: 0 },
        heartbeat: async (_id, status) => {
          if (status) return { exists: true, cancel: false };
          polls += 1;
          return { exists: true, cancel: polls >= 1 };
        },
      },
      () => events([{ type: 'delta', text: 'Partial' }, { type: 'delta', text: ' answer that never finishes' }]),
    );
    const evs = await sse(await handler(post()));
    expect(evs.at(-1)).toMatchObject({ event: 'error', data: { code: 'GENERATION_INTERRUPTED', status: 'interrupted' } });
    expect(calls.finalize[0]).toMatchObject({ status: 'interrupted', content: 'Partial' });
  });

  it('cannot resurrect a conversation deleted while the answer streamed', async () => {
    const { handler } = setup({ finalize: async () => ({ ok: false, code: 'NOT_FOUND' }) });
    const evs = await sse(await handler(post()));
    expect(evs.at(-1)).toMatchObject({ event: 'error', data: { code: 'NOT_FOUND' } });
    expect(evs.some((e) => e.event === 'done')).toBe(false);
  });

  it('never emits done when the answer could not be saved', async () => {
    let attempts = 0;
    const { handler } = setup({
      finalize: async () => {
        attempts += 1;
        throw new Error('db down');
      },
    });
    const evs = await sse(await handler(post()));
    expect(attempts).toBe(2);
    expect(evs.at(-1)).toMatchObject({ event: 'error', data: { code: 'SAVE_FAILED' } });
    expect(evs.some((e) => e.event === 'done')).toBe(false);
  });

  it('times out a stalled upstream (no progress) and keeps the partial text', async () => {
    const { handler, calls } = setup({ limits: { upstreamIdleTimeoutMs: 60 } }, (_m, signal) =>
      (async function* () {
        yield { type: 'delta', text: 'Starting…' } as ProviderEvent;
        await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
      })(),
    );
    const evs = await sse(await handler(post()));
    expect(evs.at(-1)).toMatchObject({ event: 'error', data: { code: 'GENERATION_TIMEOUT' } });
    expect(calls.finalize[0]).toMatchObject({ status: 'incomplete', content: 'Starting…' });
  });

  it('treats an empty answer as failed and a max-length cut as incomplete', async () => {
    const empty = setup({}, () => events([{ type: 'done', finishReason: 'stop', providerRequestId: null }]));
    await sse(await empty.handler(post()));
    expect(empty.calls.finalize[0].status).toBe('failed');

    const cut = setup({}, () => events([{ type: 'delta', text: 'Long answer' }, { type: 'done', finishReason: 'length', providerRequestId: null }]));
    const evs = await sse(await cut.handler(post()));
    expect(cut.calls.finalize[0].status).toBe('incomplete');
    expect(evs.at(-1)?.event).toBe('error');
  });

  it('keeps generating and saves the answer when the learner closes the tab', async () => {
    const { handler, calls, finalizedPromise } = setup({}, () =>
      (async function* () {
        yield { type: 'delta', text: 'First part. ' } as ProviderEvent;
        await new Promise((r) => setTimeout(r, 30));
        yield { type: 'delta', text: 'Second part.' } as ProviderEvent;
        yield { type: 'done', finishReason: 'stop', providerRequestId: 'r' } as ProviderEvent;
      })(),
    );
    const res = await handler(post());
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    await finalizedPromise;
    expect(calls.finalize[0]).toMatchObject({ status: 'completed', content: 'First part. Second part.' });
  });

  it('answers generally (no sources) when retrieval fails', async () => {
    const { handler, calls } = setup({ retrieve: async () => Promise.reject(new Error('embedding failed')) });
    const evs = await sse(await handler(post()));
    expect(evs.find((e) => e.event === 'status' && e.data.stage === 'streaming')?.data.sources_found).toBe(0);
    expect(evs.at(-1)?.event).toBe('done');
    expect(calls.finalize[0].sources).toEqual([]);
  });
});
