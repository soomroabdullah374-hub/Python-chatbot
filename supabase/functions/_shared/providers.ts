// Model provider adapters. Both are normalised into ProviderEvent so the chat handler never sees
// provider-specific shapes. Keys are passed in by the server runtime; nothing here reads env.
//   groq: OpenAI-compatible Chat Completions streaming (https://api.groq.com/openai/v1)
//   xai:  Responses API streaming with store:false (TRD "xAI integration")
import type { ChatMessage } from './prompts.ts';
import { readSse } from './sse.ts';

export type ProviderName = 'groq' | 'xai';

export type ProviderEvent =
  | { type: 'delta'; text: string }
  | { type: 'usage'; inputTokens: number | null; outputTokens: number | null; reasoningTokens: number | null }
  | { type: 'done'; finishReason: string | null; providerRequestId: string | null };

export interface ProviderSettings {
  name: ProviderName;
  apiKey: string;
  baseUrl?: string;
  maxOutputTokens: number;
  temperature?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

/** The provider rejected the request before any text streamed (safe to classify, no partial output). */
export class ProviderHttpError extends Error {
  readonly status: number;
  readonly retryAfter?: number;
  constructor(status: number, retryAfter?: number) {
    super(`provider http ${status}`);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/** The stream started but broke: malformed event, provider error event, or early end. */
export class ProviderStreamError extends Error {
  readonly kind: 'malformed' | 'provider_error' | 'truncated';
  constructor(kind: 'malformed' | 'provider_error' | 'truncated') {
    super(`provider stream ${kind}`);
    this.kind = kind;
  }
}

export const DEFAULT_BASE_URL: Record<ProviderName, string> = {
  groq: 'https://api.groq.com/openai/v1',
  xai: 'https://api.x.ai/v1',
};

export function buildProviderRequest(settings: ProviderSettings, model: string, messages: ChatMessage[]): { url: string; body: Record<string, unknown> } {
  const base = settings.baseUrl ?? DEFAULT_BASE_URL[settings.name];
  if (settings.name === 'groq') {
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      max_completion_tokens: settings.maxOutputTokens,
      temperature: settings.temperature ?? 0.4,
    };
    if (model.startsWith('openai/gpt-oss')) {
      body.reasoning_effort = settings.reasoningEffort ?? 'low';
      body.include_reasoning = false;
    }
    return { url: `${base}/chat/completions`, body };
  }
  return {
    url: `${base}/responses`,
    body: {
      model,
      store: false,
      stream: true,
      max_output_tokens: settings.maxOutputTokens,
      input: messages.map((m) => ({ role: m.role, content: m.content })),
    },
  };
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return Math.min(Math.ceil(n), 3600);
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, Math.min(3600, Math.ceil((date - Date.now()) / 1000)));
  return undefined;
}

export async function openProviderStream(
  settings: ProviderSettings,
  model: string,
  messages: ChatMessage[],
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<AsyncGenerator<ProviderEvent>> {
  const { url, body } = buildProviderRequest(settings, model, messages);
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    // Never forward provider bodies; drain and classify by status only.
    await res.body?.cancel().catch(() => undefined);
    throw new ProviderHttpError(res.status, parseRetryAfter(res.headers.get('retry-after')));
  }
  const requestId = res.headers.get('x-request-id');
  return settings.name === 'groq'
    ? parseChatCompletionsStream(res.body, signal, requestId)
    : parseResponsesStream(res.body, signal, requestId);
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export async function* parseChatCompletionsStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
  headerRequestId: string | null = null,
): AsyncGenerator<ProviderEvent> {
  let finishReason: string | null = null;
  let requestId = headerRequestId;
  let sawDone = false;
  let usageSent = false;
  for await (const ev of readSse(body, signal)) {
    if (ev.data === '[DONE]') {
      sawDone = true;
      break;
    }
    let obj: Record<string, any>;
    try {
      obj = JSON.parse(ev.data);
    } catch {
      throw new ProviderStreamError('malformed');
    }
    if (obj.error) throw new ProviderStreamError('provider_error');
    requestId = obj.x_groq?.id ?? requestId;
    const choice = Array.isArray(obj.choices) ? obj.choices[0] : undefined;
    const text = choice?.delta?.content;
    if (typeof text === 'string' && text.length) yield { type: 'delta', text };
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    const usage = obj.usage ?? obj.x_groq?.usage;
    if (usage && !usageSent) {
      usageSent = true;
      const completion = num(usage.completion_tokens);
      const reasoning = num(usage.completion_tokens_details?.reasoning_tokens) ?? 0;
      yield {
        type: 'usage',
        inputTokens: num(usage.prompt_tokens),
        outputTokens: completion === null ? null : Math.max(0, completion - reasoning),
        reasoningTokens: completion === null ? null : reasoning,
      };
    }
  }
  if (!sawDone && !finishReason) throw new ProviderStreamError('truncated');
  yield { type: 'done', finishReason, providerRequestId: requestId };
}

export async function* parseResponsesStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
  headerRequestId: string | null = null,
): AsyncGenerator<ProviderEvent> {
  let finished = false;
  for await (const ev of readSse(body, signal)) {
    if (ev.data === '[DONE]') break;
    let obj: Record<string, any>;
    try {
      obj = JSON.parse(ev.data);
    } catch {
      throw new ProviderStreamError('malformed');
    }
    const type: string = obj.type ?? ev.event;
    if (type === 'response.output_text.delta') {
      if (typeof obj.delta === 'string' && obj.delta.length) yield { type: 'delta', text: obj.delta };
    } else if (type === 'response.completed' || type === 'response.incomplete') {
      const r = obj.response ?? {};
      const u = r.usage ?? {};
      yield {
        type: 'usage',
        inputTokens: num(u.input_tokens),
        outputTokens: num(u.output_tokens),
        reasoningTokens: num(u.output_tokens_details?.reasoning_tokens),
      };
      finished = true;
      yield {
        type: 'done',
        finishReason: type === 'response.incomplete' ? 'length' : 'stop',
        providerRequestId: r.id ?? headerRequestId,
      };
      return;
    } else if (type === 'response.failed' || type === 'error') {
      throw new ProviderStreamError('provider_error');
    }
    // Other event types (created, in_progress, content_part.*) carry no learner-visible text.
  }
  if (!finished) throw new ProviderStreamError('truncated');
}
