# CodeBloom Implementation Plan

Build vertical slices, validating identity, streaming and persistence before polishing. Each phase ends with the AGENTS.md checks and an entry in `docs/PROGRESS.md`.

1. **Design system + static workspace.** Tailwind theme from `design/tokens.css`; port components from `design/cb.css` into `src/components/ui` (Button, IconButton, Input, Select, SegmentedControl, Switch, OptionCard, Badge, Chip, Card, CodeBlock, SourceCard, Banner, Toast, Dialog, Skeleton, StatusRow); `next/font` Geist. Build every screen in `design/screens.json` with fixture data (clearly non-live) and the interactions shown in the previews. Verify against `design/screenshots` at 1440 and 390, keyboard, contrast, reduced motion.
2. **Silent identity and private history.** Supabase anonymous sign-ins, `SessionGate`, Turnstile (staging), `proxy.ts` cookie refresh, schema + profile trigger, RLS/grants, conversation list, profile read/update, onboarding persistence. Verify two-browser isolation, cookie-clear → fresh workspace, no auth routes exist.
3. **One durable Grok turn.** Validation, atomic reservation (session + IP + global), xAI adapter, SSE with status events, durable finalization, basic errors. Verify one staged request, no exposed key, correct history.
4. **Reliability.** Idempotency, quotas, concurrency rejection, cancellation (Stop → interrupted), timeouts, lease reconciliation, retry UX, draft preservation. Verify double-click, refresh, offline, provider and DB failures.
5. **Grounded tutoring.** Manifest, protected ingestion, chunking, embeddings, retrieval RPC, label validation, source cards. Verify published-only, weak fallback, version consistency, retrieval eval.
6. **Learning modes and library.** Explain / Debug (diff + Not executed) / Practice (hints, solution, progress panel), preferences, feedback, saved explanations (grid/list, filter, undo), title search, delete conversation / delete all / delete all my data. Verify per-mode evals, honest execution labels, ownership.
7. **Release readiness.** Privacy notice (with retention values from the user), inactivity purge job, monitoring, budget pause, abuse drill, runbook, dashboards. Verify acceptance checklist, security and accessibility reviews, load test, recovery drill.

## Suggested tree
```
src/app/
  (marketing)/page.tsx                 # /
  (workspace)/layout.tsx               # SessionGate + sidebar shell
  (workspace)/onboarding/page.tsx
  (workspace)/chat/page.tsx
  (workspace)/chat/[conversationId]/page.tsx
  (workspace)/saved/page.tsx
  (workspace)/settings/page.tsx
src/components/{ui,chat,learning,navigation,marketing}
src/hooks; src/lib/{supabase,api,streaming,validation,markdown,session}; src/styles/; src/types
supabase/
  config.toml                          # anonymous sign-ins on, email signup off
  migrations/ tests/ seed.sql
  functions/_shared/{auth,validation,cors,errors,xai,embeddings,retrieval,prompts,streaming,usage,iphash}.ts
  functions/{chat,conversations,profile,cancel-turn,feedback,bookmarks,data-delete,ingest-content,maintenance}/index.ts
tests/{unit,integration,e2e,visual,evaluations}
docs/{PROGRESS.md,DECISIONS.md}
```
No `(auth)` route group, no `auth/callback`. This tree is a deliverable plan; these files do not yet exist.
