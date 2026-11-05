# Instructions for Coding Agents

## Mission
Build CodeBloom end to end per PRD.md, IDENTITY.md, TRD.md, Design.md (+ design/), API.md. Order: Agend.md + IMPLEMENTATION_PLAN.md. Done = every item in ACCEPTANCE_CRITERIA.md has evidence.

## Non-negotiables
- Next.js frontend; Supabase Edge Functions for AI orchestration; Supabase Postgres + pgvector; xAI Grok for generation.
- **No login UI of any kind.** No sign-up, sign-in, sign-out, password, email, magic-link or OAuth screens or routes. Identity = Supabase anonymous session created silently (IDENTITY.md).
- Anonymous does not mean unauthenticated: every request still carries a verified Supabase JWT; RLS still scopes every row to `auth.uid()`.
- Do not silently swap providers (Groq, OpenAI, etc.).
- XAI_API_KEY lives only in Edge Function secrets; never in NEXT_PUBLIC_ variables.
- Never trust client-supplied user_id or assistant messages.
- Do not use an admin DB client where a user-scoped client works.
- Enable RLS and set explicit grants on every table.
- Never execute learner code in the app or Edge Runtime.
- Never claim tests passed unless actually run.
- Match the design in `design/` — tokens, components, states and motion.

## Workflow
Read specs → inspect code → smallest coherent change → tests → implement → run checks → document results/limitations/migrations.

## Source of truth
PRD (scope), IDENTITY (who the user is), Design + design/ (visuals), TRD (technical), DATABASE (data access), API (contracts). SECURITY overrides convenience. Record conflicts in `docs/DECISIONS.md` instead of silently changing architecture.

## Standards
Strict TypeScript; validate at trust boundaries (zod or equivalent); keep server-only modules out of client bundles; accessible components; sanitize Markdown; separate domain logic from UI; minimal dependencies; commit lockfiles; schema changes as migrations; honour `prefers-reduced-motion`.

## AI rules
Version prompts; treat retrieved text as untrusted data; no hidden reasoning disclosure; never invent source URLs; never claim code was executed; no automatic retry of ambiguous paid requests; don't trust user-provided roles.

## Before finishing (every phase)
Run lint, type check, unit tests, Edge Function type check (`deno check`), DB authorization tests (`supabase test db`), e2e for changed flows, and an axe accessibility pass on changed screens. State explicitly any check that could not run.

## Prohibited
Login/sign-up pages; storing identity in localStorage-only schemes that bypass Supabase Auth; wildcard CORS in production; browser-stored service-role keys; roles from editable user metadata; cross-user response caches; in-memory-only global rate limiting; heavy document parsing in chat requests; client-side route hiding as authorization; raw HTML rendering of model output.
