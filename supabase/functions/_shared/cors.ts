// Explicit-origin CORS (SECURITY.md "CORS"): no wildcard; CORS is not authorization.

export const CORS_ALLOWED_HEADERS = 'authorization, apikey, content-type, x-client-info';

/**
 * Returns headers for an allowed browser origin, `{}` for non-browser callers (no Origin header),
 * or null when the origin is not on the allowlist.
 */
export function corsHeaders(origin: string | null, allowed: readonly string[]): Record<string, string> | null {
  if (!origin) return {};
  if (!allowed.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': CORS_ALLOWED_HEADERS,
    'Access-Control-Expose-Headers': 'x-request-id, retry-after',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
