# CodeBloom Technical Requirements

## Architecture decision
Next.js for presentation and session-aware rendering; Supabase Edge Functions for AI orchestration and protected mutations; Supabase Postgres for state and pgvector retrieval. No second AI backend in Next.js (session refresh utilities are allowed).

## Frontend
App Router, strict TypeScript, Server Components where appropriate, Client Components for chat, Tailwind with the theme from `design/tokens.css`, component styles ported from `design/cb.css`, `next/font` for Geist + Geist Mono, safe Markdown renderer (no raw HTML), lazy syntax highlighting mapped to the design's syntax tokens, fetch streaming with AbortController, `prefers-reduced-motion` + in-app Reduce motion setting. Use current stable compatible versions at implementation time and commit lockfiles; do not label unverified versions as tested.

## Identity (no login) — see IDENTITY.md
Supabase Auth **Anonymous Sign-ins** + `@supabase/ssr`. A client `SessionGate` calls `signInAnonymously()` (with an invisible Turnstile `captchaToken` in staging/production) when no session exists. Email, phone and OAuth providers are disabled. Verify identity on server routes with `getClaims()`/`getUser()` (never `getSession()` alone). Independently verify bearer tokens in Edge Functions. Enforce ownership in the database. Next.js 16+ uses `proxy.ts`; earlier uses `middleware.ts` — it only refreshes session cookies and never redirects to a login page. Never cache personalized HTML across users.

## Edge Functions
| Function | Responsibility |
|---|---|
| chat | validate, reserve turn (session + IP quotas), retrieve, call xAI, stream, finalize |
| conversations | list, get, rename, delete one, delete all |
| profile | read/update learning preferences, set onboarded_at |
| cancel-turn | request cancellation |
| feedback | validate and save |
| bookmarks | save/remove |
| data-delete | delete all app data + the anonymous auth user |
| ingest-content | operator-only ingestion (service credential, never browser-callable) |
| maintenance | reconcile abandoned leases; purge inactive anonymous users after ANON_RETENTION_DAYS |
Simple user-scoped reads may use the Data API directly if grants and RLS allow.

## xAI integration
Endpoint https://api.x.ai/v1/responses, Bearer XAI_API_KEY, model from XAI_MODEL (verify availability in your account). store:false with application-managed history; no previous_response_id initially; omit tools; bound max_output_tokens; never expose raw provider errors. store:false does not guarantee zero provider logging. Confirm streaming event names against recorded fixtures.

Request shape:
{ "model": "<XAI_MODEL>", "store": false, "stream": true, "max_output_tokens": 1800, "input": [ {"role":"system","content":"<versioned tutor prompt>"}, ...server-verified history..., {"role":"user","content":"<current message>"} ] }

## Application limits (configurable policy, not provider guarantees)
| Limit | Initial |
|---|---|
| Message | 12,000 chars |
| Request body | 32 KiB |
| Concurrent turns per session / conversation | 1 / 1 |
| Turns per minute / UTC day per session | 10 / 100 |
| Turns per UTC day per hashed IP | 300 |
| Retrieved chunks | up to 5 |
| Output budget | 1,800 tokens |
| Turn deadline | 90 s |
| Upstream no-progress timeout | 30 s |
| Generation lease | 120 s |
| Anonymous inactivity retention | [DECIDE: e.g. 90 days] |
Also apply a token-aware context budget.

## Platform limits to design around
Hosted Edge Functions: 256 MB memory, 2 s CPU time per request, request idle timeout 150 s, wall clock 150 s free / 400 s paid, 20 MB bundle via CLI. Benchmark native embeddings; keep ingestion out of chat requests. Verify against current Supabase docs before release.

## Embeddings
Candidate gte-small, 384 dims, mean_pool + normalize, same preprocessing for docs and queries. The Grok key does not imply embedding access. If benchmarks fail, swap the adapter and re-embed everything.

## Streaming
Application-owned SSE over POST fetch: meta, status, delta, sources, done, error. Not EventSource. Handle UTF-8 fragmentation and multiple events per chunk. `status` events drive the lifecycle row (retrieving → streaming → saving).

## Persistence
Server creates user and assistant records; browser cannot insert assistant messages; atomic turn reservation; user message persisted before provider call; final assistant content persisted before done; never mark incomplete/failed as completed; idempotency keys + request hash; reject overlapping turns; lease-based reconciliation.

## Reliability
No automatic retry after ambiguous upstream acceptance; bounded jittered retries only for clearly safe operations; stable public error codes; preserve drafts (sessionStorage per conversation, cleared on send success).

## Observability
Log metadata only: request ID, turn ID, model, prompt/retrieval versions, stage latencies, final status, provider request ID, usage, redacted error category, hashed IP bucket. No full prompts/responses and no raw IPs by default.

## Performance objectives (to be measured)
Landing LCP < 2.5 s; workspace shell usable < 3 s on agreed profile (including silent session creation); model first-token p95 < 8 s; >= 99% of valid turns reach a terminal state; slow turns end within deadline. A metadata event is not a first token.
