# Answer the Set with Explanation-First Feedback (S-02) Implementation Plan

## Overview

Turn the read-only question list from S-01 into an interactive answering session. A
signed-in developer answers the freshly generated set **one question at a time**:
select an option, submit it, and immediately see whether it was correct — with the
correct option highlighted and an explanation-first rationale. After the last
question they see an **overall score** (X/N + percentage) and can start a new set or
review every question.

This satisfies FR-006 (answer one at a time, immediate feedback), FR-007
(explanation-first), and the FR-008 **overall score** (the per-topic breakdown is
S-04). It is the second half of the product bet — explanation-first teaching, not
answer recall.

## Current State Analysis

S-01 shipped a working generation surface:

- `POST /api/practice/generate` ([src/pages/api/practice/generate.ts](src/pages/api/practice/generate.ts)) is auth-gated, zod-validated, and returns the engine's `GenerationResult` JSON **including `correctOptionId` and `explanation`** for every question.
- The `PracticeGenerator` island ([src/components/practice/PracticeGenerator.tsx](src/components/practice/PracticeGenerator.tsx)) drives a form → loading → `done` state machine via a `Status = "idle" | "loading" | "done" | "error"` union, then maps the returned `Question[]` to read-only cards.
- `QuestionCard` ([src/components/practice/QuestionCard.tsx](src/components/practice/QuestionCard.tsx)) renders stem + 4 options + topic and **deliberately hides the answer** (its doc comment says "No answer revealed (that's S-02)").
- The question contract ([src/lib/services/question-schema.ts](src/lib/services/question-schema.ts), [src/types.ts](src/types.ts)): each `Question` has `id`, `stem`, `options: {id, text}[]` (exactly 4), `correctOptionId` (guaranteed by a schema `.refine` to match an option id), `explanation`, `topic`.
- Tests: Vitest is wired; the precedent is engine-mocked **API-route unit tests** ([src/pages/api/practice/generate.test.ts](src/pages/api/practice/generate.test.ts)). There is **no React component-test infra** (explicitly out of scope in S-01).
- `supabase/migrations` is empty — no application tables exist yet.

### Key Discoveries:

- **Answers are already on the client.** The grade can be computed in the browser by comparing the user's pick to `question.correctOptionId` — no new API call, which makes the "feedback within 1 second" NFR instant. ([src/types.ts:25](src/types.ts#L25))
- **The schema guarantees `correctOptionId` matches a real option** ([src/lib/services/question-schema.ts:26](src/lib/services/question-schema.ts#L26)), so the UI never has to handle a "no correct option" case.
- **The island already owns the questions** in React state ([src/components/practice/PracticeGenerator.tsx:38](src/components/practice/PracticeGenerator.tsx#L38)), so extending it with `answering`/`summary` modes keeps everything in one place — no cross-route state passing.
- **`QuestionCard` is the natural seam.** It already renders the options list; the answering UI evolves it rather than introducing a parallel renderer.

## Desired End State

On `/practice`, after generating a set the user enters an answering flow: a header
shows "Question X of N" and a running correct count; each question shows its 4
options as selectable controls with a Submit button (disabled until an option is
picked). Submitting locks the answer and reveals feedback — a correct/incorrect
verdict, the correct option highlighted (and the user's wrong pick marked), and the
explanation. A Next control advances; there is no going back and no skipping. After
the final question a summary shows the overall score (X/N + %) with "New practice
set" and "Review answers" actions; the review is a collapsed per-question list that
expands to show that question's feedback.

Verification: a signed-in user can generate a set, answer every question with
visible per-question feedback, reach a correct overall score, review answers, and
start a new set — all without a page reload triggering a network call per answer.

## What We're NOT Doing

- **No persistence** — sessions are in-memory; a refresh restarts. Saving/history is S-03.
- **No per-topic/domain breakdown and no progress dashboard** — S-04 (overall score only here).
- **No retry-weak-topics** — S-05.
- **No backend/API changes** — the generate route and engine are untouched.
- **No back-navigation or skipping** mid-session — forward-only, must answer to proceed.
- **No sessionStorage / beforeunload guard** — in-memory only is acceptable for ≤5-question sets.
- **No new React component-test infra** — logic is unit-tested pure; UI is verified manually.
- **No batch/real-exam mode** — study mode (immediate per-question feedback) only.

## Implementation Approach

Three phases, bottom-up. **Phase 1** extracts the session lifecycle (scoring,
progression, completion) into a pure, dependency-free module with Vitest unit tests —
this isolates the trust-sensitive logic (grading) from rendering. **Phase 2** adds
the `answering` mode to the existing `PracticeGenerator` mode machine and evolves
`QuestionCard` into an interactive card (select → submit → feedback). **Phase 3**
adds the `summary` mode (overall score + actions) and the collapsed review list.

The `Status` union in the island is widened from `idle | loading | done | error`
into a mode that distinguishes `answering` and `summary` (replacing the old `done`
state, which only rendered a static list). Question payloads are unchanged.

## Critical Implementation Details

**State sequencing** — within a single question the order is fixed: an option may be
selected/changed freely *until* Submit; Submit grades and locks the question (option
controls become non-interactive and feedback appears); only then is Next enabled.
Selecting must not grade; Next must not appear pre-submit. The running correct count
increments at Submit time, exactly once per question.

## Phase 1: Session logic (pure, tested)

### Overview

Create a pure module that models an in-progress answering session and its scoring,
plus the shared types. No React, no I/O — fully unit-testable.

### Changes Required:

#### 1. Session state + transitions module

**File**: `src/lib/practice/session.ts` (new)

**Intent**: Model the answering session as plain data + pure transition functions so
the trust-sensitive grading logic is testable in isolation from the UI.

**Contract**: Exposes a `PracticeSession` shape and pure functions over it. Suggested
surface (implementer may refine names):
- `createSession(questions: Question[]): PracticeSession` — starts at index 0, no answers recorded.
- A per-question record capturing the user's `selectedOptionId` and whether it was `correct` (derived by comparing to `correctOptionId`).
- `submitAnswer(session, selectedOptionId): PracticeSession` — records the answer for the current question and marks correctness; idempotent/guarded so a question can't be re-graded.
- `advance(session): PracticeSession` — moves to the next question (only valid once the current one is answered).
- Derived selectors: `currentQuestion`, `answeredCount`, `correctCount`, `isComplete` (all questions answered and advanced past the last), `score` → `{ correct, total, percentage }`.
- Percentage rounding rule decided here (e.g. round to nearest integer) so tests pin it.

#### 2. Session types

**File**: `src/types.ts`

**Intent**: Add the S-02 session types alongside the existing question-generation contract, keeping one types home.

**Contract**: Export `PracticeSession`, the per-question answer record type, and a `SessionScore` (`{ correct: number; total: number; percentage: number }`). Reference the existing `Question` type. Update the contract comment (currently "consumed by S-01, S-02, S-04") as appropriate.

#### 3. Session logic unit tests

**File**: `src/lib/practice/session.test.ts` (new)

**Intent**: Pin the grading and progression rules — the part a regression would most damage.

**Contract**: Cover: correct vs incorrect grading against `correctOptionId`; `correctCount`/`score` aggregation including 0/N and N/N; percentage rounding; "cannot advance before answering"; "cannot re-grade an answered question"; `isComplete` only after the last question is answered and advanced. Mirror the existing Vitest style in [src/pages/api/practice/generate.test.ts](src/pages/api/practice/generate.test.ts).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` (astro check) or the project's typecheck script
- Linting passes: `npm run lint`
- Session unit tests pass: `npx vitest run src/lib/practice/session.test.ts`
- Full test suite passes: `npx vitest run`

#### Manual Verification:

- The module has no React/DOM/`astro:env` imports (stays pure and portable).

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding. Phase blocks use plain bullets — checkbox state lives in `## Progress`.

---

## Phase 2: Answering flow UI

### Overview

Add the `answering` mode to the `PracticeGenerator` island and make `QuestionCard`
interactive: select an option, submit, see explanation-first feedback, advance. Show
the progress + running-score header. Forward-only, no skip.

### Changes Required:

#### 1. Mode machine in the island

**File**: `src/components/practice/PracticeGenerator.tsx`

**Intent**: Replace the static `done` state with an `answering` mode driven by the Phase 1 session, transitioning generate → answering. Keep loading/error UX intact.

**Contract**: Widen the status/mode model so a successful generation initializes a `PracticeSession` (via `createSession`) and enters `answering` instead of rendering the read-only list. Hold the session in React state; wire `submitAnswer`/`advance` to the card's callbacks; transition to `summary` (Phase 3) when `isComplete`. The low-confidence banner still shows when `confidence === "low"`. The generator form remains the entry point for a new set.

#### 2. Interactive question card

**File**: `src/components/practice/QuestionCard.tsx`

**Intent**: Evolve the read-only card into an answerable one: selectable options, a Submit button, and post-submit feedback (verdict badge + correct/wrong highlighting + explanation-first text). Update the doc comment (no longer "no answer revealed").

**Contract**: New props — the `question`, `index`, a `selectedOptionId | null`, an `answered`/locked flag, and `onSelect`/`onSubmit` callbacks (state is owned by the island/session, not the card). Options render as accessible controls (radio-group semantics — `getByRole` per `.claude/rules/e2e.md`); Submit is disabled until an option is selected and hidden/disabled after submit. After submit: show a correct/incorrect verdict, highlight `correctOptionId` (green) and the user's pick if wrong (red), and render the `explanation` as the leading "why" block per FR-007. Selecting must not grade.

#### 3. Progress + running-score header

**File**: `src/components/practice/PracticeGenerator.tsx` (or a small extracted sub-component)

**Intent**: Orient the user and give live feedback.

**Contract**: Render "Question X of N" using the session's current index + total, and a running correct count from `correctCount`. A Next control (enabled only after submit) calls `advance`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` / typecheck script
- Linting passes: `npm run lint`
- Full test suite passes: `npx vitest run`

#### Manual Verification:

- Generating a set enters the answering flow (no static list); Submit is disabled until an option is chosen.
- After Submit, the verdict shows, the correct option is highlighted, a wrong pick is marked, and the explanation leads; the answer is locked.
- Next advances; there is no Back and no Skip; the running correct count is accurate.
- Feedback appears within ~1s of Submit (no network round-trip).
- Low-confidence banner still appears for low-confidence sets.

**Implementation Note**: Pause for manual confirmation after automated verification passes before proceeding.

---

## Phase 3: Summary + review

### Overview

Add the `summary` mode shown after the last question: overall score, "New practice
set" and "Review answers" actions, and a collapsed per-question review that expands
to the feedback rendering.

### Changes Required:

#### 1. Summary mode

**File**: `src/components/practice/PracticeGenerator.tsx`

**Intent**: When the session `isComplete`, show the overall score and the two actions.

**Contract**: Render `score` as "X / N correct (P%)". "New practice set" resets the island to the generator form (clears the session). "Review answers" reveals the review list (Change #2). The generator form is not shown alongside the summary (it returns via the New-set action).

#### 2. Review list (collapsed, expandable)

**File**: `src/components/practice/SessionReview.tsx` (new) — or a section within the island

**Intent**: Let the user re-study every question after seeing the score.

**Contract**: One row per question showing the number and a correct/incorrect indicator; clicking a row expands to that question's feedback (stem, options with correct/your-pick highlighting, explanation) — reusing the Phase 2 feedback rendering in a static, locked form. Rows are collapsed by default. Use accessible disclosure semantics (`getByRole` button/region) per the e2e rules.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` / typecheck script
- Linting passes: `npm run lint`
- Full test suite passes: `npx vitest run`

#### Manual Verification:

- After the last question, the summary shows the correct overall score and percentage.
- "New practice set" returns to the generator form with a clean slate (no leftover session).
- "Review answers" shows a collapsed list; each row expands to that question's correct/wrong highlighting and explanation.
- A page refresh during a session restarts at the generator (in-memory only — expected).

**Implementation Note**: Pause for manual confirmation after automated verification passes.

---

## Testing Strategy

### Unit Tests (Phase 1, Vitest):

- Grading correctness against `correctOptionId` (correct and incorrect picks).
- `correctCount` / `score` aggregation across 0/N, partial, and N/N.
- Percentage rounding rule.
- Guards: cannot advance before answering; cannot re-grade an answered question.
- `isComplete` only after the last question is answered and advanced.

### Manual Testing Steps:

1. Sign in, go to `/practice`, generate a small set (count 3).
2. Verify Submit is disabled until an option is selected.
3. Answer correctly → green highlight + correct verdict + explanation leads; answer incorrectly on another → wrong pick marked red, correct option green.
4. Confirm no Back/Skip; running count and "Question X of N" are accurate.
5. Finish → summary shows correct X/N + %.
6. "Review answers" → collapsed rows expand to per-question feedback.
7. "New practice set" → back to a clean generator form.
8. Refresh mid-session → returns to generator (expected, in-memory).

## Performance Considerations

Grading is in-memory comparison — feedback is effectively instant, satisfying the
<1s feedback NFR with margin. No new network calls per answer.

## Migration Notes

None — no schema or data changes (persistence is S-03).

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-02)
- PRD: FR-006, FR-007, FR-008; NFR (feedback < 1s); `context/foundation/prd.md`
- Prior slice (S-01): `context/archive/2026-06-18-generate-first-practice-set/plan.md`
- Question contract: [src/lib/services/question-schema.ts](src/lib/services/question-schema.ts), [src/types.ts](src/types.ts)
- Test precedent: [src/pages/api/practice/generate.test.ts](src/pages/api/practice/generate.test.ts)
- E2E conventions: `.claude/rules/e2e.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Session logic (pure, tested)

#### Automated

- [x] 1.1 Type checking passes (build / typecheck script) — d2f9fca
- [x] 1.2 Linting passes (`npm run lint`) — d2f9fca
- [x] 1.3 Session unit tests pass (`npx vitest run src/lib/practice/session.test.ts`) — d2f9fca
- [x] 1.4 Full test suite passes (`npx vitest run`) — d2f9fca

#### Manual

- [x] 1.5 Module has no React/DOM/`astro:env` imports (stays pure) — d2f9fca

### Phase 2: Answering flow UI

#### Automated

- [x] 2.1 Type checking passes
- [x] 2.2 Linting passes
- [x] 2.3 Full test suite passes

#### Manual

- [x] 2.4 Generating enters the answering flow; Submit disabled until an option is chosen
- [x] 2.5 After Submit: verdict shown, correct highlighted, wrong pick marked, explanation leads, answer locked
- [x] 2.6 Next advances; no Back/Skip; running correct count accurate
- [x] 2.7 Feedback appears within ~1s (no network round-trip)
- [x] 2.8 Low-confidence banner still appears for low-confidence sets

### Phase 3: Summary + review

#### Automated

- [ ] 3.1 Type checking passes
- [ ] 3.2 Linting passes
- [ ] 3.3 Full test suite passes

#### Manual

- [ ] 3.4 Summary shows correct overall score + percentage
- [ ] 3.5 "New practice set" returns to a clean generator form
- [ ] 3.6 "Review answers" shows collapsed rows expanding to per-question feedback
- [ ] 3.7 Refresh mid-session restarts at the generator (in-memory, expected)
