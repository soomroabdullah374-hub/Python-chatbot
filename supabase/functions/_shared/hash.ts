// Hashing helpers (WebCrypto: works in Deno, Node 20+ and browsers).
import type { ChatRequest } from './validation.ts';

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

export async function hmacSha256Hex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

/** Stable hash of the fields that define a turn; used with the idempotency key. */
export function requestHash(req: ChatRequest): Promise<string> {
  const canonical = JSON.stringify([
    req.conversation_id ?? null,
    req.mode,
    req.programming_language,
    req.message,
  ]);
  return sha256Hex(canonical);
}

const IPV4 = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f:]{2,45}$/i;

/**
 * Client IP from the platform's forwarding headers. Supabase Edge Functions sit behind the
 * platform proxy, which sets x-forwarded-for; when several hops are present the platform-added
 * (right-most) entry is used because left-most entries can be supplied by the client.
 */
export function clientIp(headers: Headers): string | null {
  const candidates: string[] = [];
  const cf = headers.get('cf-connecting-ip');
  if (cf) candidates.push(cf.trim());
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length) candidates.push(parts[parts.length - 1]);
  }
  const real = headers.get('x-real-ip');
  if (real) candidates.push(real.trim());
  for (const c of candidates) {
    const ip = c.replace(/^\[|\]$/g, '').replace(/^::ffff:/i, '');
    if (IPV4.test(ip) || (ip.includes(':') && IPV6.test(ip))) return ip.toLowerCase();
  }
  return null;
}

/** HMAC bucket for an IP. IPv6 addresses are bucketed by /64 so one host can't rotate addresses. */
export async function ipBucket(ip: string | null, salt: string | null | undefined): Promise<string | null> {
  if (!ip || !salt) return null;
  let key = ip;
  if (ip.includes(':')) {
    const groups = expandIpv6(ip);
    key = groups ? groups.slice(0, 4).join(':') + '::/64' : ip;
  }
  return hmacSha256Hex(salt, `ip-bucket-v1|${key}`);
}

function expandIpv6(ip: string): string[] | null {
  const [head, tail] = ip.split('::');
  if (ip.split('::').length > 2) return null;
  const h = head ? head.split(':') : [];
  const t = tail !== undefined ? (tail ? tail.split(':') : []) : [];
  const missing = 8 - h.length - t.length;
  if (tail === undefined && h.length !== 8) return null;
  if (missing < 0) return null;
  const groups = [...h, ...Array(tail === undefined ? 0 : missing).fill('0'), ...t];
  return groups.map((g) => g.padStart(4, '0').toLowerCase());
}
