# CodeBloom — Claude Code instructions

@AGENTS.md

## Claude Code specifics
- Start every session by reading `README.md`, then the spec in the README's reading order. Re-read the relevant spec section before changing an area.
- The visual source of truth is `design/`. Open `design/preview/*.html` (or the PNGs in `design/screenshots/`) for each screen you build and match spacing, type, colour, states and motion. Port `design/cb.css` tokens into Tailwind exactly as `design/README.md` describes; do not invent new colours.
- **There are no sign-up, login, logout, password or account pages.** Do not create `/login`, `/signup`, `/auth/*` routes or any email/OAuth flow. Identity is an invisible anonymous Supabase session (see `IDENTITY.md`).
- Work phase by phase from `IMPLEMENTATION_PLAN.md`. Keep a running checklist in `docs/PROGRESS.md` in the implementation repo: what is done, what was verified (with the exact command), and open issues.
- Use the task list for multi-step work. Commit at the end of each phase with a message naming the phase.
- Run the checks in AGENTS.md "Before finishing" after every phase and paste real output summaries into `docs/PROGRESS.md`. If a check cannot run (for example, no xAI key locally), say so and use the recorded fixtures.
- Ask the user before: choosing a different provider, changing the identity model, adding paid services, or any destructive database change.
- Placeholders in the form `[LIKE THIS]` (retention period, terms link, contact email) must stay visible in the UI until the user supplies real values — never invent them.

## Useful commands (implementation repo)
```bash
npm run dev            # Next.js
npm run lint && npm run typecheck && npm test
supabase start         # local stack (Docker)
supabase db reset      # apply migrations + seed
supabase test db       # pgTAP authorization tests
supabase functions serve --env-file supabase/functions/.env
npx playwright test    # e2e
```
