# CodeBloom Development Agenda
(Preserves the requested filename; AGENTS.md holds canonical agent instructions.)

## Phase A: Foundation
Next.js + TS config, env templates, Tailwind theme from design/tokens.css, base components from design/cb.css, folder structure, ADRs, CI (format/lint/types). Exit: static shell and all screens render from fixtures without real credentials and match design/screenshots.

## Phase B: Silent identity and data
Supabase anonymous sign-ins + SessionGate (no login UI), Turnstile in staging, migrations, RLS + least-privilege grants, profile trigger, ownership tests. Exit: two anonymous browsers cannot see each other's data; no auth pages exist.

## Phase C: Tutor chat
Chat endpoint, server-only xAI integration, streaming, persistence, idempotency, stop/timeout/retry, per-session + per-IP usage limits. Exit: full lifecycle without exposing secrets.

## Phase D: Grounded explanations
Approved content manifest, chunking + embeddings, vector retrieval, validated source cards, weak-retrieval fallback, retrieval evals. Exit: references improve evaluated answers with no unpublished/private leakage.

## Phase E: Learning features
Explain/Debug/Practice, copy code, saved explanations (undo), feedback, preferences, title search, delete-all flows. Exit: each passes acceptance criteria.

## Phase F: Hardening
Accessibility, motion/reduced motion, security/abuse tests (session churn, IP limits), load/timeouts, cost monitoring, privacy notices, inactivity cleanup, runbooks. Exit: release checklist approved, limitations documented.

Phases are sequencing guidance, not a delivery estimate.
