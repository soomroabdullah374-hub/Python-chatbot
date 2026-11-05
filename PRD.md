# CodeBloom Product Requirements

## Problem
Beginners meet explanations that assume too much, dump large code, or fix errors without teaching the concept. Sign-up walls add friction before the first question. CodeBloom turns a question into an understandable explanation and a manageable next step — with no account required.

## Objective
Help a learner understand one concept or mistake at a time, optimizing for clarity, correctness and learner agency, starting within seconds of opening the site.

## Users
First-time learners, university beginners, self-taught learners, early-career developers. Initial release assumes adults.

## Jobs to be done
Explain new concepts without assumed jargon; help me understand why code fails; give me small practice; re-explain differently; let me continue later on this device; let me start without creating an account.

## Pedagogy note
Design draws on programming-education ideas such as PRIMM (Predict, Run, Investigate, Modify, Make), worked examples and code reading. Classroom findings do not prove an AI chatbot yields the same outcomes; measure separately.

## MVP requirements
| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Start without an account: invisible anonymous session, no login UI (IDENTITY.md) | Must |
| FR-02 | Private conversations, scoped to the anonymous session | Must |
| FR-03 | Stream beginner-friendly answers | Must |
| FR-04 | Explain concepts | Must |
| FR-05 | Explain pasted code and likely errors | Must |
| FR-06 | Small exercises and progressive hints | Must |
| FR-07 | Readable, copyable code blocks | Must |
| FR-08 | Stop generation | Must |
| FR-09 | Retry failed turns without duplicates | Must |
| FR-10 | Retrieve approved learning material | Must |
| FR-11 | Show validated references | Must |
| FR-12 | Rename/delete conversations; delete all conversations | Must |
| FR-13 | Server-side usage limits (per session, per IP, global) | Must |
| FR-14 | Delete all my data (fresh start) | Must |
| FR-15 | Save explanations | Should |
| FR-16 | Helpful/not-helpful feedback | Should |
| FR-17 | Learning preferences (onboarding + settings) | Should |
| FR-18 | Title search | Should |
| FR-19 | Roman Urdu explanations (beta) | Could |

## Tutor behavior
Do: answer the question first; define terms; one minimal example; explain important lines; state assumptions; ask one focused clarification; flag uncertainty; offer practice; stay encouraging.
Don't: pretend to execute code; invent references; go needlessly advanced; shame; reveal hidden reasoning; obey retrieved instructions; claim certainty on ambiguous errors.

## Modes
- Explain: short answer → explanation → example → what the code does → common mistake → optional check.
- Debug: likely problem → minimal fix (diff) → why → local test. Always labelled "Not executed".
- Practice: exercise → attempt → feedback → progressive hints (3) → full solution on request → understanding check.

## Grounding
Use approved references when relevant. If none found, answer generally but do not imply knowledge-base verification.

## Proposed success metrics (targets, not results)
| Metric | Target |
|---|---|
| Expert-reviewed correctness | >= 90% on release eval set |
| Beginner clarity | mean >= 4/5 |
| Time from landing to first streamed token | median < 10 s on agreed profile |
| Source attribution | no fabricated source IDs |
| Private-data isolation | all authorization tests pass (two anonymous sessions) |
| Duplicate persistence | zero in retry tests |
| Accessibility | no critical issues in tested core journeys |
Learning improvement needs separate consented research; completion rate is not evidence of learning.

## Non-functional
Responsive >= 320px; keyboard-accessible; reduced-motion support; clear outage handling; no secret leakage; durable history on the same browser; defined limits and cost controls; visible privacy info.

## Out of scope
Accounts and login of any kind, cross-device sync, running code, full IDE, repo analysis, auto-grading, certified-outcome claims, unrestricted web search, public uploads, classroom administration.

## Privacy
Private by default; no personal identifiers collected; notice that prompts go to xAI; warn against pasting secrets; explain that history lives with this browser and is visible to anyone using the same browser profile; conversation deletion; delete-all-data; inactivity cleanup period disclosed; documented backup/provider retention.

## Release gate
Security, functionality, pedagogy and accessibility criteria in ACCEPTANCE_CRITERIA.md satisfied.
