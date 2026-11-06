import { ERROR_CATALOG, type ErrorCode, isErrorCode } from '@shared/errors.ts';

/** A beginner-friendly, stable error the UI can branch on (API.md "Errors"). */
export class ClientError extends Error {
  readonly code: ErrorCode | 'NETWORK';
  readonly retryAfter?: number;
  readonly detail?: string;
  constructor(code: ErrorCode | 'NETWORK', opts: { message?: string; retryAfter?: number; detail?: string } = {}) {
    super(opts.message ?? (code === 'NETWORK' ? "We couldn't reach CodeBloom. Check your connection and try again." : ERROR_CATALOG[code].message));
    this.code = code;
    this.retryAfter = opts.retryAfter;
    this.detail = opts.detail;
  }
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
}

/** Map Data API errors (RLS, PTxyz raises from our RPCs, network) to ClientError. */
export function fromPostgrest(error: PostgrestLikeError | null | undefined): ClientError {
  if (!error) return new ClientError('INTERNAL_ERROR');
  const msg = error.message ?? '';
  if (isErrorCode(msg)) return new ClientError(msg, { detail: error.details ?? undefined });
  if (error.code === 'PGRST301' || error.code === '42501' || /JWT|token/i.test(msg)) return new ClientError('SESSION_REQUIRED');
  if (/fetch|network|Failed to/i.test(msg)) return new ClientError('NETWORK');
  return new ClientError('INTERNAL_ERROR');
}

export function describeRetry(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return 'in a moment';
  if (seconds < 90) return `in ${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `in about ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? '' : 's'}`;
}
