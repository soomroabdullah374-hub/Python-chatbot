# CodeBloom design package

Everything needed to build the UI exactly. Open **`preview/index.html`** in a browser to click through every screen.

| Path | What it is | How to use it |
|---|---|---|
| `tokens.css` | Design tokens (`:root` custom properties) | Copy into `src/styles/tokens.css`; map into Tailwind (below) |
| `cb.css` | Full component + motion stylesheet the previews use | Port each class to a React component / Tailwind classes. Keep class semantics, values and transitions |
| `preview/*.html` | Standalone, clickable previews (offline; Geist fonts bundled) | The visual + interaction reference for each screen |
| `screenshots/*.png` | Full-page captures (desktop 1440 px @1x, mobile 390 px @2x) | Visual regression baselines |
| `screens.json` | Screen → route → preview → screenshot map | Drive visual tests from this list |
| `source/*.dc.html` | Editable canvas sources the previews are generated from | Read-only reference; do not ship |
| `preview/preview-runtime.js` | Tiny template runtime for the previews only | **Not app code.** Do not copy into the app |

## Screens
| Preview | Route | Notes |
|---|---|---|
| landing.html | `/` | Dark ink hero with product preview, modes, anatomy, principles, privacy, FAQ, CTA. "Start learning" → `/onboarding`; "Skip setup" → `/chat`. No sign-in link |
| onboarding.html | `/onboarding` | 4 preference groups, progress bar, Skip / Use defaults / Continue |
| chat-new.html | `/chat` | Empty state, 4 starters (click fills composer + mode), mode switch changes placeholder, Send disabled when empty |
| chat-explain.html | `/chat/[id]` | Full Explain answer anatomy, copy → Copied + toast, save toggle, feedback, chips, learning panel |
| chat-debug.html | `/chat/[id]` | Streaming state: caret, skeleton, status row, Jump to latest, **Stop** → interrupted banner + Retry |
| chat-practice.html | `/chat/[id]` | Exercise card, attempt with highlighted line, progressive hints (1→3), solution, progress panel |
| saved.html | `/saved` | Search, language filter, grid/list toggle, remove → Undo toast, empty state |
| settings.html | `/settings` | Preferences, composer switches, privacy, **Your data** (no account), delete dialogs |
| mobile-chat.html | 390 px | Menu button, full-width modes, pinned composer |
| mobile-drawer.html | 390 px | Sidebar as slide-in drawer with scrim |
| components.html | — | Every component and state, lifecycle, banners, motion table |

There is intentionally **no login, sign-up or account screen**. The sidebar footer reads "Private to this browser · no account".

## Tailwind v4 mapping (`src/app/globals.css`)
```css
@import "tailwindcss";
@import "../styles/tokens.css";

@theme inline {
  --color-bg: var(--bg);              --color-surface: var(--surface);
  --color-subtle: var(--subtle);      --color-sunken: var(--sunken);
  --color-border: var(--border);      --color-border-strong: var(--border-strong);
  --color-control: var(--control);
  --color-text: var(--text);          --color-text-2: var(--text-2);   --color-text-3: var(--text-3);
  --color-primary: var(--primary);    --color-primary-hover: var(--primary-hover);
  --color-primary-soft: var(--primary-soft); --color-primary-text: var(--primary-text);
  --color-accent: var(--accent);
  --color-explain: var(--explain);    --color-debug: var(--debug);     --color-practice: var(--practice);
  --color-success: var(--success);    --color-warning: var(--warning); --color-danger: var(--danger);
  --color-ink: var(--ink);            --color-code: var(--code-bg);    --color-code-head: var(--code-head);
  --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px;
  --shadow-xs: var(--sh-xs); --shadow-sm: var(--sh-sm); --shadow-md: var(--sh-md); --shadow-lg: var(--sh-lg);
  --font-sans: var(--font-geist-sans), var(--font);
  --font-mono: var(--font-geist-mono), var(--mono);
  --ease-out-cb: cubic-bezier(.2,.8,.2,1);
}
```
Fonts: `import { GeistSans } from "geist/font/sans"; import { GeistMono } from "geist/font/mono";` (or `next/font/google` Geist / Geist_Mono) and put their `variable` classes on `<html>`.

Keep the keyframes (`cb-rise`, `cb-pop`, `cb-blink`, `cb-pulse`, `cb-shimmer`, `cb-slide`, `cb-glow`, `cb-float`) and the `prefers-reduced-motion` block from `cb.css` in `globals.css`; add a `data-reduce-motion="true"` attribute on `<html>` driven by the Settings switch with the same overrides.

## Component map (cb.css class → component)
`.btn-*` → `Button` (variants primary, secondary, ghost, dark, light, outline-light, danger, danger-outline, link; sizes sm/md/lg/xl; icon) ·
`.input/.select/.field-*` → `Input`, `Select`, `Field` · `.seg/.seg-btn` → `SegmentedControl` (aria-pressed) · `.switch` → `Switch` (role=switch) ·
`.opt/.radio/.tick` → `OptionCard` · `.chip` → `FollowUpChip` · `.badge-*` → `Badge` / `ModeBadge` · `.card/.lift` → `Card` ·
`.code/.code-head/.code-rows/.row.add|del|hl` → `CodeBlock` (line numbers, diff, highlight, copy) · `.source` → `SourceCard` ·
`.msg-user/.msg-ai/.ai-head/.sec/.note/.check` → `Message` parts · `.composer` → `ChatComposer` · `.status/.dots/.caret/.skeleton/.spinner` → `StatusRow`, `StreamingCaret`, `Skeleton` ·
`.banner-*` → `Banner` · `.toast` → `Toast` · `.dialog` + `.scrim` → `ConfirmDialog` · `.side/.side-item` → `Sidebar`, `ConversationList` · `.topbar` → `TopBar` · `.panel` → `LearningPanel` · `.hero/.hero-grid/.window` → landing sections.

## Rules
- Use tokens only; no new hex values in components.
- Copy text in previews is final UI copy unless it is a `[PLACEHOLDER]`.
- Sample conversations in previews are fixtures — replace with live data.
- Rise animations run on first render only (previews disable them after mount).
