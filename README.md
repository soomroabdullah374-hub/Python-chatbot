# CodeBloom

A beginner-friendly programming tutor that explains concepts, reads code, diagnoses mistakes and offers small practice exercises.

**No sign-up, no login.** Learners open the site and start learning straight away. Each browser gets an invisible, private anonymous session, so conversations stay private and per-learner limits still work. See [IDENTITY.md](IDENTITY.md).

## Stack
| Area | Choice |
|---|---|
| Frontend | Next.js App Router, TypeScript (strict), Tailwind CSS |
| Identity | Supabase **Anonymous Sign-ins** via `@supabase/ssr` — no login UI, no email/password, no OAuth |
| Backend | Supabase Edge Functions |
| Database / vectors | Supabase Postgres + pgvector |
| Generation | Groq (`openai/gpt-oss-120b`, fallback `openai/gpt-oss-20b`); xAI Grok adapter kept behind `LLM_PROVIDER=xai`. Keys stay server-side only (Supabase Vault / Edge Function secrets) |
| Embeddings | Supabase-native gte-small (384 dims), subject to benchmarking |
| Abuse protection | Cloudflare Turnstile (invisible) on anonymous session creation, per-session and per-IP quotas, global spend pause |

## Design
Neutral near-white `#FAFAF9`, ink `#17171C`, primary indigo `#4F46E5`, coral bloom accent `#F97362`, mode colours (Explain indigo, Debug amber `#D97706`, Practice green `#16A34A`), dark code surface `#11111B`. Fonts: Geist + Geist Mono. Full spec: [Design.md](Design.md). Pixel reference: [`design/`](design/README.md) — open `design/preview/index.html` in a browser.

## Initial scope
Python, JavaScript, TypeScript, SQL, HTML/CSS. English first; Roman Urdu optional (beta) and evaluated separately. Adult learners assumed.

## Out of scope for v1
Accounts of any kind (sign-up, login, password, email, OAuth, magic link), cross-device sync, code execution, user uploads, autonomous browsing, voice, billing, classrooms, public share links, fine-tuning.

## Status
Built end to end and tested; see [docs/PROGRESS.md](docs/PROGRESS.md) for every check and its result and
[docs/DECISIONS.md](docs/DECISIONS.md) for where the build deviates from the spec and why.

- **Backend (live):** Supabase project `codebloom` (`https://vxwexuiimetzkdpaakzv.supabase.co`): 8 migrations,
  RLS on every table, pg_cron maintenance, Edge Functions `chat`, `data-delete` and `ingest-content`, and
  21 published lessons (52 embedded chunks).
- **Frontend:** this Next.js app. It's ready to import on Vercel with no settings; see "Deploy to Vercel".
- **Before learners can use it:** turn on *Anonymous Sign-ins* in the Supabase dashboard
  (Authentication → Sign In / Providers).

## Run it locally
```bash
npm ci
cp .env.example .env.local   # fill in the Supabase URL + publishable key (public values)
npm run dev                  # http://localhost:3000
```
Add `http://localhost:3000` to `private.app_config.allowed_origins` if it isn't there (it is by default).

## Checks
```bash
npm run lint && npm run typecheck && npm test        # ESLint, tsc, Vitest (72 tests)
npm run typecheck:functions                          # deno check for the Edge Functions
npm run build && npm run check:bundle-secrets        # production build + client-bundle secret scan
npm run test:e2e                                     # Playwright journeys + axe + screenshots (fake backend)
npm run db:tests:build                               # regenerates supabase/tests/.generated/authorization.run.sql
```
The pgTAP suite runs with `supabase test db` locally. Against a hosted project, paste the generated runner
into the SQL editor: it finishes by raising its TAP output, which rolls every fixture back.

## Deploy to Vercel
1. On vercel.com, choose **Add New → Project** and import `soomroabdullah374-hub/Python-chatbot`. If the
   repo isn't listed, give the Vercel GitHub app access to it.
2. Keep the defaults (framework Next.js, root `./`) and click **Deploy**. No environment variables are
   needed: `.env.production` carries the public Supabase URL and publishable key, and Vercel variables
   override it if set.
3. If the production URL isn't `https://python-chatbot-soomroabdullah374-8901s-projects.vercel.app` (or
   `codebloom-…`), allow it for the Edge Functions (the functions pick it up within 60 s):
   ```sql
   update private.app_config set allowed_origins = array_append(allowed_origins, 'https://<your-domain>');
   ```

## Repository layout
| Path | What it is |
|---|---|
| `src/app` | Routes: `/` landing, `/onboarding`, `/chat/[[...conversationId]]`, `/saved`, `/settings`, 404 |
| `src/components` | Chat (composer, answers, learning panel), shell/sidebar, UI primitives |
| `src/lib` | Supabase client, silent anonymous session, data access, SSE chat client, answer parser |
| `supabase/migrations` | Schema, RLS + grants, RPCs, cron, Vault-backed config |
| `supabase/functions` | Edge Functions + `_shared` (prompts, providers, SSE, validation, CORS) |
| `supabase/tests` | pgTAP authorization suite (+ generated SQL runner) |
| `content/` | Original lessons, corpus builder output, retrieval eval set |
| `tests/` | Unit (Vitest), e2e/a11y/visual (Playwright) with a local fake backend |
| `design/` | Visual source of truth (previews, screenshots, tokens) |
| `docs/` | Progress log, decisions, evaluations |

## Reading order
PRD → IDENTITY → Design (+ design/README) → appflow → TRD → ARCHITECTURE → DATABASE → API → RAG → PROMPTS → SECURITY → TESTING → DEPLOYMENT → IMPLEMENTATION_PLAN → ACCEPTANCE_CRITERIA

## Boundaries
Never commit real credentials. Never expose a provider key (Groq or xAI) through `NEXT_PUBLIC_` variables.
The HTML previews in `design/` are static design references, not app code. Not done yet: a Turnstile
site, monitoring, load and abuse drills, and the human-reviewed tutor evaluation (see docs/PROGRESS.md).
