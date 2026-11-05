# CodeBloom Acceptance Criteria

## Product
- [ ] A first-time visitor reaches a streamed answer without any sign-up, login, email or password step
- [ ] Beginner can submit a question and gets an answer to the actual question
- [ ] Explain/Debug/Practice behave differently (structure, Not executed label, hints)
- [ ] Tutor never claims code execution
- [ ] Saved conversations continue on the same browser after reload; rename and delete work

## No-login identity
- [ ] No /login, /signup, /logout or /auth/* routes; no login/sign-out UI, avatar or email anywhere
- [ ] Anonymous session created silently (invisible Turnstile in staging/production)
- [ ] Only anonymous sign-ins enabled; email/phone/OAuth providers disabled
- [ ] Two browsers are two isolated learners; clearing cookies gives a fresh workspace
- [ ] Delete all my data removes data and the auth user, then starts a fresh session
- [ ] Inactive anonymous data purged after the disclosed period

## Design
- [ ] Matches design/ previews and screenshots: neutral #FAFAF9 background, indigo #4F46E5 primary, mode colours, dark code surface, Geist fonts
- [ ] Every component state (hover, focus, disabled, error) from design/preview/components.html exists
- [ ] Motion as specified; fully disabled with prefers-reduced-motion and the in-app switch
- [ ] Code readable on mobile; works at 320px; long code never breaks layout

## Data and authorization
- [ ] Protected requests verify the session JWT
- [ ] RLS on every exposed table; grants minimal
- [ ] Cross-session tests pass
- [ ] Browser cannot insert assistant messages or alter usage
- [ ] Late generation cannot resurrect a deleted conversation

## AI integration
- [ ] Grok requests only from Edge Functions; XAI_API_KEY absent from client assets
- [ ] Model verified in staging; store:false sent
- [ ] Context/output budgets enforced; no provider tools
- [ ] Unknown provider events fail safely; usage recorded when available

## Reliability and abuse
- [ ] No duplicate messages on retry; concurrency policy enforced; atomic rate limits (session, hashed IP, global)
- [ ] Session-churn abuse drill hits CAPTCHA / IP limits
- [ ] Stop works; abandoned turns reconciled
- [ ] Save failure never emits success; refresh reconciles; no silent retry of ambiguous paid calls

## Retrieval
- [ ] Only published approved content searchable
- [ ] Query/document embeddings share configuration
- [ ] Source labels server-validated; no fabricated URLs; honest weak-retrieval fallback
- [ ] Retrieval eval meets agreed threshold

## Quality
- [ ] Tutor eval meets PRD targets; no false execution claims; no fabricated labels
- [ ] No critical accessibility findings; no unresolved critical/high security findings

## Operations
- [ ] Separate staging/prod secrets; logs exclude content and raw IPs
- [ ] Spending controls and generation pause tested
- [ ] Privacy notice matches real provider, browser-linked storage, retention and backup behaviour
- [ ] Recovery runbook tested

## Release record
Commit, migration version, model id, prompt version, embedding version, corpus version, test and eval results, known limitations, approver and date. Never tick an item without evidence.
