import { describe, expect, it } from 'vitest';
import {
  buildProviderRequest,
  openProviderStream,
  parseChatCompletionsStream,
  parseResponsesStream,
  ProviderHttpError,
  ProviderStreamError,
  type ProviderEvent,
} from '@shared/providers.ts';
import { chunkedStream, collect, fixture } from './helpers';

const messages = [
  { role: 'system' as const, content: 'You are CodeBloom.' },
  { role: 'user' as const, content: 'What is a variable?' },
];

function textOf(events: ProviderEvent[]): string {
  return events.filter((e) => e.type === 'delta').map((e) => (e as { text: string }).text).join('');
}

describe('Groq chat-completions adapter (recorded fixture)', () => {
  it('normalises deltas, usage and the provider request id, across any chunking', async () => {
    for (const size of [1, 5, 33, 4096]) {
      const events = await collect(parseChatCompletionsStream(chunkedStream(fixture('groq-chat-completions.sse'), size)));
      expect(textOf(events)).toBe(
        '## Answer\n\nA Python variable is a named reference that stores a value—like a cup labeled “café” that holds whatever coffee you pour into it.',
      );
      const usage = events.filter((e) => e.type === 'usage');
      expect(usage).toEqual([{ type: 'usage', inputTokens: 104, outputTokens: 41, reasoningTokens: 16 }]);
      expect(events.at(-1)).toEqual({ type: 'done', finishReason: 'stop', providerRequestId: 'req_01m6pmhr61ekq9t1bp8gg6kr9q' });
    }
  });

  it('fails safely on malformed events', async () => {
    const stream = chunkedStream('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: {not json\n\n', 8);
    await expect(collect(parseChatCompletionsStream(stream))).rejects.toBeInstanceOf(ProviderStreamError);
  });

  it('treats a stream that ends without [DONE] or finish_reason as truncated', async () => {
    const stream = chunkedStream('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n', 8);
    await expect(collect(parseChatCompletionsStream(stream))).rejects.toMatchObject({ kind: 'truncated' });
  });

  it('surfaces provider error events as stream errors', async () => {
    const stream = chunkedStream('data: {"error":{"message":"overloaded"}}\n\n', 8);
    await expect(collect(parseChatCompletionsStream(stream))).rejects.toMatchObject({ kind: 'provider_error' });
  });

  it('asks gpt-oss for low reasoning effort and no reasoning text', () => {
    const { url, body } = buildProviderRequest({ name: 'groq', apiKey: 'k', maxOutputTokens: 1800 }, 'openai/gpt-oss-120b', messages);
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(body).toMatchObject({
      model: 'openai/gpt-oss-120b',
      stream: true,
      stream_options: { include_usage: true },
      max_completion_tokens: 1800,
      reasoning_effort: 'low',
      include_reasoning: false,
    });
    expect(body).not.toHaveProperty('tools');
  });
});

describe('xAI Responses adapter', () => {
  it('sends store:false with application-managed history and no tools', () => {
    const { url, body } = buildProviderRequest({ name: 'xai', apiKey: 'k', maxOutputTokens: 1800 }, 'grok-x', messages);
    expect(url).toBe('https://api.x.ai/v1/responses');
    expect(body).toEqual({
      model: 'grok-x',
      store: false,
      stream: true,
      max_output_tokens: 1800,
      input: messages,
    });
  });

  it('parses output_text deltas and completion usage', async () => {
    const events = await collect(parseResponsesStream(chunkedStream(fixture('xai-responses.sse'), 7)));
    expect(textOf(events)).toBe('## Short answer\n\nUse `const` by default [S1].');
    expect(events.at(-2)).toEqual({ type: 'usage', inputTokens: 812, outputTokens: 40, reasoningTokens: 0 });
    expect(events.at(-1)).toEqual({ type: 'done', finishReason: 'stop', providerRequestId: 'resp_fixture_1' });
  });

  it('marks incomplete responses with finishReason=length', async () => {
    const body = 'data: {"type":"response.output_text.delta","delta":"Hi"}\n\ndata: {"type":"response.incomplete","response":{"id":"r","usage":{"input_tokens":1,"output_tokens":2}}}\n\n';
    const events = await collect(parseResponsesStream(chunkedStream(body, 5)));
    expect(events.at(-1)).toMatchObject({ type: 'done', finishReason: 'length' });
  });

  it('fails on response.failed', async () => {
    const body = 'data: {"type":"response.failed","response":{"id":"r"}}\n\n';
    await expect(collect(parseResponsesStream(chunkedStream(body, 5)))).rejects.toMatchObject({ kind: 'provider_error' });
  });
});

describe('openProviderStream', () => {
  it('turns provider HTTP errors into ProviderHttpError without exposing the body', async () => {
    const fakeFetch = async () =>
      new Response('{"error":{"message":"secret internal detail"}}', { status: 429, headers: { 'retry-after': '7' } });
    const err = await openProviderStream(
      { name: 'groq', apiKey: 'k', maxOutputTokens: 10 },
      'm',
      messages,
      new AbortController().signal,
      fakeFetch as unknown as typeof fetch,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderHttpError);
    expect(err.status).toBe(429);
    expect(err.retryAfter).toBe(7);
    expect(String(err.message)).not.toContain('secret');
  });

  it('sends the bearer key only to the provider endpoint', async () => {
    let seen: { url: string; auth: string | null } | null = null;
    const fakeFetch = async (url: string, init: RequestInit) => {
      seen = { url, auth: new Headers(init.headers).get('authorization') };
      return new Response(chunkedStream(fixture('groq-chat-completions.sse'), 100), { status: 200 });
    };
    const events = await collect(
      await openProviderStream({ name: 'groq', apiKey: 'gsk_test', maxOutputTokens: 10 }, 'openai/gpt-oss-120b', messages, new AbortController().signal, fakeFetch as unknown as typeof fetch),
    );
    expect(seen).toEqual({ url: 'https://api.groq.com/openai/v1/chat/completions', auth: 'Bearer gsk_test' });
    expect(events.at(-1)).toMatchObject({ type: 'done' });
  });
});
