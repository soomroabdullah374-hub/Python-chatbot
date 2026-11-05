// Trust-boundary validation (AGENTS.md "validate at trust boundaries"). Unknown fields are rejected.
import { z } from 'zod';
import { LANGUAGES, LIMITS, MODES } from './constants.ts';
import { AppError } from './errors.ts';

export const ChatRequestSchema = z.strictObject({
  conversation_id: z.uuid().nullable(),
  idempotency_key: z.uuid(),
  message: z.string(),
  mode: z.enum(MODES),
  programming_language: z.enum(LANGUAGES),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const DataDeleteRequestSchema = z.strictObject({
  confirm: z.literal('DELETE_ALL_MY_DATA'),
});

export const IngestRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('embed_pending'), limit: z.number().int().min(1).max(32).optional() }),
  z.strictObject({ action: z.literal('status') }),
]);
export type IngestRequest = z.infer<typeof IngestRequestSchema>;

/** Parse + validate a chat request body (already size-limited). Throws AppError. */
export function parseChatRequest(raw: string): ChatRequest {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AppError('INVALID_REQUEST', { detail: 'body is not JSON' });
  }
  const parsed = ChatRequestSchema.safeParse(json);
  if (!parsed.success) throw new AppError('INVALID_REQUEST', { detail: 'schema' });
  const message = parsed.data.message;
  if (message.trim().length === 0) throw new AppError('INVALID_REQUEST', { detail: 'empty message' });
  if (message.length > LIMITS.maxMessageChars) throw new AppError('INPUT_TOO_LARGE');
  return parsed.data;
}

/** Read a request body with a hard byte cap (Content-Length is advisory only). */
export async function readBodyLimited(req: Request, maxBytes: number): Promise<string> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) throw new AppError('INPUT_TOO_LARGE');
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new AppError('INPUT_TOO_LARGE');
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(all);
  } catch {
    throw new AppError('INVALID_REQUEST', { detail: 'body is not UTF-8' });
  }
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/.exec(header.trim());
  return m ? m[1] : null;
}
