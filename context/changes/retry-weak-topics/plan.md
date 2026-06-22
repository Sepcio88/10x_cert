# Retry Fresh Questions on Weak Topics (S-05) Implementation Plan

## Overview

Deliver the last roadmap slice (FR-011): let a developer start a new session of **freshly
generated** questions (not a replay) targeting the exam topics they've historically been
weakest on. Builds on F-01 (generation), S-03 (persistence), and S-04 (per-topic breakdown).
Adds optional topic targeting to the generation engine, computes per-exam weak topics
(sub-70% accuracy, all-time) on the dashboard, and a "Retry weak topics" launch that
pre-fills `/practice` and auto-generates a targeted set — which then flows through the
existing answer → feedback → save loop unchanged.

## Current State Analysis

- **Generation takes only exam + count.** `generateQuestions({ exam, count })`
  ([question-generator.ts:49](src/lib/services/question-generator.ts#L49)) builds a
  system+user prompt in `buildMessages(exam, count)` ([:11-34](src/lib/services/question-generator.ts#L11-L34)).
  There is no way to steer toward specific topics today.
- **The endpoint passes exam + count straight through.** `/api/practice/generate`
  ([generate.ts](src/pages/api/practice/generate.ts)) validates `{ provider, exam, count }`
  and calls `generateQuestions({ exam: \`${provider} ${exam}\`, count })`.
- **The whole loop lives in one island.** `PracticeGenerator` ([PracticeGenerator.tsx](src/components/practice/PracticeGenerator.tsx))
  owns generate → answer → feedback → summary → save, on `/practice`. Its `generate()`
  posts `{ provider, exam, count }`.
- **Per-topic logic exists; cross-session does not.** S-04's `topicBreakdown(session)`
  ([session.ts](src/lib/practice/session.ts)) gives per-session per-topic correct/total. The
  cross-session aggregation needed to define "weak topics" was explicitly deferred from S-04 to here.
- **`listSessions` returns summaries, not payloads** ([sessions.ts](src/lib/db/sessions.ts)) —
  it selects score/metadata columns only. Weak-topic accuracy needs each session's
  `payload.questions[].topic` + `payload.answers[].correct`, so a full-payload read is required.
- **Dashboard already SSR-fetches sessions** ([dashboard.astro](src/pages/dashboard.astro))
  and hands them to `ProgressDashboard` ([ProgressDashboard.tsx](src/components/dashboard/ProgressDashboard.tsx)),
  which groups by exam and has a selected-exam dropdown — the natural host for a per-exam retry button.

## Desired End State

On `/dashboard`, for an exam where the user has historically weak topics (sub-70% all-time),
a "Retry weak topics" button appears; clicking it opens `/practice` pre-filled for that exam
and auto-generates a fresh set focused on those weak topics. The user answers it with the
normal explanation-first feedback, and it saves as an ordinary session — which in turn feeds
future weak-topic calculations. When an exam has no weak topics (or too little data), the
retry affordance is hidden with a short explanation.

**Verify:** with a history that has a sub-70% topic, the dashboard shows the retry button →
clicking generates a set whose questions target the weak topic(s) → it answers and saves
normally → an all-≥70% exam shows no button.

### Key Discoveries:

- Topic targeting is an additive, backward-compatible extension: optional `topics?: string[]`
  threaded into `buildMessages` as a "focus on these domains" instruction.
- Weak topics must be computed server-side (payloads stay off the client): the dashboard page
  loads full sessions, computes a `weakTopicsByExam` map, and passes only that map + the
  existing summaries to the island.
- A retry is just another session — no schema change, no new "retry" marker; the existing
  save-on-complete (S-03) handles it, and a strong retry naturally lifts a topic out of "weak".

## What We're NOT Doing

- **No schema change, no new table/column** — retries are normal sessions; questions already carry `topic`.
- **No new "retry" session type or marker** in the database or history.
- **No summary-only / in-session retry** — the entry point is the dashboard (cross-session, per exam) only.
- **No general-question fill** — every retry question targets a weak topic (the model spreads N across them).
- **No exam blending** — weak topics are computed per exam, never across exams.
- **No recency window** — weak topics use all of an exam's sessions (all-time).
- **No new chart/Playwright/E2E harness** — unit-test the aggregation + targeting; manual for generation + launch.

## Implementation Approach

Three layered phases. Phase 1 extends the generation contract + endpoint to accept optional
target topics (pure, testable). Phase 2 adds the cross-session weak-topics aggregation (pure)
plus a server-only full-session read, and surfaces a per-exam "Retry weak topics" button on
the dashboard that links to `/practice` with `provider`/`exam`/`topics` query params. Phase 3
teaches `PracticeGenerator` to read those params and auto-start a targeted generation, after
which the existing answer/save loop runs untouched.

## Critical Implementation Details

- **Threshold + ordering.** A topic is weak when its all-time `correct/total` across an exam's
  sessions is `< 70%` (define a `WEAK_TOPIC_THRESHOLD` constant). Emit weak topics weakest-first
  (lowest percentage first) so the generation focuses on the biggest gaps when count is small.
- **Topics in the URL.** The dashboard passes the weak topics as a CSV `topics` query param;
  `PracticeGenerator` must URL-decode and split. Keep the list short (it's already ≤ the exam's
  topic count). Provider must be one of `AWS|Azure|GCP` — validate on read, ignore retry params if invalid.
- **Count vs targeting.** The retry reuses the normal 1–5 count picker; topics ride alongside
  count in the generate call. On a param-driven launch, auto-start at the current default count;
  the picker remains available to regenerate.

## Phase 1: Targeted generation (F-01 extension)

### Overview

Let the generation engine and its endpoint accept optional target topics, steering the prompt
without changing any stored data shape.

### Changes Required:

#### 1. Extend the generation input + prompt

**File**: `src/types.ts`, `src/lib/services/question-generator.ts`

**Intent**: Add optional `topics` to `GenerateQuestionsInput`; when present and non-empty,
`buildMessages` adds an instruction to focus the questions on those domains and spread the
requested count across them.

**Contract**: `GenerateQuestionsInput` gains `topics?: string[]`. `buildMessages(exam, count, topics?)`
appends a focus line only when `topics` is non-empty (omitted entirely otherwise, so normal
generation is byte-for-byte unchanged). No change to the response schema or `Question` shape.

#### 2. Pass topics through the endpoint

**File**: `src/pages/api/practice/generate.ts`

**Intent**: Accept an optional `topics` array in the request and forward it to `generateQuestions`.

**Contract**: zod request schema gains `topics: z.array(z.string().min(1)).optional()`; the
call becomes `generateQuestions({ exam: \`${provider} ${exam}\`, count, topics })`. Existing
`{ provider, exam, count }` requests stay valid.

#### 3. Unit tests

**File**: `src/lib/services/question-generator.test.ts` (extend), `src/pages/api/practice/generate.test.ts` (extend)

**Intent**: Cover the additive contract.

**Contract**: `buildMessages` (or a generation call with a mocked client) includes the topic
names in the prompt when `topics` is provided and omits the focus line when absent; the
endpoint accepts a body with `topics` and forwards it (assert the engine mock is called with `topics`).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Build passes: `npx astro sync && npm run build`

#### Manual Verification:

- A generate request with `topics` returns questions visibly concentrated on those topics
- A normal generate request (no `topics`) behaves exactly as before

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Weak-topic detection + dashboard retry entry

### Overview

Compute per-exam weak topics across history server-side and surface a "Retry weak topics"
launch on the dashboard.

### Changes Required:

#### 1. Pure weak-topics aggregation

**File**: `src/lib/practice/progress.ts` (extend)

**Intent**: Aggregate per-topic correct/total across all of an exam's session payloads and
return the topics below the weakness threshold, weakest-first.

**Contract**: `weakTopics(payloads: SessionPayload[], threshold = WEAK_TOPIC_THRESHOLD): string[]`
and `weakTopicsByExam(sessions: SavedSession[]): Record<string, string[]>` (group by `exam`,
apply `weakTopics` per group). Export `WEAK_TOPIC_THRESHOLD = 70`. Reuses the same per-topic
tallying idea as `topicBreakdown` but summed across sessions.

#### 2. Full-session data access (server-only)

**File**: `src/lib/db/sessions.ts` (extend)

**Intent**: Read the user's sessions WITH payloads so weak topics can be computed server-side.

**Contract**: `listSessionsFull(client, userId): Promise<SavedSession[]>` — same filter/order as
`listSessions` but selects the payload too and maps via the existing `rowToSaved`. `listSessions`
stays summary-only (history list doesn't need payloads).

#### 3. Compute the map on the dashboard

**File**: `src/pages/dashboard.astro`

**Intent**: Load full sessions, compute `weakTopicsByExam`, and pass it (plus the existing
summaries) to the island. Payloads do not cross to the client.

**Contract**: SSR calls `listSessionsFull(...)`, derives `weakTopicsByExam`, and renders
`<ProgressDashboard sessions={summaries} weakTopicsByExam={map} client:load />`. Summaries for
the trend are derived from the full list (or a parallel `listSessions`).

#### 4. Retry button in the dashboard island

**File**: `src/components/dashboard/ProgressDashboard.tsx`

**Intent**: For the selected exam, show a "Retry weak topics" button when that exam has weak
topics; otherwise show a short "no weak topics yet" note. The button links to `/practice` with
the exam + weak topics as query params.

**Contract**: new prop `weakTopicsByExam: Record<string, string[]>`. For `selected.exam`, if
`weakTopicsByExam[selected.exam]` is non-empty, render a link to
`/practice?provider=<provider>&exam=<exam>&topics=<csv>` (URL-encoded); else render the note.
Reuses existing button/link styling.

#### 5. Unit tests

**File**: `src/lib/practice/progress.test.ts` (extend)

**Intent**: Cover the aggregation + threshold + edges.

**Contract**: a topic below 70% across sessions is weak; a topic at/above 70% is not;
weakest-first ordering; per-exam grouping (no blending); empty/no-gaps → `[]`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Build passes: `npx astro sync && npm run build`

#### Manual Verification:

- An exam with a sub-70% topic shows the "Retry weak topics" button on the dashboard
- An exam where all topics are ≥70% shows the "no weak topics" note, no button
- The button's URL carries the right exam + weak topics

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: Retry launch wiring (PracticeGenerator)

### Overview

Teach the practice island to honor a retry launch from the dashboard and auto-start a targeted
generation.

### Changes Required:

#### 1. Read retry params + auto-start

**File**: `src/components/practice/PracticeGenerator.tsx`

**Intent**: On mount, read `provider`/`exam`/`topics` from the URL; if a valid retry launch,
pre-fill the form, hold the target topics, auto-start a targeted generation, and show a small
"Retrying weak topics: …" banner. Without retry params, behavior is unchanged.

**Contract**: parse `window.location.search` once on mount (validate provider against the
`PROVIDERS` enum; split `topics` CSV; ignore if absent/invalid). Store `retryTopics: string[]`.
`generate()` includes `topics: retryTopics` in the POST body when present. Auto-start fires once
at the default count; the count picker remains usable to regenerate (carrying the topics).

#### 2. Tests / verification

**File**: (covered by Phase 1 endpoint test for the `topics` body; this phase is UI wiring)

**Intent**: The param-reading + auto-start is verified manually end-to-end; no new unit test
infra for query-param parsing beyond keeping the function small and pure where practical.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npx astro sync && npm run build`
- `npm test` stays green

#### Manual Verification:

- Clicking "Retry weak topics" on the dashboard opens `/practice`, pre-filled, and auto-generates a targeted set
- The generated questions concentrate on the weak topics
- Answering completes and saves as a normal session (appears in history, feeds the dashboard)
- Visiting `/practice` directly (no params) works exactly as before

**Implementation Note**: After automated verification passes, pause for manual confirmation. Final phase → then `/10x-impl-review`.

---

## Testing Strategy

### Unit Tests:

- `buildMessages`/generation: prompt includes target topics when provided, omits the focus line when not
- `/api/practice/generate`: accepts + forwards `topics`
- `weakTopics`/`weakTopicsByExam`: sub-70% detection, weakest-first order, per-exam grouping, no-gaps → `[]`

### Manual Testing Steps:

1. Build a history with a clearly weak topic for an exam (answer that topic wrong across sessions)
2. Dashboard shows "Retry weak topics" for that exam; an all-strong exam does not
3. Click retry → `/practice` pre-fills + auto-generates → questions target the weak topic(s)
4. Answer + finish → saved as a normal session → reflected back in history/dashboard

## Performance Considerations

Small data per the PRD. `listSessionsFull` reads payloads for one user (single indexed query);
aggregation is in-memory over a handful of rows. Generation keeps F-01's ≤5-count / 9s-timeout budget.

## References

- Change notes (decisions): `context/changes/retry-weak-topics/change.md`
- Roadmap slice S-05 + FR-011: `context/foundation/roadmap.md`, `context/foundation/prd.md`
- Generation engine: `src/lib/services/question-generator.ts`, `src/lib/services/openrouter.ts`
- Reused: `src/lib/practice/{session,progress}.ts`, `src/lib/db/sessions.ts`, `src/components/dashboard/ProgressDashboard.tsx`, `src/components/practice/PracticeGenerator.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Targeted generation (F-01 extension)

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — 514b63c
- [x] 1.2 Lint passes: `npm run lint` — 514b63c
- [x] 1.3 Build passes: `npx astro sync && npm run build` — 514b63c

#### Manual

- [x] 1.4 A generate request with `topics` returns questions concentrated on those topics — 514b63c
- [x] 1.5 A normal generate request (no `topics`) behaves exactly as before — 514b63c

### Phase 2: Weak-topic detection + dashboard retry entry

#### Automated

- [x] 2.1 Unit tests pass: `npm test` — 66542bd
- [x] 2.2 Lint passes: `npm run lint` — 66542bd
- [x] 2.3 Build passes: `npx astro sync && npm run build` — 66542bd

#### Manual

- [x] 2.4 An exam with a sub-70% topic shows the "Retry weak topics" button — 66542bd
- [x] 2.5 An all-≥70% exam shows the "no weak topics" note, no button — 66542bd
- [x] 2.6 The button's URL carries the right exam + weak topics — 66542bd

### Phase 3: Retry launch wiring (PracticeGenerator)

#### Automated

- [x] 3.1 Lint passes: `npm run lint` — 0261d43
- [x] 3.2 Build passes: `npx astro sync && npm run build` — 0261d43
- [x] 3.3 `npm test` stays green — 0261d43

#### Manual

- [x] 3.4 Clicking retry opens `/practice` pre-filled and auto-generates a targeted set — 0261d43
- [x] 3.5 The generated questions concentrate on the weak topics — 0261d43
- [x] 3.6 Answering completes and saves as a normal session (history + dashboard updated) — 0261d43
- [x] 3.7 Visiting `/practice` directly (no params) works exactly as before — 0261d43
