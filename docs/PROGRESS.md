# CodeBloom — build progress

Running checklist (CLAUDE.md): what is done, how it was verified (exact command plus a real result
summary), and what is still open. Last updated 2026-11-06.

Hosted backend: Supabase project `codebloom` (ref `vxwexuiimetzkdpaakzv`, Postgres 17.11).

## Phase status

| Phase (IMPLEMENTATION_PLAN.md) | Status |
|---|---|
| 1 Foundation: repo, Next.js, tokens, tooling | ✅ Done |
| 2 Database: schema, RLS, grants, RPCs, cron | ✅ Done — applied to the hosted project; pgTAP 90/90 |
| 3 Edge Functions: chat (SSE), data-delete, ingest-content | ✅ Done — deployed; live auth/CORS checks pass |
| 4 Frontend: landing, onboarding, chat, saved, settings | ✅ Done — matches `design/`; axe clean at 1440 and 390 |
| 5 Content: approved corpus, embeddings, retrieval eval | ✅ Done — 21 lessons / 52 chunks published; recall@1 21/21 |
| 6 Testing: unit, DB, e2e, a11y, visual | ✅ Done (live chat smoke blocked, see Open items) |
| 7 Release: Vercel deploy, live smoke | ⏳ Blocked on two dashboard steps (see Open items) |

## Verification log (2026-11-06, commit `056dbf8` + docs)

| Check | Command | Result |
|---|---|---|
| Lint | `npx eslint .` | 0 problems |
| Types | `npx tsc --noEmit` | 0 errors |
| Unit tests | `npm test` (vitest) | 6 files, **72/72 passed** (SSE parser incl. split UTF-8/CRLF/multi-event, provider adapters incl. the recorded Groq stream, validation + hashing, prompts + citations, chat handler lifecycle incl. cancel/timeout/fallback/save failure, answer parser) |
| Edge Function types | `npm run typecheck:functions` (deno 2.9.6) | exit 0 for chat, data-delete, ingest-content |
| Production build | `npx next build` | compiled; `/` static, `/chat/[[...conversationId]]`, `/onboarding`, `/saved`, `/settings` dynamic; Proxy active |
| Client bundle secret scan | `npm run check:bundle-secrets` | OK, 108 files, no provider keys, secret keys or service-role JWTs |
| DB authorization (pgTAP) | runner `supabase/tests/.generated/authorization.run.sql` executed in the hosted DB (fetched from GitHub at `056dbf8`; ends in a raise, so every fixture rolls back) | **90/90 ok**: RLS isolation between two anonymous learners, anon denied, no forged assistant messages, private usage/deletion tables unreadable, service-only RPCs not learner-callable, idempotent reservations, concurrency + per-minute + per-IP + kill-switch limits, late completion after delete rejected, lease reconciliation, delete-all and delete-my-data cascades, 90-day inactivity purge |
| E2E journeys | `npm run test:e2e` (Playwright, production build + `tests/e2e/fake-supabase.mjs`) | **9/9 passed** (TESTING.md journeys 1–7, incl. stop → interrupted → retry, refresh mid-answer, second-browser isolation, cleared cookies, delete all / delete my data, route audit `/login` `/signup` `/sign-in` `/auth/callback` `/auth/login` → 404) |
| Accessibility + visual | same run, `tests/e2e/a11y-visual.spec.ts` | **6/6 passed**: axe WCAG 2.1 A/AA on landing, onboarding, 404, chat new/explain/debug/practice, saved, settings, mobile drawer at 1440 and 390 — **0 violations of any impact**. Screenshots in `test-results/screens/` reviewed against `design/screenshots/` |
| Retrieval eval | `ingest-content` `search` action (docs/evals/retrieval-2026-11-05.md) | recall@1 21/21; on-topic ≥ 0.859, off-topic ≤ 0.733; threshold 0.80 |
| Live function checks | `curl` against `https://vxwexuiimetzkdpaakzv.supabase.co/functions/v1/*` | preflight from the Vercel origin → `204` with `access-control-allow-origin`; unknown origin → `403`; `POST /chat` and `POST /data-delete` without a session → `SESSION_REQUIRED` envelope; anon `GET /rest/v1/conversations` → `42501 permission denied` |
| Deployed code = source | `get_edge_function chat` vs `npm run functions:bundle` | chat v1 matches the current bundle (it lacks only the operator-only ingest `search` schema, which chat doesn't use); ingest-content v2 includes `search`; data-delete v1 unchanged since deploy |
| Security advisors | Supabase advisors (security) | INFO ×4: RLS without policies on `private.*` service tables (intended deny-all). WARN ×9: learner RPCs are `SECURITY DEFINER` (intended, see DECISIONS D3). No other findings |

Fixes made because of these checks: code blocks lost their "Copied" state on any re-render (Markdown
renderers are now memoized); scrollable code wasn't keyboard-focusable; Settings overflowed at 390px;
citation spacing; practice check order; the debug fix line wasn't marked in the learner's code; the empty
chat column was 12px narrower than the design; three pgTAP assertions assumed an empty corpus.

## Open items

1. **Turn on Anonymous Sign-ins** (Supabase → Authentication → Sign In / Providers → "Allow anonymous
   sign-ins"). Until then the app opens to "We couldn't restore your private session": `POST /auth/v1/signup`
   returns `422 anonymous_provider_disabled`. Recommended while there: turn off the Email provider
   (there is no email login).
2. **Import the repo on Vercel.** The Vercel connection in this session gets `403` on project creation and
   the user chose not to share a token (DECISIONS D11). Steps are in README → "Deploy to Vercel". If the
   project gets a domain other than `python-chatbot-` / `codebloom-soomroabdullah374-8901s-projects.vercel.app`,
   add it to `private.app_config.allowed_origins`.
3. **Live chat smoke test** (TESTING.md "Live smoke"): not run, because no session can be created until
   item 1 is done. Needs no paid call beyond one short Groq request.
4. **Rotate the Groq key.** It was pasted into a chat. After rotating, update Vault:
   `select vault.update_secret((select id from vault.secrets where name = 'groq_api_key'), '<new key>');`
5. **Placeholders still visible by design:** `[PROVIDER & BACKUP RETENTION — confirm before launch]`,
   `[BACKUP RETENTION — confirm before launch]`, `Terms [LINK]`, `Contact [EMAIL]`.
6. **Not done yet (release hardening):** Turnstile site + Supabase CAPTCHA (D9); monitoring and alerts;
   load test and abuse drill; the ≥60-case tutor evaluation. Groq's free tier (8,000 tokens/min on this
   key) will throttle concurrent learners: a rejected request retries once on `openai/gpt-oss-20b`, then
   the learner sees "The tutor isn't responding right now" with their message kept.

## Acceptance criteria — evidence

Status: **Met** = evidence above. **Partial** = built and partly verified. **Open** = not done.
**Blocked** = waiting on a dashboard step. ACCEPTANCE_CRITERIA.md is left unticked, per its own rule;
this table is the evidence record.

| Criterion | Status | Evidence / gap |
|---|---|---|
| First visit reaches a streamed answer with no sign-up/login | Partial | E2E journeys 1–3 (fake backend, no login screen at any step). Live: Blocked on Anonymous Sign-ins |
| Answers the actual question | Partial | Prompt contract and adapter tests; a live Groq stream was recorded during the build. Needs the live smoke + tutor eval |
| Explain / Debug / Practice behave differently | Met | E2E journey 3 + screenshots: section layouts, "Not executed" label, progressive hints, hidden solution |
| Never claims code execution | Partial | System prompt rule 8; "Not executed" badges. Tutor eval not run |
| History survives reload; rename and delete work | Met | E2E 3, 3b, 3c; pgTAP 57–58, 64–65 |
| No login/sign-up/auth routes or UI | Met | E2E route audit (404 ×5) + journey 1 text check |
| Silent anonymous session (Turnstile in prod) | Partial | Silent session verified in E2E; Turnstile not configured (D9) |
| Only anonymous sign-ins enabled | **Blocked** | Hosted project: anonymous **off**, email **on**. Dashboard step |
| Two browsers isolated; cleared cookies → fresh workspace | Met | E2E 4 and 5; pgTAP 59–66 |
| Delete all my data → data + auth user removed, fresh session | Partial | pgTAP 86–88 (deletion job, generation blocked, cascade); E2E 6 (fake backend). Live run blocked |
| Inactive data purged after the disclosed period | Met | pgTAP 89–90; cron `codebloom-purge-inactive`; 90 days disclosed on landing + settings |
| Matches design/ | Met | Screenshot review vs design/screenshots at 1440/390 (fixes listed above) |
| Every component state from components.html | Partial | `design/cb.css` ported verbatim (hover/focus/disabled/error rules); not audited state by state |
| Motion off with reduced motion (OS + in-app) | Partial | cb.css `prefers-reduced-motion` rule + `html[data-reduce-motion]` override; not automated |
| Mobile code readable; 320px; long code safe | Partial | 390px: no horizontal overflow, focusable scroll regions; 320px not tested |
| Protected requests verify the JWT | Met | Live: `SESSION_REQUIRED` from chat and data-delete without a session; unit tests |
| RLS everywhere; minimal grants | Met | pgTAP; security advisor findings explained (D3) |
| Cross-session tests pass | Met | pgTAP 59–66 |
| Browser can't insert assistant messages or alter usage | Met | pgTAP 32–36 |
| Late generation can't resurrect a deleted conversation | Met | pgTAP 76–78 |
| Provider calls only from Edge Functions; key absent from client | Met | Bundle scan OK; key in Vault only (D1, D2) |
| Model verified; `store:false` sent | Partial | Groq key + stream verified during build. `store:false` is xAI-only (D1) |
| Context/output budgets; no provider tools | Met | Unit tests (history trim, output cap, `max_completion_tokens`); no tools in requests |
| Unknown provider events fail safely; usage recorded | Met | Unit tests (malformed/truncated streams, usage extraction); pgTAP 19–20 |
| No duplicate messages; concurrency; atomic rate limits | Met | pgTAP 6–12, 71–75 |
| Session-churn abuse drill | Open | Per-IP quota proven (pgTAP 71); CAPTCHA not configured; drill not run |
| Stop works; abandoned turns reconciled | Met | E2E 3b; unit cancel tests; pgTAP 80–81 |
| Save failure never shows success; refresh reconciles | Met | Unit test (`SAVE_FAILED`); E2E 3c |
| Only published content searchable | Met | pgTAP 27–29 |
| Query/document embeddings share configuration | Met | Both gte-small via the Edge runtime; `embedding_version` enforced in `match_document_chunks` |
| Server-validated labels; no fabricated URLs; honest fallback | Met | pgTAP 16; citation unit tests; weak retrieval → no-citation prompt |
| Retrieval eval meets threshold | Met | recall@1 21/21 |
| Tutor eval meets PRD targets | Open | ≥60-case human-reviewed eval not run |
| No critical a11y / security findings | Met | axe 0 violations; advisors show no critical/high |
| Separate staging/prod secrets; logs exclude content and raw IPs | Partial | One environment only; logs carry ids, counts and an 8-char IP-bucket prefix, never content or raw IPs |
| Spending controls and pause tested | Partial | Kill switch pgTAP 74; budget pause implemented (`BUDGET_PAUSED`), not tested |
| Privacy notice matches reality | Partial | Groq, browser-linked storage, 90-day purge shown; provider/backup retention still placeholders |
| Recovery runbook tested | Open | |

## Release record (candidate, not approved)

| Field | Value |
|---|---|
| Commit | branch `claude/pensive-feynman-6jal84` (see `git log`) |
| Migrations | `20261105000800_content_upsert` (latest applied) |
| Model | `openai/gpt-oss-120b` on Groq, fallback `openai/gpt-oss-20b`, `reasoning_effort=low` |
| Prompt version | `codebloom-tutor-v1` |
| Embeddings | `gte-small-384-v1` |
| Corpus | manifest v1: 21 documents, 52 chunks, all embedded and published |
| Tests | unit 72/72 · pgTAP 90/90 · e2e 9/9 · a11y/visual 6/6 · retrieval 21/21 |
| Known limitations | Open items 1–6 above |
| Approver / date | — (pending the user) |
