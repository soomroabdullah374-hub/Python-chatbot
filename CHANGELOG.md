# Changelog

## v2 — 2026-11-05
### Removed
- All sign-up, sign-in, sign-out, password, email and OAuth flows, routes (`/login`, `/signup`, `/auth/callback`) and the Auth screen design.
- Account deletion "requires recent authentication" rule (there are no credentials).

### Added
- `IDENTITY.md`: invisible Supabase anonymous sessions, Turnstile CAPTCHA, per-IP quotas, inactivity cleanup, "Delete all my data".
- `design/`: shared stylesheet `cb.css`, tokens, 11 interactive HTML previews, screenshots, canvas sources, Tailwind mapping.
- `CLAUDE.md`, `BUILD_PROMPT.md` for Claude Code.
- Database: `profiles.onboarded_at`, `usage_ip_daily`, `data_deletion_jobs`; API: `POST /data-delete`, `DELETE /conversations` (all), `GET/PATCH /profile`.

### Changed
- Visual design: cream `#FFFFF0` / green `#075449` replaced by neutral `#FAFAF9`, indigo `#4F46E5`, coral accent `#F97362`, mode colours, dark code surface. Design.md, design/tokens.css and acceptance criteria updated.
- Settings "Account" section → "Your data". Sidebar account row → "Private to this browser · no account".
- First-visit flow: Landing → Onboarding (skippable) → Chat, with no auth step.
