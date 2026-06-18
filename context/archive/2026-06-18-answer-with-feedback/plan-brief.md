# Answer the Set with Explanation-First Feedback (S-02) — Plan Brief

> Full plan: `context/changes/answer-with-feedback/plan.md`

## What & Why

The second half of the product bet: let a signed-in developer answer the freshly
generated set **one question at a time**, see immediate explanation-first feedback
after each, and finish with an overall score. This proves the product teaches the
*why* of correct answers rather than rewarding answer-recall (FR-006, FR-007,
FR-008 overall score).

## Starting Point

S-01 ships `/practice`: an auth-gated island that generates a set and renders it as
**read-only** cards. Crucially, the generate API already returns `correctOptionId`
and `explanation` in the payload — `QuestionCard` just hides them. So S-02 grades
**entirely client-side**, with no backend, API, or persistence work. Vitest is
wired (API-route unit-test precedent); there is no DB yet and no component-test infra.

## Desired End State

After generating, the user enters an answering flow: "Question X of N" + a running
correct count; each question shows selectable options + a Submit button (disabled
until a pick). Submit locks the answer and reveals a verdict, highlights the correct
option (and a wrong pick), and leads with the explanation. Next advances (no back,
no skip). After the last question, a summary shows the overall score (X/N + %) with
"New practice set" and "Review answers" (a collapsed, expandable per-question recap).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Navigation | Forward-only, one at a time | Matches FR-006; simplest state machine; feedback is final | Plan |
| Commit model | Select then explicit Submit | Deliberate commit, prevents misclick grading | Plan |
| Architecture | Extend the island into a mode machine (generate → answering → summary) | Questions already live there; no cross-route state passing; easiest for S-03 later | Plan |
| Score scope | Overall score only | Per-topic breakdown is S-04; keeps the slice vertical-thin | Plan |
| Feedback UX | Verdict badge + correct/wrong option highlighting + explanation-first | Visual correctness cue while explanation leads (FR-007) | Plan |
| Progress | "Question X of N" + running correct count | Orients the user; trivial from in-memory state | Plan |
| Skipping | No skip — must answer to proceed | Unambiguous score denominator; feedback always shown | Plan |
| Post-session | New practice set + Review answers | Covers "go again" and "study what I missed" | Plan |
| Review screen | Collapsed list, expand per question | Compact overview; explanation revealed on demand | Plan |
| Testing | Pure scoring/flow module + Vitest unit tests; manual UI verify | Covers trust-sensitive logic without new infra (S-01 precedent) | Plan |
| Session state | In-memory only — refresh restarts | Honest to the "persistence is S-03" boundary; short sets | Plan |

## Scope

**In scope:** a pure session/scoring module + unit tests; an `answering` mode in the
island; an interactive `QuestionCard` (select → submit → explanation-first feedback);
progress + running-score header; a `summary` mode (overall score + actions); a
collapsed/expandable review list.

**Out of scope:** persistence/history (S-03); per-topic breakdown + dashboard (S-04);
retry-weak-topics (S-05); backend/API/engine changes; back-navigation; skipping;
sessionStorage/beforeunload; new component-test infra; batch/real-exam mode.

## Architecture / Approach

Bottom-up: (1) a pure `src/lib/practice/session.ts` models the session and scoring
(grading by comparing the pick to `correctOptionId`) with Vitest tests; (2) the
`PracticeGenerator` island widens its status model to drive generate → answering →
summary, holding a `PracticeSession` in React state and evolving `QuestionCard` into
an answerable card; (3) the summary + a `SessionReview` list close the loop. No
network call per answer — feedback is instant.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Session logic (pure, tested) | `session.ts` + types + Vitest unit tests for grading/progression | Getting the scoring/guard rules right (re-grade, advance-before-answer) |
| 2. Answering flow UI | `answering` mode + interactive `QuestionCard` + progress header | State sequencing: select ≠ grade; lock + feedback only on Submit |
| 3. Summary + review | `summary` mode (score + actions) + collapsed/expandable review | Reusing feedback rendering cleanly in a static, locked form |

**Prerequisites:** S-01 done (it is); Supabase + `OPENROUTER_API_KEY` configured locally to exercise the gated flow end-to-end.
**Estimated effort:** ~1–2 focused sessions across three phases.

## Open Risks & Assumptions

- Assumes the in-memory session is acceptable UX for ≤5-question sets (a refresh loses progress — by design until S-03).
- Assumes evolving `QuestionCard` in place (vs a parallel component) stays clean; if the read-only vs interactive branches diverge too much, a split may be warranted.
- The "verdict badge + explanation-first" layout must keep the explanation visually primary to honor FR-007's ordering intent.

## Success Criteria (Summary)

- A signed-in user answers a generated set one question at a time with explanation-first feedback after each, and finishes with a correct overall score.
- Feedback is immediate (no per-answer network call), Submit-gated, forward-only, and never skippable.
- The summary offers a new set and a reviewable recap; a refresh cleanly restarts (in-memory, expected).
