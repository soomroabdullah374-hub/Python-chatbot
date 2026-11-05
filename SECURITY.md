# CodeBloom Security Specification

## Assets
xAI API key, Supabase admin credentials, private conversations, anonymous sessions (cookies), budget, knowledge-base integrity.

## Threats and mitigations
| Threat | Mitigation |
|---|---|
| Secret exposure | server-only storage, bundle inspection |
| Cross-session access | verified JWT, RLS, ownership constraints |
| Session churn to bypass quotas (new anonymous identity per request) | invisible Turnstile CAPTCHA on anonymous sign-in, Auth per-IP sign-in rate limit, per-IP turn quota (hashed), global spend breaker |
| Session theft (cookie) | HttpOnly/Secure/SameSite cookies via @supabase/ssr, strict CSP, no tokens in URLs or logs |
| Shared-device exposure | disclose that history is visible to anyone using the same browser profile; provide Delete all my data |
| Assistant-message forgery | no browser write grants on messages |
| Prompt injection | untrusted context, no tools, bounded privileges |
| Stored XSS | safe Markdown, URL sanitization, CSP |
| Cost abuse | atomic quotas (session, IP, global), cost circuit breaker |
| Duplicate paid calls | idempotency, no ambiguous auto-retry |
| Ingestion poisoning | operator-only publishing, provenance |
| SSRF | no arbitrary URL fetching |
| Sensitive logging | metadata-only logs, hashed IP buckets only |

## Credentials
XAI_API_KEY only in Edge Function secrets; never in browser or NEXT_PUBLIC_ variables; no admin DB credentials in client bundles; separate dev/prod keys; rotate any exposed key. Turnstile secret key server-side only (Supabase Auth CAPTCHA settings); only the site key is public. IP_HASH_SALT is a secret. Shared server key architecture; no bring-your-own-key.

## Identity (no login)
Supabase Auth with **Anonymous Sign-ins enabled and every other provider disabled** (email, phone, OAuth). Validate JWT signature, issuer, audience, expiry using the supported Supabase library. Anonymous users have role `authenticated`; that is expected. A publishable key is not user identity. Never use editable user metadata for roles. If platform verify_jwt is disabled, every handler must verify identity before work.

## Authorization
Reject cross-user IDs; derive identity from the verified token; recheck ownership in privileged DB operations; ingestion is a separate permission; deny learners access to maintenance; test allow and deny with two anonymous sessions.

## CORS
Explicit production origins, localhost only in dev, handle OPTIONS, minimal headers/methods, no production wildcard. CORS is not authorization.

## Rendering
Disable raw HTML in Markdown; block javascript: and unsafe schemes; safe link attributes (`rel="noopener noreferrer"`); treat generated code as text and never evaluate it; no remote images from assistant Markdown in MVP. Set a Content-Security-Policy that allows only the app origin, Supabase project URL and Turnstile (`challenges.cloudflare.com`).

## Prompt injection
Retrieved text cannot change policy; no model-controlled credentials; no unrestricted tool calls; no secrets in context; delimiters alone are not a control.

## Validation
Body size, message length, UUIDs, enums, ownership, feedback values, title length, confirmation strings on bulk deletes, unknown fields, total stored output size.

## Rate and cost controls
Database-backed atomic enforcement: one active request per session and conversation; per-minute and daily limits per session; daily limit per hashed IP; global daily turn/cost breaker; alerts; unknown-usage accounting. max_output_tokens is not a complete cost cap (reasoning etc. may be billed separately). Client IP comes from the platform's trusted forwarding header only.

## Privacy
Collect no personal identifiers (no name, email, phone, age, location). Disclose: prompts go to xAI; conversations stored in Supabase and linked to this browser; anyone on the same browser profile can see them; inactive data is deleted after [ANON_RETENTION_DAYS]; avoid sharing secrets; answers may be wrong; deletion does not instantly purge backups. Review xAI retention before release; store:false does not prove zero retention.

## Delete all my data
Explicit confirmation string → record job → block new generation → cancel active requests → delete app data → delete the anonymous auth user via admin API → record completion without content → client clears session and starts a fresh anonymous session → UI explains backup limits.

## Incident response
Disable affected endpoints/model calls (GENERATION_ENABLED=false), rotate credentials, preserve redacted evidence, determine affected data, notify as required, fix root cause, add regression test, document recovery. If abuse spikes, raise CAPTCHA strictness and lower per-IP limits before disabling generation.

## Gate
No unresolved critical/high findings in core flows. This document is not a security audit.
