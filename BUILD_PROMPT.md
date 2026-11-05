# Kickoff prompt for Claude Code

1. Unzip this package. The `codebloom/` folder **is** the starting repository: specs and `design/` live at the root, and the app is built alongside them (`src/`, `supabase/`, `tests/`). `CLAUDE.md` at the root is loaded automatically.
2. `cd codebloom && git init`, then have ready: a Supabase project (or Docker for the local stack), an xAI API key, and a Cloudflare Turnstile site (optional for local).
3. Run `claude` in that folder and paste:

---

You are building **CodeBloom** end to end in this repository. The specification and design are already here. Read `README.md` first, then every document in its reading order, then `design/README.md`, and open each file in `design/preview/` (and the PNGs in `design/screenshots/`) before building that screen.

Hard requirements:
- Next.js App Router + strict TypeScript + Tailwind (theme from `design/tokens.css`), Supabase (Postgres + pgvector + Edge Functions), xAI Grok via Edge Functions only. The folder is not empty, so scaffold Next.js in a temporary directory and move the files in (or set it up manually) without touching the spec files.
- **No sign-up, login, logout, password, email or OAuth anywhere.** Identity is a silent Supabase anonymous session exactly as `IDENTITY.md` describes. Do not create `/login`, `/signup` or `/auth/*`.
- Match the design in `design/` precisely — tokens, components, states, motion, reduced motion, 320 px mobile.
- Follow `IMPLEMENTATION_PLAN.md` phase by phase. After each phase: run lint, typecheck, unit tests, `supabase test db`, e2e for changed flows, and an axe pass; record real results in `docs/PROGRESS.md`; commit.
- Use recorded SSE fixtures in tests; never make paid xAI calls in CI.
- Keep `[PLACEHOLDER]` values visible; ask me for the retention period, terms link and contact email before release.
- When a spec is ambiguous, write the question and your chosen default in `docs/DECISIONS.md` and continue; ask me before changing providers, the identity model, or anything destructive.

Start with Phase 1: scaffold the app, the design system and every screen with fixture data. Show me the screens next to `design/screenshots/` before moving on to Phase 2.

---
