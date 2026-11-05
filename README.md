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
| Generation | xAI Grok API (key stored ONLY in Edge Function secrets) |
| Embeddings | Supabase-native gte-small (384 dims), subject to benchmarking |
| Abuse protection | Cloudflare Turnstile (invisible) on anonymous session creation, per-session and per-IP quotas, global spend pause |

## Design
Neutral near-white `#FAFAF9`, ink `#17171C`, primary indigo `#4F46E5`, coral bloom accent `#F97362`, mode colours (Explain indigo, Debug amber `#D97706`, Practice green `#16A34A`), dark code surface `#11111B`. Fonts: Geist + Geist Mono. Full spec: [Design.md](Design.md). Pixel reference: [`design/`](design/README.md) — open `design/preview/index.html` in a browser.

## Initial scope
Python, JavaScript, TypeScript, SQL, HTML/CSS. English first; Roman Urdu optional (beta) and evaluated separately. Adult learners assumed.

## Out of scope for v1
Accounts of any kind (sign-up, login, password, email, OAuth, magic link), cross-device sync, code execution, user uploads, autonomous browsing, voice, billing, classrooms, public share links, fine-tuning.

## Package contents
| Path | What it is |
|---|---|
| `CLAUDE.md` | Entry point for Claude Code (imports AGENTS.md) |
| `BUILD_PROMPT.md` | Copy-paste kickoff prompt for an end-to-end build |
| `PRD.md` … `ACCEPTANCE_CRITERIA.md` | Specification (reading order below) |
| `IDENTITY.md` | The no-login identity model (anonymous sessions) |
| `design/` | Stylesheet, tokens, interactive HTML previews, screenshots, canvas sources |
| `.env.example`, `supabase/functions/.env.example` | Environment templates (no secrets) |
| `CHANGELOG.md` | What changed from the previous spec package |

## Build it with Claude Code
Unzip, `cd codebloom`, run `claude`, and paste the prompt in [BUILD_PROMPT.md](BUILD_PROMPT.md). This folder is the starting repository.

## Reading order
PRD → IDENTITY → Design (+ design/README) → appflow → TRD → ARCHITECTURE → DATABASE → API → RAG → PROMPTS → SECURITY → TESTING → DEPLOYMENT → IMPLEMENTATION_PLAN → ACCEPTANCE_CRITERIA

## Boundaries
This package is specification and design only. No application code was generated, deployed, tested or security-audited. The HTML previews are static design references, not app code.
Never commit real credentials. Never expose the xAI key via `NEXT_PUBLIC_` variables.
