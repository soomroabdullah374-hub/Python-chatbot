# CodeBloom Identity Model — no login

CodeBloom has **no sign-up, login, logout, password, email or OAuth**. Learners land on the site and start learning. Privacy, quotas and per-learner history still need a stable, verifiable identity, so CodeBloom uses **Supabase Anonymous Sign-ins**: a real Supabase Auth user, created silently, with no credentials the learner ever sees.

## How it works
1. A visitor opens any workspace route (`/onboarding`, `/chat`, `/chat/[id]`, `/saved`, `/settings`). The landing page `/` needs no session.
2. A client-side `SessionGate` (in the workspace layout) checks for a Supabase session. If none exists it calls `supabase.auth.signInAnonymously({ options: { captchaToken } })`. In production the `captchaToken` comes from an **invisible** Cloudflare Turnstile widget — nothing for the learner to click.
3. Supabase creates an `auth.users` row with `is_anonymous = true` and returns a normal session. The JWT has role `authenticated` and claim `is_anonymous: true`. `@supabase/ssr` stores it in cookies and refreshes it automatically.
4. A database trigger on `auth.users` insert creates the learner's `profiles` row with safe defaults.
5. Every Edge Function verifies the JWT exactly as it would for any user. RLS policies use `(select auth.uid())`. Nothing in the data model changes because the user is anonymous.

While the gate creates the session, show the workspace skeleton (`.skeleton`) — never a login screen. If session creation fails, show the "We couldn't restore your private session" banner (design/preview/components.html §08) with **Reconnect**, keeping any draft.

## What the learner is told (must appear in the UI)
- Landing hero: "No sign-up, no password. Your chats stay private to this browser."
- Settings → Your data: history is linked to this browser; anyone using this browser profile can see it; clearing site data, a private window or another device starts a fresh, empty workspace.
- FAQ: "Do I need to sign up? No…"

## Lifecycle
| Event | Behaviour |
|---|---|
| First visit to a workspace route | Silent anonymous session + profile with defaults; go to `/onboarding` if `profiles.onboarded_at` is null, else `/chat` |
| Return visit, same browser | Existing session refreshes; history is there |
| Cookies/site data cleared, private window, other device | New anonymous user, empty workspace. The old data is unreachable and is removed by inactivity cleanup |
| "Delete all conversations" (Settings) | Deletes conversations, messages, bookmarks, feedback; keeps preferences |
| "Delete all my data" (Settings) | Server deletes all app data and the auth user (admin API), client clears local session, then creates a new anonymous session → fresh workspace |
| Inactivity | Maintenance job deletes anonymous users (and cascading data) with no activity for `ANON_RETENTION_DAYS` — `[DECIDE: e.g. 90 days]`. Disclose the period in the privacy notice |

## Abuse and cost controls (anonymous identities are cheap to create)
- **Supabase Auth**: enable *Anonymous Sign-ins*; disable email, phone and every OAuth provider; enable CAPTCHA protection (Turnstile) in staging/production; keep the per-IP anonymous sign-in rate limit low (Auth → Rate Limits).
- **Per-session quotas**: unchanged from TRD (1 active turn, 10/min, 100/day).
- **Per-IP quotas** (new): `usage_ip_daily` keyed by `HMAC-SHA256(client_ip, IP_HASH_SALT)` — never store raw IPs. Default `MAX_TURNS_PER_IP_PER_DAY=300`, `MAX_NEW_SESSIONS_PER_IP_PER_DAY` enforced by Supabase Auth rate limit + CAPTCHA.
- **Global**: `GENERATION_ENABLED` kill switch and daily spend breaker (`BUDGET_PAUSED`).
- Client IP comes from the trusted forwarding header the platform documents (verify which header Supabase Edge Functions receive; never trust a client-supplied one).

## Not in v1 (keep the door open, no UI)
Converting an anonymous user to a permanent account (Supabase supports linking an identity to an anonymous user) would enable cross-device sync later. Do not build it; do not add UI for it. Keep `user_id` as the only foreign key to identity so a future upgrade needs no data migration.

## Implementation checklist
- `src/lib/supabase/{client,server}.ts` via `@supabase/ssr`; `SessionGate` client component; `proxy.ts` (Next.js 16+, `middleware.ts` earlier) only refreshes cookies — it never redirects to a login page.
- Server components read identity with `getClaims()`/`getUser()`, never `getSession()` alone.
- Never cache personalised HTML across users; mark workspace routes dynamic.
- Tests: two anonymous sessions cannot read each other's rows; deleted-data session cannot be reused; CAPTCHA-required config rejects sign-in without a token (staging).
