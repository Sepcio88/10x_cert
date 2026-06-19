# Per-topic Breakdown + Per-exam Progress Dashboard (S-04) Implementation Plan

## Overview

Deliver the two halves of roadmap slice S-04 on top of the persistence layer shipped in
S-03: a **per-topic/domain breakdown** of a session (FR-008) and a **per-exam progress
trend** on the home page (FR-010). Both read data that already exists — no migration, no
new query. The breakdown is a pure aggregation of a session's stored `topic` tags; the
trend is a hand-rolled SVG line of raw score % over time, per exam, defaulting to the
user's most-recently-practiced exam with a dropdown switcher.

## Current State Analysis

- **All data needed already exists** (S-03). `listSessions(client, userId)` returns every
  saved session as `SavedSessionSummary` (`id, provider, exam, correct, total, percentage,
  createdAt`) newest-first ([sessions.ts](src/lib/db/sessions.ts)) — exactly the trend's
  inputs. Each session's `payload.questions[]` carries a `topic` per question
  ([question-schema.ts:24](src/lib/services/question-schema.ts#L24)), and `payload.answers[]`
  is index-aligned with `questions` — exactly the breakdown's inputs.
- **No per-topic aggregation exists yet.** The summary shows overall score only
  ([PracticeGenerator.tsx:156-193](src/components/practice/PracticeGenerator.tsx#L156-L193));
  `SessionReview` shows a per-question topic tag but never groups by topic.
- **`/dashboard` is an authenticated stub** ([dashboard.astro](src/pages/dashboard.astro)) —
  a "Welcome, {email}" card. It's the natural home for the trend (FR-010 "home page"); `/`
  is the public landing (`Welcome`). Both `/dashboard` and `/history` are already gated by
  middleware.
- **No chart library** is installed (`package.json`) — the trend is hand-rolled SVG.
- **Pure-logic + island conventions are established.** `src/lib/practice/session.ts` holds
  pure, unit-tested functions; `SavedSessionView`/`HistoryList` are `client:load` React
  islands; styling is Tailwind via `cn()` with lucide icons.

## Desired End State

A signed-in developer who finishes (or revisits) a session sees a per-topic breakdown —
color-coded bars showing correct/total per domain — so they know which areas are weak.
On `/dashboard` they see a line chart of their score over time for one exam, default to the
exam they practiced most recently, with a dropdown to switch exams, a one-line caption, and
a link to full history. Exams are never blended; a one-session exam shows a single point with
a "do more" hint; a user with no sessions sees a CTA to start practicing.

**Verify:** finish a session → breakdown bars appear on the summary and on `/history/[id]`;
`/dashboard` shows the most-recent exam's trend; switching exams re-renders the line;
a fresh account sees the empty state.

### Key Discoveries:

- `listSessions` is already the dashboard's data source — the page does an SSR fetch and
  hands the array to a client island that groups by `exam` in JS. No new data-access.
- Per-topic correctness must be derived the same server-authoritative way as the score:
  group `answers` by their question's `topic`, counting `answer.correct`. The stored answers
  already carry server-recomputed `correct` (S-03), so a pure client-side grouping is sound.
- Reusing one `TopicBreakdown` component across the summary and the revisit detail mirrors
  how `SessionReview` is reused — both mount points already hold a `PracticeSession`-shaped object.

## What We're NOT Doing

- **No cross-session topic analytics** ("your weak topics across all AWS sessions") — that's
  S-05 (retry-weak-topics), which owns the "identify weak topics" definition. S-04's per-topic
  view is strictly per-session.
- **No chart library** and no axes/tooltips/zoom — a minimal SVG line only.
- **No rolling/cumulative average** — the trend plots raw % per session.
- **No new dashboard analytics** beyond the trend + switcher + caption + history link (no
  inline recent-sessions list, no big stats panel).
- **No schema change, no new API route** — pages read through the existing RLS-scoped client.
- **No component/render test harness** — unit tests cover the pure aggregations; UI is manual.

## Implementation Approach

Two independent, pure-function-first phases. Phase 1 adds `topicBreakdown` (pure) + a
`TopicBreakdown` bars component, mounted on the live summary and the saved-session revisit.
Phase 2 adds `progress.ts` (pure: group-by-exam, most-recent-exam, trend points) + a
`ProgressDashboard` island that renders an inline SVG line with a dropdown switcher and
thin/empty states, wired into `/dashboard` via an SSR `listSessions` fetch. Each phase's
risk lives in a pure function that gets unit-tested; the visual layer is verified manually.

## Critical Implementation Details

- **Topic order stability.** `topicBreakdown` should emit topics in first-appearance order
  of `questions` (not hash/Map-iteration randomness) so the bars render deterministically
  across summary and revisit for the same session.
- **SVG trend scaling.** The y-axis is fixed to 0–100% (scores are percentages) rather than
  auto-scaled to min/max — an auto-scaled axis makes an 80→82 wobble look dramatic and a
  flat line look noisy. Points are ordered by `createdAt` ascending (oldest→newest) even
  though `listSessions` returns newest-first.

## Phase 1: Per-topic breakdown (FR-008)

### Overview

Compute and display a per-topic/domain score breakdown for a session, shown on both the
post-session summary and the revisit detail via one shared component.

### Changes Required:

#### 1. Pure topic aggregation

**File**: `src/lib/practice/session.ts` (extend)

**Intent**: Add a pure function that groups a completed session's answers by their question's
`topic` and tallies correct/total/percentage per topic, in first-appearance order.

**Contract**: `topicBreakdown(session: PracticeSession): TopicScore[]` where
`TopicScore = { topic: string; correct: number; total: number; percentage: number }`
(add `TopicScore` to `src/types.ts`). Percentage rounding matches `score()` (nearest int;
0 when total 0). Order: first appearance of each topic in `session.questions`.

#### 2. Breakdown component

**File**: `src/components/practice/TopicBreakdown.tsx`

**Intent**: Render the `topicBreakdown` result as color-coded horizontal bars — one row per
topic with `correct/total`, `%`, and a Tailwind bar tinted by score (green/amber/red).

**Contract**: default-exported React component, props `{ session: PracticeSession }`; calls
`topicBreakdown(session)`; uses `cn()` for class merging; matches the existing card aesthetic.
Renders nothing (or a muted note) if there are no answers.

#### 3. Mount on the live summary

**File**: `src/components/practice/PracticeGenerator.tsx`

**Intent**: Show the breakdown in the summary block, under the overall score.

**Contract**: render `<TopicBreakdown session={session} />` within the `status === "summary"`
block ([PracticeGenerator.tsx:156-193](src/components/practice/PracticeGenerator.tsx#L156-L193)).

#### 4. Mount on the revisit detail

**File**: `src/components/practice/SavedSessionView.tsx`

**Intent**: Show the same breakdown above the per-question `SessionReview` on `/history/[id]`.

**Contract**: render `<TopicBreakdown session={session} />` (the reconstructed complete
session already built there) alongside `<SessionReview session={session} />`.

#### 5. Unit tests

**File**: `src/lib/practice/session.test.ts` (extend)

**Intent**: Cover `topicBreakdown` grouping.

**Contract**: multiple topics tallied correctly; single-topic session; all-correct/all-wrong
per topic; first-appearance ordering; percentage rounding.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Build passes: `npx astro sync && npm run build`

#### Manual Verification:

- Finishing a session shows the per-topic bars under the overall score on the summary
- Opening `/history/[id]` shows the same breakdown above the per-question review
- Bars are color-coded by score and read correctly (correct/total, %)

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Per-exam progress dashboard (FR-010)

### Overview

Aggregate the user's sessions per exam and render a score-over-time trend on `/dashboard`,
defaulting to the most-recently-practiced exam with a dropdown switcher, plus a caption,
a history link, and thin/empty-data handling.

### Changes Required:

#### 1. Pure progress aggregation

**File**: `src/lib/practice/progress.ts`

**Intent**: Pure helpers that turn the flat `SavedSessionSummary[]` into per-exam trend data,
without blending exams.

**Contract**:
`groupByExam(sessions: SavedSessionSummary[]): ExamProgress[]` where
`ExamProgress = { exam: string; provider: string; points: TrendPoint[]; latestAt: string }`
and `TrendPoint = { at: string; percentage: number }` ordered oldest→newest;
`mostRecentExam(groups: ExamProgress[]): string | null` (by latest `createdAt`).
Add `ExamProgress`/`TrendPoint` to `src/types.ts`. Group key is `exam` (provider carried for display).

#### 2. Progress dashboard island

**File**: `src/components/dashboard/ProgressDashboard.tsx`

**Intent**: Render the selected exam's trend as an inline SVG line (raw % per session, y-axis
fixed 0–100), with a dropdown to switch exams, a caption (e.g. "N sessions · latest X%"), and
a link to `/history`. Handle thin/empty data.

**Contract**: default-exported island, props `{ sessions: SavedSessionSummary[] }`. Builds
`groupByExam`, defaults selection to `mostRecentExam`, holds the selected exam in React state.
Dropdown is a `<select>` matching the PracticeGenerator select styling. Single-point exam:
render the point + a "complete more sessions on this exam to see a trend" caption. Zero
sessions: an empty state with a link to `/practice` (mirrors the `/history` empty state). SVG
line is hand-rolled (points scaled to a fixed 0–100 y-range, ordered by time).

#### 3. Wire into the dashboard page

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the stub body with an SSR fetch of the user's sessions handed to the island.

**Contract**: build the RLS-scoped client via `createClient(...)`, call
`listSessions(client, user.id)`, render `<ProgressDashboard sessions={...} client:load />`
inside the existing Layout. Keep `prerender = false` semantics (SSR). Preserve the page's
auth (already guarded by middleware).

#### 4. Unit tests

**File**: `src/lib/practice/progress.test.ts`

**Intent**: Cover the aggregation + ordering + edge cases.

**Contract**: groups sessions by exam without blending; orders points oldest→newest;
`mostRecentExam` picks the latest; empty input → `[]`/`null`; single-session exam → one point.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Build passes: `npx astro sync && npm run build`

#### Manual Verification:

- `/dashboard` shows the most-recently-practiced exam's trend by default
- The dropdown switches exams and the line re-renders; exams are never blended
- An exam with one session shows a single point + the "do more" caption
- A fresh account (no sessions) sees the empty state linking to `/practice`
- The caption and `/history` link render correctly

**Implementation Note**: After automated verification passes, pause for manual confirmation. Final phase → then `/10x-impl-review`.

---

## Testing Strategy

### Unit Tests:

- `topicBreakdown`: multi-topic tally, single topic, all-correct/all-wrong, ordering, rounding
- `groupByExam` / `mostRecentExam`: no blending, point ordering, most-recent selection, empty + single-session

### Manual Testing Steps:

1. Finish a session → breakdown bars on the summary; open `/history/[id]` → same bars
2. `/dashboard` → most-recent exam trend; switch exams via dropdown
3. Practice a second session of the same exam → trend gains a second point
4. New account → dashboard empty state → `/practice`

## Performance Considerations

Small data volumes per the PRD; `listSessions` is a single indexed query (`user_id, created_at desc`)
and aggregation is in-memory over a handful of rows. No pagination needed.

## References

- Change notes (decisions): `context/changes/progress-dashboard/change.md`
- Roadmap slice S-04: `context/foundation/roadmap.md`
- PRD FR-008 / FR-010 + resolved Open Question #2: `context/foundation/prd.md`
- Data source + reuse: `src/lib/db/sessions.ts`, `src/components/practice/SavedSessionView.tsx`, `src/lib/practice/session.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Per-topic breakdown (FR-008)

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — 9627914
- [x] 1.2 Lint passes: `npm run lint` — 9627914
- [x] 1.3 Build passes: `npx astro sync && npm run build` — 9627914

#### Manual

- [x] 1.4 Per-topic bars show under the overall score on the summary — 9627914
- [x] 1.5 `/history/[id]` shows the same breakdown above the per-question review — 9627914
- [x] 1.6 Bars are color-coded and read correctly (correct/total, %) — 9627914

### Phase 2: Per-exam progress dashboard (FR-010)

#### Automated

- [x] 2.1 Unit tests pass: `npm test`
- [x] 2.2 Lint passes: `npm run lint`
- [x] 2.3 Build passes: `npx astro sync && npm run build`

#### Manual

- [x] 2.4 `/dashboard` shows the most-recently-practiced exam's trend by default
- [x] 2.5 Dropdown switches exams and the line re-renders; exams never blended
- [x] 2.6 One-session exam shows a single point + "do more" caption
- [x] 2.7 Fresh account sees the empty state linking to `/practice`
- [x] 2.8 Caption and `/history` link render correctly
