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

## D11 · Vercel deployment via the CLI, not Git
- **Built:** project `codebloom` (team `soomroabdullah374-8901s-projects`, Node 22.x), deployed with
  `vercel deploy --prod` using the user's token. Production URL https://codebloom-lac.vercel.app
  (`codebloom.vercel.app` was taken), plus `codebloom-soomroabdullah374-8901s-projects.vercel.app`.
  Both are in `allowed_origins`; `localhost:3000` stays for development.
- **Not Git-linked:** the Vercel GitHub app has no access to this repo (`install the GitHub integration
  first`), so pushes don't deploy automatically yet (PROGRESS open item 2). The Vercel connector used
  earlier in this session could not create projects at all (`403`).
- **Deployment protection:** the team default ("all except custom domains") would have put a Vercel
  login in front of learners. The project uses Standard protection instead: production domains are public,
  previews and per-deployment URLs need a Vercel login.
- `.vercelignore` keeps tests, design references, content sources and local build output out of the upload.

## D12 · Retention values
- Inactivity retention: **90 days** (user decision), enforced by `codebloom-purge-inactive`.
- Still placeholders, kept visible until the user supplies values: provider and backup retention,
  Terms link, Contact email.

## D13 · Server-side fallback for the silent anonymous session
- **Problem:** Supabase Auth's "Anonymous Sign-ins" is off on the hosted project, so every visitor got
  `422 anonymous_provider_disabled` and the "We couldn't restore your private session" banner. The tools
  available here can't change Auth settings, and the user chose not to share a Supabase access token, then
  asked for the best fix for the project.
- **Built:** the browser still calls the native `signInAnonymously()` first. Only on that specific
  refusal does it call the new `session` Edge Function (`_shared/session-handler.ts`), which:
  - reserves a slot under per-IP (10/hour, HMAC-hashed buckets) and global (500/hour) limits;
  - creates a user with a throwaway `<uuid>@anon.codebloom.invalid` address and random password, and
    signs in once;
  - calls `finish_fallback_session()` to remove the email, password and email identity and set
    `is_anonymous = true`;
  - refreshes the session, so the returned token carries `is_anonymous: true`, and the browser adopts it
    with `setSession()`.
  If any step fails, the half-made user is deleted.
- **Why this fits the spec:** learners still see no login and give no personal data, and each browser
  gets its own private, RLS-scoped user that is a real anonymous user in Supabase Auth. "Delete all my
  data" and the 90-day purge handle it like any other user (pgTAP 91–98, e2e journey 8, live smoke).
- **Trade-offs:** it relies on the Email provider staying enabled, which only the server uses. A first
  visit takes about 4 s (four Auth round trips instead of one). All fallback sign-ins reach Supabase Auth
  from the function's network, so Supabase's per-IP sign-in rate limit applies to all of them together;
  that's fine at current traffic.
- **Exit path:** turn on Anonymous Sign-ins in the dashboard. The browser then never calls the fallback.
  After that, `update private.app_config set session_fallback_enabled = false;` and disabling the Email
  provider complete the original setup.
