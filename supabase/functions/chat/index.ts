// Edge Function: POST /functions/v1/chat — streams one tutor turn (API.md).
/// <reference path="../_shared/edge-runtime.d.ts" />
import { createChatHandler, type RetrievedChunk } from '../_shared/chat-handler.ts';
import { EMBEDDING_VERSION, LIMITS } from '../_shared/constants.ts';
import { adminClient, jsonLog, loadRuntime, providerRuntime, serverEnv, userClient } from '../_shared/server.ts';

const env = serverEnv();
const admin = adminClient(env);
const minSimilarity = Number(Deno.env.get('RETRIEVAL_MIN_SIMILARITY') ?? '0.8');

// gte-small runs inside the Edge Runtime (384 dims, mean pooling + normalisation, RAG.md).
let embedder: Supabase.ai.Session | null = null;
async function embed(text: string): Promise<number[]> {
  embedder ??= new Supabase.ai.Session('gte-small');
  const out = await embedder.run(text, { mean_pool: true, normalize: true });
  return Array.from(out as ArrayLike<number>);
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.code ?? 'unknown'}`);
  return data as T;
}

const handler = createChatHandler({
  allowedOrigins: async () => (await loadRuntime(admin)).allowedOrigins,
  ipSalt: async () => (await loadRuntime(admin)).ipHashSalt,
  provider: async () => providerRuntime(await loadRuntime(admin)),
  verifyUser: async (token) => {
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  },
  reserveTurn: (a) =>
    rpc('reserve_turn', {
      p_user_id: a.userId,
      p_conversation_id: a.conversationId,
      p_idempotency_key: a.idempotencyKey,
      p_request_hash: a.requestHash,
      p_message: a.message,
      p_mode: a.mode,
      p_language: a.language,
      p_ip_bucket: a.ipBucket,
      p_prompt_version: a.promptVersion,
      p_model: a.model,
      p_provider: a.provider,
    }),
  heartbeat: (turnId, status) => rpc('turn_heartbeat', { p_turn_id: turnId, p_status: status ?? null }),
  finalize: (a) =>
    rpc('finalize_turn', {
      p_turn_id: a.turnId,
      p_status: a.status,
      p_content: a.content,
      p_sources: a.sources,
      p_input_tokens: a.inputTokens,
      p_output_tokens: a.outputTokens,
      p_reasoning_tokens: a.reasoningTokens,
      p_model: a.model,
      p_provider_request_id: a.providerRequestId,
      p_error_code: a.errorCode,
      p_retrieval_count: a.retrievalCount,
    }),
  retrieve: async ({ token, query, language }) => {
    const embedding = await embed(query);
    const { data, error } = await userClient(env, token).rpc('match_document_chunks', {
      query_embedding: JSON.stringify(embedding),
      match_count: LIMITS.maxRetrievedChunks,
      min_similarity: minSimilarity,
      language_filter: language,
      p_embedding_version: EMBEDDING_VERSION,
    });
    if (error) throw new Error('retrieval failed');
    return (data ?? []) as RetrievedChunk[];
  },
  log: jsonLog,
});

Deno.serve(handler);
