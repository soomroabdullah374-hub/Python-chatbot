# CodeBloom API Contract

Base: `https://<project-ref>.supabase.co/functions/v1`
Headers: `Authorization: Bearer <access token of the anonymous session>`; `apikey: <publishable key>`; `Content-Type: application/json`. The publishable key is not user identity. There are no login, logout, password or account endpoints; the session is created client-side with `supabase.auth.signInAnonymously()` (see IDENTITY.md).

## POST /chat
Request:
{ "conversation_id": null, "idempotency_key": "<client uuid>", "message": "Explain Python loops with a small example.", "mode": "explain", "programming_language": "python" }
Rules: conversation_id null only for first turn; no user_id, history, system prompt, assistant messages or model selection; reject unknown fields.

Stream (Content-Type text/event-stream, Cache-Control no-store):
event: meta    data: {"request_id","turn_id","conversation_id","assistant_message_id"}
event: status  data: {"stage":"retrieving"|"streaming"|"saving","sources_found":2}
event: delta   data: {"text":"..."}
event: sources data: {"items":[{"label":"S1","title":"...","url":"...","section":"..."}]}
event: done    data: {"turn_id","status":"completed","usage":{"input_tokens":null,"output_tokens":null}}
Emit done only after durable finalization. Usage null when not reported. Sources optional.
Mid-stream failure: event: error data: {"code":"GENERATION_INTERRUPTED","message":"...","retryable":true,"turn_id":"..."}

## Idempotency
| Existing request | Result |
|---|---|
| none | reserve new turn |
| same key+hash, active | 409 TURN_IN_PROGRESS |
| same key+hash, completed | 200 JSON stored result |
| same key, different hash | 409 IDEMPOTENCY_MISMATCH |
| same key, failed/interrupted | return terminal state |
Retry of a failed turn uses a new key after explicit user action. Frontend branches on Content-Type (JSON replay vs SSE).

## Other endpoints
- GET /conversations?limit(default 20,max 50)&cursor&search → {items,next_cursor}; caller-owned only. Items include mode for the sidebar dot.
- GET /conversations/{id} → metadata + paginated messages; 404 if absent or inaccessible.
- PATCH /conversations/{id} {title}; DELETE /conversations/{id} → 204, invalidates active generation.
- DELETE /conversations {"confirm":"DELETE_ALL_CONVERSATIONS"} → 204; deletes all of the caller's conversations; preferences kept.
- GET /profile → preferences + onboarded_at. PATCH /profile {preferred_language?, explanation_language?, experience_level?, explanation_depth?, enter_to_send?, reduce_motion?, onboarded?: true}; enum-validated; unknown fields rejected.
- POST /cancel-turn {turn_id} → {status:"cancellation_requested"}; idempotent, owner-scoped; completed stays completed.
- POST /feedback {message_id, rating, reason}; own assistant messages only.
- POST /bookmarks {message_id}; DELETE /bookmarks/{messageId}; idempotent; GET /bookmarks?language&cursor for the Saved page.
- POST /data-delete {"confirm":"DELETE_ALL_MY_DATA"} → 202 {job_id}; deletes all caller data and the anonymous auth user. Client then clears its local session and calls signInAnonymously() for a fresh workspace. No target user_id accepted.
- Ingestion: operator/service authorization only; learners denied.

## Errors
| Status | Code | Meaning |
|---|---|---|
| 400 | INVALID_REQUEST | malformed input |
| 401 | SESSION_REQUIRED | missing/expired/invalid session token — client silently refreshes or creates a session, never shows login |
| 403 | ACTION_FORBIDDEN | unauthorized action |
| 404 | NOT_FOUND | missing/inaccessible |
| 409 | TURN_IN_PROGRESS | active request exists |
| 409 | IDEMPOTENCY_MISMATCH | key reused with different input |
| 413 | INPUT_TOO_LARGE | over limit |
| 429 | RATE_LIMITED / DAILY_LIMIT_REACHED / NETWORK_LIMIT_REACHED | session, daily or per-IP quotas |
| 502 | MODEL_UNAVAILABLE | upstream failure |
| 503 | BUDGET_PAUSED / GENERATION_PAUSED | cost breaker / kill switch |
| 504 | GENERATION_TIMEOUT | deadline exceeded |
Use Retry-After where appropriate. Envelope: {"error":{"code","message","retryable","request_id"}}. Never return credentials, SQL, provider bodies, IPs or stack traces. Messages are beginner-friendly (see design/preview/components.html §08).
