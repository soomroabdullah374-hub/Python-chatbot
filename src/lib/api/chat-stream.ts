'use client';
// Client for POST /chat (API.md): application-owned SSE over a POST fetch (not EventSource).
// Branches on Content-Type: JSON = replay or error envelope, text/event-stream = live turn.
import { type ErrorCode, isErrorCode } from '@shared/errors.ts';
import { readSse } from '@shared/sse.ts';
import { env, functionsUrl } from '@/lib/env';
import type { Language, Mode, Source } from '@/lib/types';

export interface ChatRequestBody {
  conversation_id: string | null;
  idempotency_key: string;
  message: string;
  mode: Mode;
  programming_language: Language;
}

export interface MetaEvent {
  request_id: string;
  turn_id: string;
  conversation_id: string;
  assistant_message_id: string;
  user_message_id: string;
  conversation_title: string;
}
export interface StatusEvent {
  stage: 'retrieving' | 'streaming' | 'saving';
  sources_found?: number;
}
export interface TerminalError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  turn_id?: string;
  status?: string;
  retry_after?: number;
}

export interface StreamHandlers {
  onMeta(e: MetaEvent): void;
  onStatus(e: StatusEvent): void;
  onDelta(text: string): void;
  onSources(items: Source[]): void;
  onDone(e: { turn_id: string; status: 'completed' }): void;
  onError(e: TerminalError): void;
}

export type ChatOutcome =
  | { kind: 'streamed'; terminal: 'done' | 'error' | 'eof' }
  | { kind: 'replay'; data: ReplayPayload }
  | { kind: 'rejected'; error: TerminalError; httpStatus: number }
  | { kind: 'aborted' }
  | { kind: 'network' };

export interface ReplayPayload {
  turn_id: string;
  status: string;
  conversation_id: string;
  assistant_message: { id: string; content: string; status: string } | null;
  sources: Source[];
}

export async function streamChat(
  body: ChatRequestBody,
  token: string,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<ChatOutcome> {
  let res: Response;
  try {
    res = await fetch(`${functionsUrl}/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.supabaseKey,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
      cache: 'no-store',
    });
  } catch {
    return signal.aborted ? { kind: 'aborted' } : { kind: 'network' };
  }

  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('text/event-stream')) {
    const json = await res.json().catch(() => null);
    if (res.ok && json?.replay) return { kind: 'replay', data: json as ReplayPayload };
    const err = json?.error;
    const code: ErrorCode = isErrorCode(err?.code) ? err.code : 'INTERNAL_ERROR';
    const retryAfter = Number(res.headers.get('retry-after') ?? err?.retry_after ?? NaN);
    return {
      kind: 'rejected',
      httpStatus: res.status,
      error: {
        code,
        message: typeof err?.message === 'string' ? err.message : 'Something went wrong.',
        retryable: Boolean(err?.retryable),
        retry_after: Number.isFinite(retryAfter) ? retryAfter : undefined,
      },
    };
  }

  let terminal: 'done' | 'error' | 'eof' = 'eof';
  try {
    for await (const ev of readSse(res.body!, signal)) {
      let data: any;
      try {
        data = JSON.parse(ev.data);
      } catch {
        continue; // unknown/malformed events fail safely
      }
      switch (ev.event) {
        case 'meta':
          handlers.onMeta(data);
          break;
        case 'status':
          handlers.onStatus(data);
          break;
        case 'delta':
          if (typeof data?.text === 'string') handlers.onDelta(data.text);
          break;
        case 'sources':
          handlers.onSources(Array.isArray(data?.items) ? data.items : []);
          break;
        case 'done':
          terminal = 'done';
          handlers.onDone(data);
          break;
        case 'error':
          terminal = 'error';
          handlers.onError(data);
          break;
        default:
          break;
      }
    }
  } catch {
    if (signal.aborted) return { kind: 'aborted' };
    return { kind: 'network' };
  }
  return { kind: 'streamed', terminal };
}
