# CodeBloom Testing Strategy

| Layer | Purpose |
|---|---|
| Unit | validation, parsers, prompt building, budgets, IP hashing |
| Database | constraints, grants, RLS, atomicity, triggers |
| Integration | anonymous session, retrieval, xAI adapter, persistence, deletion |
| E2E | learner journeys (Playwright) |
| Visual | screens vs design/screenshots |
| Evaluation | teaching quality, correctness |
| Operational | timeouts, concurrency, cost and abuse controls |

## Unit
Empty/oversized input, invalid UUID, unsupported mode, unknown fields, request hashing, context budgeting, citation-label validation, URL sanitization, SSE parser fragmentation, split UTF-8, multiple events per chunk, incomplete terminal events, public error mapping, HMAC IP bucketing (no raw IP leaves the function).

## Database (pgTAP via supabase test db)
Two anonymous identities (`is_anonymous=true`, role authenticated) plus `anon`. Profile row created by trigger with defaults. Owner reads own; others cannot read/mutate; `anon` reads nothing; browser cannot insert assistant messages or change usage; usage_ip_daily / usage_global_daily / data_deletion_jobs not readable by browsers; unpublished documents not retrievable; source records inherit message privacy; feedback/bookmarks require ownership; service-only RPCs not learner-callable; reused idempotency key does not duplicate; concurrent reservations respect limits; IP quota blocks a second identity on the same bucket; deleted conversations reject late completions; purge removes inactive anonymous users and cascades. Allowed writes must use RETURNING and assert the row changed (zero-row success is not proof).

## Streaming fixtures
Normal completion, empty answer, refusal, provider 429/5xx, initial/mid-stream timeout, malformed event, client abort, save failure, unknown usage, completion arriving after cancellation. No live paid requests in CI.

## Live smoke (authorized environment)
Anonymous session created silently (with Turnstile test keys in staging); model available; short prompt; text streams; terminal state handled; persistence verified; usage extracted; store:false sent; secrets and raw IPs absent from logs.

## E2E journeys
1. Landing → Start learning → onboarding (answer all) → chat — with **no login screen at any point**.
2. Landing → Skip setup → chat; onboarding skipped and not shown again.
3. Start chat via starter card; follow-up; switch mode; copy code ("Copied" + toast); stop (interrupted banner) → retry; refresh during generation; save → Saved page → remove → undo; feedback; rename; delete conversation.
4. Second browser context = second anonymous user; cannot see the first's conversations (also via direct URL → 404 UI).
5. Clear cookies → fresh empty workspace.
6. Settings → Delete all conversations; Delete all my data → fresh session, empty history, preferences reset.
7. Route audit: requests to /login, /signup, /auth/callback return 404.

## Visual
Playwright screenshots at 1440 and 390 for each screen in design/screens.json; compare against design/screenshots with a tolerance; review diffs by eye — the reference is a design, not a pixel-perfect contract for dynamic content.

## Accessibility
Automated (axe) + manual: keyboard, focus visibility, dialog focus trap and return, screen-reader status without token spam, 200% zoom, 320px, reduced motion (OS and in-app switch), touch targets, contrast, long code overflow, mobile keyboard.

## Tutor evaluation
Target >= 60 human-reviewed cases (planned, not results): Python 12, JS/TS 12, SQL 8, HTML/CSS 8, debugging 10, ambiguity/safety 10. Score 1-5 on correctness, clarity, example size, assumption disclosure, honest execution status, feedback quality, source validity, injection resistance. Targets: correctness >= 90%, clarity mean >= 4, zero fabricated labels, zero false execution claims, zero cross-session exposure. LLM judges may assist but not be sole judge.

## Load and abuse
Documented workload in non-production; measure first model text, completion latency, reservation contention, embedding latency, error rate, memory/CPU failures, recovery after worker termination, cost per completed/interrupted turn. Abuse drill: scripted creation of many anonymous sessions from one IP must hit CAPTCHA/rate limits and the per-IP turn quota. Do not invent results.

## CI
Format, lint, types, unit, database, integration fixtures, core e2e, visual snapshot job (non-blocking at first), secret scanning, dependency review.
