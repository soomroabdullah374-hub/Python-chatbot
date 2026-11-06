# CodeBloom Deployment Runbook

## As built (2026-11)
The runbook below is the original plan. This is what the hosted setup actually looks like; the reasons
are in docs/DECISIONS.md.

| Piece | As built |
|---|---|
| Supabase project | `codebloom`, ref `vxwexuiimetzkdpaakzv`, Postgres 17 |
| Migrations | `supabase/migrations/20261105000100…0800` (applied) |
| Auth | Anonymous Sign-ins is currently **off**, so learners get sessions from the `session` fallback function (DECISIONS D13), which needs the Email provider on. Target state: Anonymous Sign-ins on, then `session_fallback_enabled = false`, then Email provider off. CAPTCHA once a Turnstile site exists |
| Edge Functions | `chat`, `data-delete`, `ingest-content`, `session` (all `verify_jwt = false`; each checks its caller itself, and `session` is rate-limited per hashed IP and globally). Deploy the single-file bundles from `npm run functions:bundle` (`supabase/functions/.dist/<name>/index.ts`) or `supabase functions deploy <name>` |
| Secrets | Supabase Vault: `groq_api_key`, `ip_hash_salt`, `operator_token`, read through the service-only RPC `get_runtime_config()`. Edge Function secrets `GROQ_API_KEY` / `XAI_API_KEY` / `IP_HASH_SALT` override them if set |
| Runtime config | `private.app_config`: `allowed_origins`, `generation_enabled` (kill switch), per-learner, per-IP and global limits, `global_daily_budget_usd`, `anon_retention_days` = 90, `model_prices` |
| Scheduled jobs | pg_cron: `codebloom-reconcile-turns` (every minute), `codebloom-purge-inactive` (03:17 UTC), `codebloom-purge-usage` (03:29 UTC) |
| Content | `npm run content:build` → `content/corpus.json`; ingest + embed with the operator-only `ingest-content` (`embed_pending` in batches of 4) |
| Frontend | Vercel project `codebloom` → https://codebloom-lac.vercel.app (CLI deploys; not Git-linked yet). No env settings needed (`.env.production` holds the public values). Standard deployment protection, so production domains are public. Add any new domain to `allowed_origins` |

Rotate the Groq key: `select vault.update_secret((select id from vault.secrets where name = 'groq_api_key'), '<new key>');`
Pause generation: `update private.app_config set generation_enabled = false;`

## Environments
Local, staging, production, with separate Supabase projects, Turnstile widgets and xAI keys where practical.

## Prerequisites
Node.js compatible with chosen Next.js, package manager, Supabase CLI, container runtime (Docker) for the local stack, Supabase project, xAI account with API access (a consumer chat subscription does not imply API access/credits), Cloudflare Turnstile site (invisible widget), frontend host.

## Frontend bootstrap
create-next-app with App Router, TypeScript, ESLint, Tailwind, src dir, import alias. Install only needed dependencies (`@supabase/ssr`, `@supabase/supabase-js`, a safe Markdown renderer, a syntax highlighter, zod, Turnstile React wrapper or the plain script). Commit lockfile.

## Supabase init
supabase init; supabase start; supabase db reset (run in the generated implementation repo; this package has no executable migrations).

## Auth configuration (no login)
Dashboard → Authentication:
- **Enable Anonymous Sign-ins.**
- Disable email signups, phone and every OAuth provider. No redirect/callback URLs are needed.
- Attack protection → enable CAPTCHA (Turnstile) with the secret key (staging/production; local dev may run without it).
- Rate limits → set a conservative anonymous sign-ins per IP per hour.
- JWT expiry default; refresh token rotation on.
Local: `supabase/config.toml` → `[auth] enable_anonymous_sign_ins = true`, `[auth.email] enable_signup = false`.

## Secrets
Frontend (public): NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_TURNSTILE_SITE_KEY.
Edge Function secrets: XAI_API_KEY, XAI_MODEL, ALLOWED_ORIGINS, IP_HASH_SALT, limits, ANON_RETENTION_DAYS, any explicit operator credential. Set with: `supabase secrets set --env-file supabase/functions/.env`. Names must not start with SUPABASE_ (reserved).

## Database deploy
Review migrations → staging → database tests → verify grants/RLS → check compatibility → production. No destructive production changes without recovery plan.

## Edge Functions
supabase functions deploy chat conversations profile cancel-turn feedback bookmarks data-delete maintenance (and ingest-content). Schedule `maintenance` (Supabase cron / pg_cron) for lease reconciliation every minute and inactive-anonymous purge daily. Never disable platform JWT verification without tested handler-level verification.

## Frontend deploy
Set public env → build → inspect client assets for secrets → staging → test silent session creation (with Turnstile), CORS, full chat lifecycle → promote. Confirm `/login`, `/signup`, `/auth/*` return 404.

## Publish content
Validate permissions → ingest → check chunks/embeddings → run retrieval eval → publish successful versions only. No unrestricted crawling.

## Production smoke
Open site in a fresh browser → Start learning → no login prompt → onboarding → chat → streamed text → persisted history after reload → source links → Stop → rate limit → second browser isolation → Delete all my data → fresh workspace → redacted logs → usage recording.

## Monitoring alerts
Provider errors, timeouts, stale active requests, reservation failures, embedding failures, spend spikes, unknown usage, anonymous sign-in spikes / CAPTCHA failures, per-IP limit hits, deletion and purge job failures.

## Recovery
Server-side generation kill switch (GENERATION_ENABLED); read-only history where safe; tighten CAPTCHA/IP limits under abuse; roll back to compatible releases; forward-fix migrations; reconcile stale requests; re-run smoke tests before reopening.

## Cost model
Estimate from measured traffic and current prices: input/cached/output/reasoning tokens, embeddings, Supabase DB/functions/storage/transfer and monthly active (anonymous) users, Turnstile, hosting, monitoring. Do not publish fixed estimates without assumptions.
