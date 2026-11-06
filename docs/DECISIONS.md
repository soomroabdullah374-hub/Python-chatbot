# Decisions and deviations from the spec

Recorded per AGENTS.md ("Record conflicts in docs/DECISIONS.md instead of silently changing architecture").
Each entry says what the spec asked for, what was built, and why.

## D1 · Groq instead of xAI for generation (user decision)
- **Spec:** xAI Grok, key in Edge Function secrets.
- **Built:** Groq Chat Completions (`openai/gpt-oss-120b`, falls back to `openai/gpt-oss-20b` when the
  primary is rejected before streaming, e.g. 429). The xAI Responses adapter is still implemented and
  unit-tested; `LLM_PROVIDER=xai` plus an `XAI_API_KEY` switches back without code changes.
- **Why:** the user supplied a Groq key and chose "Groq, this key" when asked. The UI and privacy copy
  name the provider through `NEXT_PUBLIC_AI_PROVIDER_NAME` (`Groq`), so they stay accurate.
- **Note:** Groq has no per-request "store: false" flag like xAI's, so the privacy copy doesn't claim one.
  Provider retention stays a visible `[PROVIDER & BACKUP RETENTION — confirm before launch]` placeholder.

## D2 · Provider key kept in Supabase Vault, read by the functions
- **Spec:** Edge Function secrets.
- **Built:** the Groq key, the IP-hash salt and the operator token live in Supabase Vault
  (`groq_api_key`, `ip_hash_salt`, `operator_token`). The functions read them through the service-only
  RPC `get_runtime_config()`, cached for 60 s. Edge Function secrets with the same names
  (`GROQ_API_KEY`, `IP_HASH_SALT`) take precedence if they are ever set.
- **Why:** storing Edge Function secrets through the tooling available here was refused ("Storing keys is
  paused"). Vault keeps the key server-side and out of the repo and the client bundle. Learners can't call
  `get_runtime_config` (pgTAP test 42).

## D3 · Learner mutations are database RPCs, not one Edge Function each
- **Spec (API.md):** separate functions for conversations, profile, cancel-turn, feedback and bookmarks.
- **Built:** `SECURITY DEFINER` RPCs (`rename_conversation`, `delete_conversation`,
  `delete_all_conversations`, `set_feedback`, `add_bookmark`, `remove_bookmark`, `cancel_turn`,
  `complete_onboarding`, `touch_activity`). Each one derives the user from `auth.uid()`, validates input
  and raises stable error codes (`PT400`/`PT404` + catalogue code). Profile preferences use a
  column-limited `UPDATE` grant under RLS. Only `chat`, `data-delete` and `ingest-content` are Edge
  Functions.
- **Why:** fewer cold starts and moving parts with the same authorization guarantees. RLS plus checked
  RPCs is the access pattern DATABASE.md describes. The Supabase advisor flags these RPCs as "signed-in
  users can execute SECURITY DEFINER functions"; that is intended. Service-only RPCs (`reserve_turn`,
  `finalize_turn`, `get_runtime_config`, `begin_data_deletion`) have `EXECUTE` revoked from learners
  (pgTAP tests 40–43).

## D4 · pg_cron instead of a `maintenance` Edge Function
- **Built:** `codebloom-reconcile-turns` (every minute), `codebloom-purge-inactive` (daily 03:17 UTC,
  removes anonymous users inactive for `anon_retention_days` = 90) and `codebloom-purge-usage`
  (daily 03:29 UTC).
- **Why:** the work is plain SQL. Running it in the database needs no HTTP hop and no operator credential.

## D5 · Platform `verify_jwt` off; every function verifies the caller itself
- **Built:** `chat` and `data-delete` read the bearer token and verify it with `auth.getUser()` before
  doing anything; `ingest-content` requires the operator token from Vault. CORS uses an explicit allowlist
  (`private.app_config.allowed_origins`), with no wildcard.
- **Why:** this lets the functions return the app's own error envelope (`SESSION_REQUIRED` and so on) and
  answer CORS preflights for allowed origins only. DEPLOYMENT.md permits this "with tested handler-level
  verification", covered by unit tests and the live checks in docs/PROGRESS.md.

## D6 · Extra error code `SAVE_FAILED`
The answer streamed but `finalize_turn` failed twice. The client is told the answer won't be kept, instead
of showing a misleading "saved" state. Added to the shared catalogue (`_shared/errors.ts`).

## D7 · Practice solutions are generated with the feedback and revealed in the UI
- **Built:** a practice feedback turn returns Feedback, Hints, Solution and Check in one answer. The app
  shows one hint at a time and hides the solution until the learner asks. The understanding check appears
  after the solution is revealed.
- **Why:** this avoids a second paid call per "show solution" click and matches the design's progressive
  hints. The trade-off: the solution is in the stored message (the learner's own data).

## D8 · Retrieval threshold 0.80
Measured on the published corpus (docs/evals/retrieval-2026-11-05.md): recall@1 21/21, on-topic
similarity ≥ 0.859, off-topic ≤ 0.733. 0.80 sits in the gap. Weak retrieval falls back to a general
answer with no citations.

## D9 · No Turnstile yet
The invisible Turnstile integration is implemented (`src/lib/turnstile.ts`) and turns on when
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set and CAPTCHA is enabled in Supabase Auth. No Cloudflare site
exists for this project yet, so anonymous sign-up is protected only by Supabase's per-IP sign-in rate
limit, the per-IP turn quota (300/day) and the global caps (3,000 turns/day, $5/day budget pause).

## D10 · Public build values committed in `.env.production`
`NEXT_PUBLIC_SUPABASE_URL`, the publishable key, the provider name and the retention period go into every
browser bundle anyway. Committing them means a fresh Vercel import builds with no configuration. Vercel
environment variables still override them. No secret is ever placed in a `NEXT_PUBLIC_` variable, and
`npm run check:bundle-secrets` fails the check if one appears in the build output.

## D11 · Not deployed to Vercel from this session
The Vercel connection available here can read the account but gets `403 forbidden` on project creation and
deployments (with or without Git). The user chose not to share a Vercel token for the CLI. The repository
is import-ready instead (README "Deploy to Vercel"), and the Edge Functions already allow the
`python-chatbot-` / `codebloom-soomroabdullah374-8901s-projects.vercel.app` origins.

## D12 · Retention values
- Inactivity retention: **90 days** (user decision), enforced by `codebloom-purge-inactive`.
- Still placeholders, kept visible until the user supplies values: provider and backup retention,
  Terms link, Contact email.
