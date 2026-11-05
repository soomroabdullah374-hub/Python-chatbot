// POST /chat — runtime-agnostic orchestration (TRD "Edge Functions", API.md "POST /chat").
// validate → verify session → reserve turn (session/IP/global quotas, idempotency) → retrieve →
// stream from the provider over app-owned SSE → durable finalisation → done/error.
// Dependencies are injected so the whole lifecycle is unit-testable without Deno or a database.
import { LIMITS, PROMPT_VERSION, type Language, type Mode } from './constants.ts';
import { selectCitedSources } from './citations.ts';
import { corsHeaders } from './cors.ts';
import { AppError, ERROR_CATALOG, type ErrorCode, errorResponse } from './errors.ts';
import { clientIp, ipBucket, requestHash } from './hash.ts';
import { buildPrompt, type HistoryItem, type Preferences, type Reference } from './prompts.ts';
import { ProviderHttpError, type ProviderEvent } from './providers.ts';
import { encodeSse } from './sse.ts';
import { bearerToken, parseChatRequest, readBodyLimited } from './validation.ts';

export interface RetrievedChunk {
  chunk_id: string;
  title: string;
  section: string;
  source_url: string | null;
  source_version: string;
  heading: string | null;
  content: string;
  similarity: number;
}

export interface ReservedTurn {
  status: 'reserved';
  turn_id: string;
  conversation_id: string;
  conversation_title: string;
  user_message_id: string;
  assistant_message_id: string;
  history: HistoryItem[];
  preferences: Preferences;
}
export interface ReplayTurn {
  status: 'replay';
  turn_id: string;
  turn_status: string;
  conversation_id: string;
  assistant_message: { id: string; content: string; status: string; mode: Mode; language: Language } | null;
  sources: Array<{ label: string; title: string; url: string | null; section: string | null }>;
  usage?: { input_tokens: number | null; output_tokens: number | null };
}
export interface ReserveError {
  status: 'error';
  code: ErrorCode;
  http?: number;
  retry_after?: number;
  turn_id?: string;
}
export type ReserveResult = ReservedTurn | ReplayTurn | ReserveError;

export interface ReserveArgs {
  userId: string;
  conversationId: string | null;
  idempotencyKey: string;
  requestHash: string;
  message: string;
  mode: Mode;
  language: Language;
  ipBucket: string | null;
  promptVersion: string;
  model: string;
  provider: string;
}

export type FinalStatus = 'completed' | 'failed' | 'interrupted' | 'incomplete';

export interface FinalizeArgs {
  turnId: string;
  status: FinalStatus;
  content: string;
  sources: Array<{ label: string; chunk_id: string }>;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  model: string;
  providerRequestId: string | null;
  errorCode: string | null;
  retrievalCount: number;
}
export interface FinalizeResult {
  ok: boolean;
  status?: string;
  code?: string;
}

export interface ProviderRuntime {
  name: string;
  model: string;
  fallbackModel: string | null;
  stream(model: string, messages: ReturnType<typeof buildPrompt>, signal: AbortSignal): Promise<AsyncIterable<ProviderEvent>>;
}

export interface ChatDeps {
  allowedOrigins(): Promise<readonly string[]>;
  verifyUser(token: string): Promise<string | null>;
  ipSalt(): Promise<string | null>;
  provider(): Promise<ProviderRuntime | null>;
  reserveTurn(args: ReserveArgs): Promise<ReserveResult>;
  heartbeat(turnId: string, status?: 'retrieving' | 'streaming'): Promise<{ exists: boolean; cancel: boolean }>;
  finalize(args: FinalizeArgs): Promise<FinalizeResult>;
  retrieve(args: { token: string; query: string; language: Language }): Promise<RetrievedChunk[]>;
  log(entry: Record<string, unknown>): void;
  newId?: () => string;
  limits?: Partial<Record<keyof typeof LIMITS, number>>;
}

type Limits = Record<keyof typeof LIMITS, number>;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

const FALLBACK_STATUSES = new Set([404, 408, 413, 429, 500, 502, 503, 529]);

export function createChatHandler(deps: ChatDeps) {
  const limits: Limits = { ...LIMITS, ...(deps.limits ?? {}) } as Limits;
  const newId = deps.newId ?? (() => crypto.randomUUID());

  return async function handleChat(req: Request): Promise<Response> {
    const requestId = newId();
    const origin = req.headers.get('origin');
    let cors: Record<string, string> | null;
    try {
      cors = corsHeaders(origin, await deps.allowedOrigins());
    } catch {
      return errorResponse('INTERNAL_ERROR', requestId);
    }
    if (cors === null) return errorResponse('ACTION_FORBIDDEN', requestId);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const baseHeaders = { ...cors, 'X-Request-Id': requestId };
    if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', requestId, baseHeaders);

    try {
      const raw = await readBodyLimited(req, limits.maxRequestBodyBytes);
      const chat = parseChatRequest(raw);
      const token = bearerToken(req);
      if (!token) throw new AppError('SESSION_REQUIRED');
      const userId = await deps.verifyUser(token);
      if (!userId) throw new AppError('SESSION_REQUIRED');

      const provider = await deps.provider();
      if (!provider) throw new AppError('MODEL_UNAVAILABLE', { detail: 'no provider key configured' });

      const bucket = await ipBucket(clientIp(req.headers), await deps.ipSalt());
      const reserved = await deps.reserveTurn({
        userId,
        conversationId: chat.conversation_id,
        idempotencyKey: chat.idempotency_key,
        requestHash: await requestHash(chat),
        message: chat.message,
        mode: chat.mode,
        language: chat.programming_language,
        ipBucket: bucket,
        promptVersion: PROMPT_VERSION,
        model: provider.model,
        provider: provider.name,
      });

      if (reserved.status === 'error') {
        const code: ErrorCode = reserved.code in ERROR_CATALOG ? reserved.code : 'INTERNAL_ERROR';
        deps.log({ level: 'info', event: 'turn_rejected', request_id: requestId, code });
        return errorResponse(code, requestId, baseHeaders, reserved.retry_after);
      }
      if (reserved.status === 'replay') {
        return new Response(
          JSON.stringify({
            replay: true,
            turn_id: reserved.turn_id,
            status: reserved.turn_status,
            conversation_id: reserved.conversation_id,
            assistant_message: reserved.assistant_message,
            sources: reserved.sources,
            usage: reserved.usage ?? null,
          }),
          { status: 200, headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } },
        );
      }

      const state = { clientGone: false };
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          runTurn({ deps, limits, chat, token, requestId, reserved, provider, controller, state, ipBucketPrefix: bucket?.slice(0, 8) ?? null })
            .catch((err) => {
              deps.log({ level: 'error', event: 'turn_crashed', request_id: requestId, turn_id: reserved.turn_id, error: String(err?.name ?? 'Error') });
            })
            .finally(() => {
              try {
                controller.close();
              } catch {
                // already closed / cancelled
              }
            });
        },
        cancel() {
          state.clientGone = true;
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          ...baseHeaders,
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Accel-Buffering': 'no',
        },
      });
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(err.code, requestId, baseHeaders, err.retryAfter);
      }
      deps.log({ level: 'error', event: 'chat_failed', request_id: requestId, error: String((err as Error)?.name ?? 'Error') });
      return errorResponse('INTERNAL_ERROR', requestId, baseHeaders);
    }
  };
}

interface TurnContext {
  deps: ChatDeps;
  limits: Limits;
  chat: ReturnType<typeof parseChatRequest>;
  token: string;
  requestId: string;
  reserved: ReservedTurn;
  provider: ProviderRuntime;
  controller: ReadableStreamDefaultController<Uint8Array>;
  state: { clientGone: boolean };
  ipBucketPrefix: string | null;
}

async function runTurn(ctx: TurnContext): Promise<void> {
  const { deps, limits, chat, reserved, provider, controller, state } = ctx;
  const started = Date.now();
  const turnId = reserved.turn_id;
  const send = (event: string, data: unknown) => {
    if (state.clientGone) return;
    try {
      controller.enqueue(encodeSse(event, data));
    } catch {
      state.clientGone = true; // learner closed the tab; keep generating so the answer is saved
    }
  };
  const beat = async (status?: 'retrieving' | 'streaming') => {
    try {
      return await deps.heartbeat(turnId, status);
    } catch {
      return { exists: true, cancel: false };
    }
  };

  send('meta', {
    request_id: ctx.requestId,
    turn_id: turnId,
    conversation_id: reserved.conversation_id,
    assistant_message_id: reserved.assistant_message_id,
    user_message_id: reserved.user_message_id,
    conversation_title: reserved.conversation_title,
  });

  // ---- Retrieval (weak or failed retrieval falls back to a general answer) ----
  send('status', { stage: 'retrieving' });
  let hb = await beat('retrieving');
  let chunks: RetrievedChunk[] = [];
  try {
    chunks = (await withTimeout(
      deps.retrieve({ token: ctx.token, query: chat.message.slice(0, 1500), language: chat.programming_language }),
      limits.retrievalTimeoutMs,
    )).slice(0, limits.maxRetrievedChunks);
  } catch {
    deps.log({ level: 'warn', event: 'retrieval_failed', request_id: ctx.requestId, turn_id: turnId });
  }
  const references = chunks.map((c, i) => ({
    ...c,
    label: `S${i + 1}`,
  }));
  const promptRefs: Reference[] = references.map((r) => ({
    label: r.label,
    title: r.title,
    version: r.source_version,
    section: [r.section, r.heading].filter(Boolean).join(' › '),
    content: r.content,
  }));

  let text = '';
  let usage: { inputTokens: number | null; outputTokens: number | null; reasoningTokens: number | null } = {
    inputTokens: null,
    outputTokens: null,
    reasoningTokens: null,
  };
  let finishReason: string | null = null;
  let providerRequestId: string | null = null;
  let model = provider.model;
  let cancelled = !hb.exists || hb.cancel;
  let failure: unknown = null;
  const abortState: { reason: 'deadline' | 'idle' | 'cancel' | null } = { reason: null };
  let firstTokenAt: number | null = null;
  let tooLong = false;

  if (!cancelled) {
    send('status', { stage: 'streaming', sources_found: references.length });
    hb = await beat('streaming');
    cancelled = !hb.exists || hb.cancel;
  }

  if (!cancelled) {
    const messages = buildPrompt({
      mode: chat.mode,
      language: chat.programming_language,
      preferences: reserved.preferences ?? {},
      references: promptRefs,
      history: reserved.history ?? [],
      message: chat.message,
    });
    const abort = new AbortController();
    let lastProgress = Date.now();
    const deadline = setTimeout(() => {
      abortState.reason = 'deadline';
      abort.abort();
    }, limits.chatDeadlineMs);
    const watchdog = setInterval(() => {
      if (Date.now() - lastProgress > limits.upstreamIdleTimeoutMs) {
        abortState.reason = 'idle';
        abort.abort();
      }
    }, Math.min(1000, limits.upstreamIdleTimeoutMs));
    let lastPoll = Date.now();
    try {
      let events: AsyncIterable<ProviderEvent>;
      try {
        events = await provider.stream(model, messages, abort.signal);
      } catch (err) {
        if (
          err instanceof ProviderHttpError && FALLBACK_STATUSES.has(err.status) &&
          provider.fallbackModel && provider.fallbackModel !== model && !abort.signal.aborted
        ) {
          deps.log({ level: 'warn', event: 'provider_fallback', request_id: ctx.requestId, turn_id: turnId, status: err.status });
          model = provider.fallbackModel;
          events = await provider.stream(model, messages, abort.signal);
        } else {
          throw err;
        }
      }
      for await (const ev of events) {
        lastProgress = Date.now();
        if (ev.type === 'delta') {
          if (firstTokenAt === null) firstTokenAt = Date.now();
          text += ev.text;
          send('delta', { text: ev.text });
          if (text.length > limits.maxOutputChars) {
            tooLong = true;
            abort.abort();
            break;
          }
        } else if (ev.type === 'usage') {
          usage = { inputTokens: ev.inputTokens, outputTokens: ev.outputTokens, reasoningTokens: ev.reasoningTokens };
        } else if (ev.type === 'done') {
          finishReason = ev.finishReason;
          providerRequestId = ev.providerRequestId;
        }
        if (Date.now() - lastPoll >= limits.cancelPollMs) {
          lastPoll = Date.now();
          const probe = await beat();
          if (!probe.exists || probe.cancel) {
            cancelled = true;
            abortState.reason = 'cancel';
            abort.abort();
            break;
          }
        }
      }
    } catch (err) {
      if (!cancelled) failure = err;
    } finally {
      clearTimeout(deadline);
      clearInterval(watchdog);
    }
  }

  // ---- Terminal state (never mark incomplete or failed output as completed) ----
  let status: FinalStatus;
  let errorCode: ErrorCode | null = null;
  let retryAfter: number | undefined;
  if (cancelled) {
    status = 'interrupted';
    errorCode = 'GENERATION_INTERRUPTED';
  } else if (failure) {
    if (abortState.reason === 'deadline' || abortState.reason === 'idle') {
      status = text ? 'incomplete' : 'failed';
      errorCode = 'GENERATION_TIMEOUT';
    } else if (failure instanceof ProviderHttpError) {
      status = 'failed';
      errorCode = 'MODEL_UNAVAILABLE';
      retryAfter = failure.retryAfter;
    } else {
      status = text ? 'incomplete' : 'failed';
      errorCode = text ? 'GENERATION_INTERRUPTED' : 'MODEL_UNAVAILABLE';
    }
  } else if (tooLong || finishReason === 'length') {
    status = 'incomplete';
    errorCode = 'GENERATION_INTERRUPTED';
  } else if (!text.trim()) {
    status = 'failed';
    errorCode = 'MODEL_UNAVAILABLE';
  } else {
    status = 'completed';
  }

  const cited = status === 'completed' ? selectCitedSources(text, references) : [];
  send('status', { stage: 'saving' });
  let fin: FinalizeResult | null = null;
  const finalizeArgs: FinalizeArgs = {
    turnId,
    status,
    content: text,
    sources: cited.map((c) => ({ label: c.label, chunk_id: c.chunk_id })),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.reasoningTokens,
    model,
    providerRequestId,
    errorCode,
    retrievalCount: references.length,
  };
  for (let attempt = 0; attempt < 2 && fin === null; attempt += 1) {
    try {
      fin = await deps.finalize(finalizeArgs);
    } catch {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
    }
  }

  let finalStatus: string = status;
  let terminalError: ErrorCode | null = errorCode;
  if (!fin) {
    terminalError = 'SAVE_FAILED';
    finalStatus = 'unsaved';
  } else if (!fin.ok) {
    if (fin.code === 'NOT_FOUND') {
      terminalError = 'NOT_FOUND';
      finalStatus = 'deleted';
    } else if (fin.status === 'interrupted') {
      terminalError = 'GENERATION_INTERRUPTED';
      finalStatus = 'interrupted';
    } else if (fin.code === 'ALREADY_FINAL') {
      terminalError = terminalError ?? 'GENERATION_INTERRUPTED';
      finalStatus = fin.status ?? 'incomplete';
    } else if (fin.status && fin.status !== status) {
      finalStatus = fin.status;
      terminalError = terminalError ?? 'GENERATION_INTERRUPTED';
    }
  }

  if (finalStatus === 'completed' && !terminalError) {
    send('sources', {
      items: cited.map((c) => ({ label: c.label, title: c.title, url: c.source_url, section: [c.section, c.heading].filter(Boolean).join(' › ') })),
    });
    send('done', {
      turn_id: turnId,
      status: 'completed',
      usage: { input_tokens: usage.inputTokens, output_tokens: usage.outputTokens },
    });
  } else {
    const code = terminalError ?? 'INTERNAL_ERROR';
    send('error', {
      code,
      message: ERROR_CATALOG[code].message,
      retryable: ERROR_CATALOG[code].retryable,
      turn_id: turnId,
      status: finalStatus,
      ...(retryAfter !== undefined ? { retry_after: retryAfter } : {}),
    });
  }

  deps.log({
    level: 'info',
    event: 'turn_finished',
    request_id: ctx.requestId,
    turn_id: turnId,
    provider: provider.name,
    model,
    prompt_version: PROMPT_VERSION,
    status: finalStatus,
    error_code: terminalError,
    retrieval_count: references.length,
    cited_count: cited.length,
    first_token_ms: firstTokenAt ? firstTokenAt - started : null,
    total_ms: Date.now() - started,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    reasoning_tokens: usage.reasoningTokens,
    provider_request_id: providerRequestId,
    ip_bucket: ctx.ipBucketPrefix,
    client_gone: state.clientGone,
  });
}
