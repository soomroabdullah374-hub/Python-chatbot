# CodeBloom Design Specification

Pixel-level reference lives in [`design/`](design/README.md): `design/cb.css` (tokens + components + motion), interactive previews in `design/preview/`, screenshots in `design/screenshots/`. When this document and the previews disagree, the previews win for visuals; this document wins for behaviour and accessibility.

## Direction
Calm, precise learning workspace: neutral near-white surfaces, deep ink text, one confident indigo, a small coral "bloom" accent, and a dark code surface. Supportive and focused — not a dense developer console. Marketing surfaces use a dark ink hero with a faint grid.

## Colors (`design/tokens.css`)
| Token | Value | Usage |
|---|---|---|
| bg | #FAFAF9 | App and page background |
| surface | #FFFFFF | Cards, dialogs, composer, panels |
| subtle | #F5F5F4 | Sidebar, table headers, section bands |
| sunken | #EFEFEE | Segmented-control track, skeletons, inline code |
| border | #E7E7E5 | Decorative separators |
| border-strong | #D7D7D4 | Card hover, secondary button border |
| control | #8B8B93 | Input/composer/switch boundaries (3.4:1 on white) |
| text | #17171C | Body |
| text-2 | #52525B | Secondary text |
| text-3 | #6B6B74 | Tertiary text, labels (≥4.5:1 on bg) |
| primary | #4F46E5 | Primary buttons, focus, links, Explain mode |
| primary-hover / press | #4338CA / #3730A3 | Hover / pressed |
| primary-soft | #EEF0FF | Selected states, user message bubble |
| accent | #F97362 | Logo centre only |
| debug | #D97706 | Debug mode dot/indicator |
| practice | #16A34A | Practice mode dot/indicator |
| success / warning / danger | #15803D / #B45309 / #DC2626 | Status text and icons |
| ink | #0B0B12 | Landing hero, CTA band, next-step card |
| code-bg / code-head | #11111B / #181824 | Code blocks |
| syntax | keyword #C4B5FD · string #86EFAC · number #FDBA74 · function #7DD3FC · comment #8D90A8 | Highlighting (all ≥4.5:1 on code-bg) |

Rules: colour is never the only signal (mode dots always sit beside a label; diffs use −/+ glyphs). Verify every final combination with a contrast tool (WCAG 2.2 AA: 4.5:1 text, 3:1 large text and UI boundaries).

## Typography
Geist (UI) and Geist Mono (code, metadata). Scale: display 72/1.0 −0.045em (48 on mobile); H2 44; H1 32; H3 20; answer lead 17; body/prose 15.5–16 with line-height 1.6–1.75; small 13; label 12 uppercase +0.06em; code 13.5 / 1.75. Weights 400/500/600 only; no thin weights for instruction text.

## Radii, elevation, spacing
Radii 6 / 8 / 12 / 16, pills 999 for chips only. Shadows xs/sm/md/lg (cb.css). 4-pt spacing grid; section rhythm 128 px desktop, 88 px mobile.

## Layout
- Desktop: sidebar 264 px; conversation column max 760–800 px; learning panel 300 px (Explain, Practice).
- Tablet: sidebar becomes a drawer; learning panel on demand (toggle in top bar).
- Mobile (390 reference, 320 minimum): single column; labelled **Menu** button opens the drawer; mode selector full width; composer pinned with safe-area padding; code scrolls inside its own box; no page overflow.

## Shell
Sidebar: brand, New chat, title search (`/` shortcut), conversations grouped by Today / Previous 7 days with mode dot, Saved explanations (count), Settings, and the footer note "Private to this browser · no account". **No avatar, email, sign-in or sign-out anywhere.** Top bar: title + rename, language select, mode segmented control, actions.

## Screens (see design/README.md for the full inventory)
Landing `/` · Onboarding `/onboarding` · New chat `/chat` · Conversation `/chat/[id]` (Explain, Debug-streaming, Practice) · Saved `/saved` · Settings `/settings` · Mobile chat + drawer · Components & states.

## Empty state
Headline "Programming, explained simply." Sub "Ask a question, paste a small code example, or explore a concept." Four starter cards (Python variables; let vs const; explain a SQL query; loop exercise). Clicking a starter fills the composer and sets the mode.

## Conversation
Document-like assistant responses: header (logo, "CodeBloom", mode badge, source count / "Not executed"), then labelled sections: Short answer, Simple explanation, Example (numbered code block with Copy), What the code does (line-referenced list), Common mistake (warning note), Check (dashed card). Don't force all sections; short questions get short answers. Sources as numbered cards. Actions: copy, save (toggles to "Saved"), helpful / not helpful (with thanks), retry. Follow-up chips below.

## Components
ChatComposer, ModeSelector, Message, CodeBlock (language, line numbers, highlight/diff rows, Copy → "Copied" + toast), SourceCard, FollowUpChip, ConversationList, FeedbackControl, BookmarkControl, Banner (warn/danger/info/success), StatusIndicator, ConfirmDialog, Toast, Switch, SegmentedControl, OptionCard (radio/check), Badge, Skeleton. Each needs hover / focus / disabled / error states — all specified in `design/preview/components.html`.

## Interaction
Enter sends on desktop (not during IME composition); Shift+Enter newline; setting to invert. Mobile always has a Send button. Stop replaces Send during generation and interrupts it. Do not auto-scroll if the user scrolled up; show "Jump to latest". Copy confirmation announced politely (`role="status"`). Removing a saved explanation shows an Undo toast for 4 s. Destructive actions use ConfirmDialog.

## Motion (all disabled under `prefers-reduced-motion` and the in-app Reduce motion switch)
| Element | Spec |
|---|---|
| Hover / press | 160 ms `cubic-bezier(.2,.8,.2,1)`; press translates 1 px |
| Message / section enter | 520 ms rise 10 px, 60 ms stagger (first render only) |
| Card lift | 220 ms, −3 px, shadow md |
| Toast / popover / dialog | 260 ms scale .97 → 1 |
| Drawer | 300 ms slide from left; scrim fade 260 ms |
| Streaming | blinking caret (1 s steps), pulsing dots, shimmer skeleton |
| Switch / segmented / progress | 200–500 ms transitions |
Never animate every streamed token into the accessibility tree; announce start / complete / interrupt / fail only.

## Accessibility (WCAG 2.2 AA)
Contrast as above; visible focus ring (2 px primary + 3 px ring on inputs); labelled icon buttons (`aria-label` + tooltip); real buttons/links/inputs; keyboard navigation; 44 px touch targets on mobile (24 px minimum); reduced motion; stable composer focus; no colour-only status; usable at 200% zoom and 320 px.

## Acceptance
Matches design/ previews; indigo/neutral palette consistent; all component states present; 320 px usable; long code never breaks layout; errors understandable to beginners; no login UI anywhere.
