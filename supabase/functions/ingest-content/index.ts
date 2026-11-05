// Edge Function: POST /functions/v1/ingest-content — operator-only (never browser-callable).
// Embeds draft lesson chunks with gte-small and publishes documents whose chunks are all embedded.
// Authorisation: Bearer <operator token> checked against Supabase Vault (verify_operator_token).
/// <reference path="../_shared/edge-runtime.d.ts" />
import { EMBEDDING_MODEL, EMBEDDING_VERSION } from '../_shared/constants.ts';
import { AppError, errorResponse } from '../_shared/errors.ts';
import { adminClient, jsonLog, serverEnv } from '../_shared/server.ts';
import { bearerToken, IngestRequestSchema, readBodyLimited } from '../_shared/validation.ts';

const env = serverEnv();
const admin = adminClient(env);
let embedder: Supabase.ai.Session | null = null;

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const headers = { 'X-Request-Id': requestId };
  if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', requestId, headers);
  try {
    const token = bearerToken(req);
    if (!token) throw new AppError('SESSION_REQUIRED');
    const { data: allowed, error: verifyError } = await admin.rpc('verify_operator_token', { p_token: token });
    if (verifyError || allowed !== true) throw new AppError('ACTION_FORBIDDEN');

    const raw = await readBodyLimited(req, 2048);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new AppError('INVALID_REQUEST');
    }
    const parsed = IngestRequestSchema.safeParse(json);
    if (!parsed.success) throw new AppError('INVALID_REQUEST');

    const countPending = async () => {
      const { count } = await admin.from('document_chunks').select('id', { count: 'exact', head: true }).is('embedding', null);
      return count ?? 0;
    };

    if (parsed.data.action === 'status') {
      const { data: docs } = await admin.from('documents').select('status');
      const byStatus: Record<string, number> = {};
      for (const d of docs ?? []) byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
      return Response.json({ documents: byStatus, pending_chunks: await countPending() }, { headers });
    }

    const limit = parsed.data.limit ?? 16;
    const { data: chunks, error } = await admin
      .from('document_chunks')
      .select('id, heading, content')
      .is('embedding', null)
      .order('id')
      .limit(limit);
    if (error) throw new Error('select failed');

    embedder ??= new Supabase.ai.Session('gte-small');
    let embedded = 0;
    for (const c of chunks ?? []) {
      // Same preprocessing as queries (RAG.md): plain text, mean pooled, normalised.
      const input = [c.heading, c.content].filter(Boolean).join('\n');
      const vector = Array.from((await embedder.run(input, { mean_pool: true, normalize: true })) as ArrayLike<number>);
      const { error: upErr } = await admin
        .from('document_chunks')
        .update({ embedding: JSON.stringify(vector), embedding_version: EMBEDDING_VERSION })
        .eq('id', c.id);
      if (upErr) throw new Error('update failed');
      embedded += 1;
    }
    const { data: published } = await admin.rpc('publish_ready_documents', {
      p_embedding_model: EMBEDDING_MODEL,
      p_embedding_version: EMBEDDING_VERSION,
    });
    const remaining = await countPending();
    jsonLog({ level: 'info', event: 'ingest_batch', request_id: requestId, embedded, published, remaining });
    return Response.json({ embedded, published: published ?? 0, remaining }, { headers });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, requestId, headers);
    jsonLog({ level: 'error', event: 'ingest_failed', request_id: requestId });
    return errorResponse('INTERNAL_ERROR', requestId, headers);
  }
});
