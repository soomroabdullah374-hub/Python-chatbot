// Stable public error codes (API.md "Errors"). Messages are beginner-friendly and never include
// provider bodies, SQL, IPs, credentials or stack traces.

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'SESSION_REQUIRED'
  | 'ACTION_FORBIDDEN'
  | 'NOT_FOUND'
  | 'TURN_IN_PROGRESS'
  | 'IDEMPOTENCY_MISMATCH'
  | 'INPUT_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'DAILY_LIMIT_REACHED'
  | 'NETWORK_LIMIT_REACHED'
  | 'MODEL_UNAVAILABLE'
  | 'BUDGET_PAUSED'
  | 'GENERATION_PAUSED'
  | 'GENERATION_TIMEOUT'
  | 'GENERATION_INTERRUPTED'
  | 'SAVE_FAILED'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL_ERROR';

interface ErrorSpec {
  status: number;
  retryable: boolean;
  message: string;
}

export const ERROR_CATALOG: Record<ErrorCode, ErrorSpec> = {
  INVALID_REQUEST: { status: 400, retryable: false, message: "Something about that request wasn't quite right. Please check your message and try again." },
  SESSION_REQUIRED: { status: 401, retryable: true, message: "We couldn't restore your private session. Reconnecting starts a fresh one." },
  ACTION_FORBIDDEN: { status: 403, retryable: false, message: "That action isn't allowed." },
  NOT_FOUND: { status: 404, retryable: false, message: "We couldn't find that conversation. It may have been deleted." },
  TURN_IN_PROGRESS: { status: 409, retryable: true, message: 'CodeBloom is still writing the previous answer. Wait for it to finish or stop it first.' },
  IDEMPOTENCY_MISMATCH: { status: 409, retryable: false, message: 'That request was already used for a different message. Please send it again.' },
  INPUT_TOO_LARGE: { status: 413, retryable: false, message: 'That message is too long. Try a shorter question or a smaller piece of code.' },
  RATE_LIMITED: { status: 429, retryable: true, message: "You're sending messages quickly. Your draft is saved — try again in a moment." },
  DAILY_LIMIT_REACHED: { status: 429, retryable: true, message: "You've reached today's limit. Your draft is saved — you can send again tomorrow." },
  NETWORK_LIMIT_REACHED: { status: 429, retryable: true, message: 'Your network has reached its limit for today. Your draft is saved.' },
  MODEL_UNAVAILABLE: { status: 502, retryable: true, message: "The tutor isn't responding right now. This isn't anything you did — your message is kept." },
  BUDGET_PAUSED: { status: 503, retryable: true, message: 'CodeBloom has paused new answers for today to stay within its budget. Please try again later.' },
  GENERATION_PAUSED: { status: 503, retryable: true, message: 'New answers are paused for a short while. Please try again soon.' },
  GENERATION_TIMEOUT: { status: 504, retryable: true, message: 'The answer took too long and was stopped. The partial text is kept; you can retry.' },
  GENERATION_INTERRUPTED: { status: 502, retryable: true, message: 'The answer was interrupted. The partial text is kept, but it won’t be used as context.' },
  SAVE_FAILED: { status: 500, retryable: true, message: "Answer received, but could not be saved. It won't appear in your history after you leave." },
  METHOD_NOT_ALLOWED: { status: 405, retryable: false, message: 'Method not allowed.' },
  INTERNAL_ERROR: { status: 500, retryable: true, message: 'Something went wrong on our side. Please try again.' },
};

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && value in ERROR_CATALOG;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly retryAfter?: number;
  constructor(code: ErrorCode, opts: { retryAfter?: number; detail?: string } = {}) {
    super(opts.detail ?? code);
    this.code = code;
    this.retryAfter = opts.retryAfter;
  }
  get status(): number {
    return ERROR_CATALOG[this.code].status;
  }
}

export interface ErrorEnvelope {
  error: { code: ErrorCode; message: string; retryable: boolean; request_id: string; retry_after?: number };
}

export function errorEnvelope(code: ErrorCode, requestId: string, retryAfter?: number): ErrorEnvelope {
  const spec = ERROR_CATALOG[code];
  return {
    error: {
      code,
      message: spec.message,
      retryable: spec.retryable,
      request_id: requestId,
      ...(retryAfter !== undefined ? { retry_after: retryAfter } : {}),
    },
  };
}

export function errorResponse(
  code: ErrorCode,
  requestId: string,
  headers: Record<string, string> = {},
  retryAfter?: number,
  status?: number,
): Response {
  const h: Record<string, string> = {
    ...headers,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  if (retryAfter !== undefined) h['Retry-After'] = String(retryAfter);
  return new Response(JSON.stringify(errorEnvelope(code, requestId, retryAfter)), {
    status: status ?? ERROR_CATALOG[code].status,
    headers: h,
  });
}
