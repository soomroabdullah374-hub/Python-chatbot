// Edge Function: POST /functions/v1/data-delete — "Delete all my data" (IDENTITY.md, SECURITY.md).
// record job → block generation + cancel active turns → delete app rows → delete the anonymous
// auth user (admin API) → record completion. The client then starts a fresh anonymous session.
import { corsHeaders } from '../_shared/cors.ts';
import { AppError, errorResponse } from '../_shared/errors.ts';
import { adminClient, jsonLog, loadRuntime, serverEnv } from '../_shared/server.ts';
import { bearerToken, DataDeleteRequestSchema, readBodyLimited } from '../_shared/validation.ts';

const env = serverEnv();
const admin = adminClient(env);

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  let cors: Record<string, string> | null;
  try {
    cors = corsHeaders(req.headers.get('origin'), (await loadRuntime(admin)).allowedOrigins);
  } catch {
    return errorResponse('INTERNAL_ERROR', requestId);
  }
  if (cors === null) return errorResponse('ACTION_FORBIDDEN', requestId);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const headers = { ...cors, 'X-Request-Id': requestId };
  if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', requestId, headers);

  try {
    const raw = await readBodyLimited(req, 1024);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AppError('INVALID_REQUEST');
    }
    if (!DataDeleteRequestSchema.safeParse(body).success) throw new AppError('INVALID_REQUEST');

    const token = bearerToken(req);
    if (!token) throw new AppError('SESSION_REQUIRED');
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) throw new AppError('SESSION_REQUIRED');
    const userId = auth.user.id;

    const { data: jobId, error: jobError } = await admin.rpc('begin_data_deletion', { p_user_id: userId });
    if (jobError || !jobId) throw new Error('begin_data_deletion failed');

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    await admin.rpc('complete_data_deletion', {
      p_job_id: jobId,
      p_ok: !deleteError,
      p_error_code: deleteError ? 'AUTH_DELETE_FAILED' : null,
    });
    jsonLog({ level: deleteError ? 'error' : 'info', event: 'data_deleted', request_id: requestId, job_id: jobId, ok: !deleteError });
    if (deleteError) return errorResponse('INTERNAL_ERROR', requestId, headers);

    return new Response(JSON.stringify({ job_id: jobId, status: 'completed' }), {
      status: 202,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, requestId, headers, err.retryAfter);
    jsonLog({ level: 'error', event: 'data_delete_failed', request_id: requestId });
    return errorResponse('INTERNAL_ERROR', requestId, headers);
  }
});
