# CodeBloom Application Flow

## Routes
| Route | Session | Purpose | Design |
|---|---|---|---|
| / | none needed | Landing | design/preview/landing.html |
| /onboarding | anonymous (created silently) | Preferences, skippable | onboarding.html |
| /chat | anonymous | New chat / empty state | chat-new.html |
| /chat/[conversationId] | owner only | Conversation (Explain / Debug / Practice) | chat-explain / chat-debug / chat-practice |
| /saved | anonymous | Saved explanations | saved.html |
| /settings | anonymous | Preferences, privacy, your data | settings.html |

There are **no** `/login`, `/signup`, `/logout` or `/auth/*` routes. Content administration is an operator workflow (CLI/script with service credentials), not a public route.

## First visit
Landing → "Start learning" → `/onboarding` → SessionGate silently creates an anonymous session (invisible Turnstile in production) → preferences (skippable, safe defaults) → `/chat` empty state. "Skip setup, open a chat" goes straight to `/chat`. A model request is only possible once a verified session exists.

## Return visit
Any workspace route → existing session refreshes → if `onboarded_at` is null and the learner hasn't skipped, `/onboarding`; otherwise last-visited conversation list in `/chat`.

## Onboarding
Collect only: preferred programming language, experience level, concise/detailed, explanation language. No name, email, age, school, phone or location. Progress bar counts answered questions. "Use defaults" and "Skip for now" both set `onboarded_at`.

## Starting a conversation
New chat → choose mode (or click a starter) → submit first message → backend atomically creates conversation + first turn → navigate to `/chat/[id]` → answer streams → final answer persisted before completion confirmed. Title derived from first prompt without an extra model call; renameable.

## Explain
Question → retrieve approved material → short answer + explanation + small example → simpler / more detail chips → practice → save.

## Debug
Paste small code → ask one focused question if needed → likely cause → minimal fix (diff) with explanation → suggested local test. Label "Not executed — based on reading your code".

## Practice
Pick concept → one small exercise → attempt → feedback → hint 1 → hint 2 → hint 3 (each on request) → full solution on request → understanding check. Progress panel tracks steps.

## Message lifecycle
draft → submitting → accepted → retrieving → streaming → saving → completed.
Terminal alternatives: rejected, failed, interrupted, incomplete. Only completed assistant responses enter future context. Status row shows the current stage (design: components §07).

## Recovery
- Validation: keep draft, explain fix.
- Session could not be created/restored: keep draft, banner "We couldn't restore your private session" + Reconnect (creates a new anonymous session; old history may be unreachable if cookies were cleared).
- Rate limit (session or IP): keep draft, show retry time.
- Provider outage: actionable retry; do not blame learner.
- Lost connection: reload authoritative state; no automatic second request.
- Save failure: "Answer received, but could not be saved"; not completed.

## Stop
Abort stream → send cancel request → backend attempts upstream cancel → partial text marked interrupted (banner + Retry) → explicit retry only. Cancellation is best effort; cost may already be incurred.

## Management
Rename; delete conversation with confirmation (removes messages and bookmarks; active generation invalidated; late writes cannot resurrect it); Settings → Delete all conversations; Settings → Delete all my data (fresh anonymous session afterwards).

## Leaving
There is no sign-out. Closing the tab keeps the session for the next visit on this browser. Settings explains how to start fresh (delete all my data) and that others using the same browser profile can see the history.
