# Session Persistence & History (S-03) Implementation Plan

## Overview

Introduce the project's **first application database table** to persist completed
practice sessions, then expose a `/history` page where a signed-in developer can
list and revisit past sessions and delete ones they no longer want. Today a session
lives only in client React state ([PracticeGenerator.tsx:51](src/components/practice/PracticeGenerator.tsx#L51))
and is lost on reload; this slice makes it durable and revisitable (FR-008 saved
session, FR-009 revisit), honoring the "saved sessions are never lost" guardrail.

## Current State Analysis

- **Session is client-only.** `PracticeGenerator` holds the whole `PracticeSession`
  in `useState`; on completion it shows a summary via `score(session)` and an
  optional `SessionReview` ([PracticeGenerator.tsx:156-192](src/components/practice/PracticeGenerator.tsx#L156-L192)).
  Nothing is sent to the server; reload discards everything.
- **Types are already serializable plain data** ([src/types.ts:29-62](src/types.ts#L29-L62)):
  `Question` (id, stem, 4 `options`, `correctOptionId`, `explanation`, `topic`),
  `AnswerRecord` (questionId, selectedOptionId, correct), `PracticeSession`
  (questions[], currentIndex, answers[]), `SessionScore` (correct, total, percentage).
- **Pure session logic** lives in [session.ts](src/lib/practice/session.ts);
  `score()` ([session.ts:52-57](src/lib/practice/session.ts#L52-L57)) computes the
  overall score from `answers[].correct`. `SessionReview` reads answers index-aligned
  via `getAnswer(session, index)` ([SessionReview.tsx:35-37](src/components/practice/SessionReview.tsx#L35-L37)).
- **Data layer is greenfield.** No `supabase/migrations/`, zero app tables, the SSR
  client is **untyped** ([supabase.ts:9](src/lib/supabase.ts#L9)) and uses the anon
  key (so all queries run under RLS). Auth is fully wired: middleware populates
  `context.locals.user` and guards `PROTECTED_ROUTES` ([middleware.ts:4,18-22](src/middleware.ts#L4)).
- **Endpoint + test conventions exist to mirror.** `POST /api/practice/generate`
  ([generate.ts](src/pages/api/practice/generate.ts)) shows the auth-gate → JSON-parse
  → zod-validate → `json(body, status)` shape; its test
  ([generate.test.ts](src/pages/api/practice/generate.test.ts)) shows the
  `vi.mock` + fake-`context` pattern for route tests that avoid `astro:env/server`.
- **vitest is wired** (existing `*.test.ts` run under `npm test`), despite AGENTS.md
  saying no runner exists — that line is stale.

## Desired End State

A signed-in developer who finishes a practice session has it saved automatically;
they can open `/history`, see a reverse-chronological list of their past sessions
(provider/exam · date · score · question count), click any one to revisit the full
explanation-first review, and delete a session behind a confirmation. Sessions are
private per user (enforced by RLS) and never silently lost (save failures keep
results on screen with a Retry).

**Verify:** complete a session → a row appears in `practice_sessions` and on
`/history`; open it → `SessionReview` renders correctness + explanations; a second
user sees none of the first user's sessions; deleting removes the row.

### Key Discoveries:

- Questions are ephemeral generated content — the saved record must carry the full
  `questions` payload, since there is no question bank to re-reference (PRD §Non-Goals).
- `SessionReview` can be reused verbatim if we reconstruct a complete
  `PracticeSession` (`currentIndex = questions.length`, stored `answers`) — but this
  requires **stored `answers` to stay index-aligned with `questions`** (generation order).
- Score must be **recomputed server-side** from the submitted payload — the client
  sends `AnswerRecord.correct`, which we must not trust as the persisted score.
- `gen_random_uuid()` and `auth.uid()` are available by default in Supabase Postgres.

## What We're NOT Doing

- **No resume of in-progress sessions** — only completed sessions are saved (save-on-complete).
- **No pagination / filtering / search** on history — small data volume per PRD.
- **No per-topic breakdown UI or progress trend** — that's S-04 (we *store* topic data, don't surface it).
- **No weak-topic retry** — that's S-05 (the stored topic + answers data unblocks it).
- **No edit/rename of sessions**; no real-exam batch mode; no offline save queue.
- **No Playwright/E2E** — vitest unit + mocked-endpoint tests only; the save→revisit flow is verified manually.

## Implementation Approach

A single `practice_sessions` table stores queryable columns (user_id, provider,
exam, correct, total, percentage, created_at) plus a JSONB `payload` holding the
full `{ questions, answers }` for revisit. A small server-side data-access module
(`src/lib/db/sessions.ts`) wraps all queries in the project's discriminated-result
style, and a pure `gradeAnswers` helper recomputes per-answer correctness + score
from the submitted payload. The client posts the completed session to a new
`POST /api/practice/sessions` endpoint at the summary screen; `/history` and
`/history/[id]` are SSR Astro pages that read directly through the RLS-scoped client,
reusing `SessionReview` for the detail view. Delete is a separate `DELETE` endpoint
backed by an owner-scoped RLS policy shipped in the Phase 1 migration.

## Critical Implementation Details

- **Server-authoritative regrade (integrity).** Do not persist the client's
  `AnswerRecord.correct`. For each submitted answer, look up its question by
  `questionId` and recompute `correct = (selectedOptionId === question.correctOptionId)`;
  derive the stored score from those recomputed flags. This is the product's trust anchor.
- **Index alignment for revisit (ordering gotcha).** `SessionReview` pairs
  `questions[i]` with `getAnswer(session, i)`. The save endpoint must preserve the
  generated question order and the forward-only answer order so the reconstructed
  session re-pairs correctly. Persist `answers` in submission order; persist
  `questions` in generation order.
- **RLS insert binding (security).** The INSERT policy uses `WITH CHECK (auth.uid() = user_id)`;
  the endpoint must set `user_id` explicitly to `context.locals.user.id`. The anon-key
  client carries the user JWT from cookies, so `auth.uid()` resolves per request.
- **Completed-only invariant.** The save endpoint rejects a payload where
  `answers.length !== questions.length` (a non-completed session) with a 400.

---

## Phase 1: Data layer (migration, RLS, typed client, sessions service)

### Overview

Create the first table + granular RLS policies, regenerate the typed `Database`,
and build the pure + data-access foundation everything else consumes. No user-visible change.

### Changes Required:

#### 1. First migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_practice_sessions.sql` (timestamp via `date +%Y%m%d%H%M%S`, per AGENTS.md naming)

**Intent**: Define `practice_sessions` with queryable score/metadata columns + a JSONB
payload, an index for the history list, RLS enabled, and granular per-operation policies
(SELECT/INSERT/DELETE — no UPDATE; sessions are immutable). Owner-scoped to `auth.uid()`.

**Contract**:

```sql
create table public.practice_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  provider    text not null,
  exam        text not null,
  correct     integer not null,
  total       integer not null,
  percentage  integer not null,
  payload     jsonb not null,            -- { questions: Question[], answers: AnswerRecord[] }
  created_at  timestamptz not null default now()
);

create index practice_sessions_user_created_idx
  on public.practice_sessions (user_id, created_at desc);

alter table public.practice_sessions enable row level security;

create policy "own_sessions_select" on public.practice_sessions
  for select to authenticated using (auth.uid() = user_id);
create policy "own_sessions_insert" on public.practice_sessions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "own_sessions_delete" on public.practice_sessions
  for delete to authenticated using (auth.uid() = user_id);
```

#### 2. Generated Database types + typed client

**File**: `src/db/database.types.ts` (generated), `src/lib/supabase.ts`

**Intent**: After applying the migration, run `supabase gen types typescript` to emit
the `Database` type, then parametrize the SSR client so queries are typed.

**Contract**: `createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, …)` in
[supabase.ts:9](src/lib/supabase.ts#L9); import `Database` from `@/db/database.types`.
The factory's return type flows into every caller — no other signature changes.

#### 3. Persistence domain types

**File**: `src/types.ts`

**Intent**: Add the shapes the service and pages exchange, alongside the existing
session contract block.

**Contract**: `SessionPayload = { questions: Question[]; answers: AnswerRecord[] }`;
`SavedSessionSummary = { id, provider, exam, correct, total, percentage, createdAt }`
(list rows); `SavedSession = SavedSessionSummary & { payload: SessionPayload }` (detail).

#### 4. Pure regrade helper

**File**: `src/lib/practice/session.ts` (extend) or `src/lib/practice/grade.ts`

**Intent**: A pure function that recomputes authoritative answers + score from a raw
submitted payload, ignoring client-sent `correct` flags. Reuses the existing `score`
logic by building a complete session.

**Contract**: `gradeSubmission(questions: Question[], answers: {questionId; selectedOptionId}[]): { answers: AnswerRecord[]; score: SessionScore }`.
Per answer: match question by id, set `correct = selectedOptionId === correctOptionId`.
Throws/returns an error sentinel if an answer references an unknown questionId.

#### 5. Sessions data-access service

**File**: `src/lib/db/sessions.ts`

**Intent**: Wrap all `practice_sessions` queries in the discriminated-result style used
by `question-generator.ts`. Serialize input → insert row (payload as JSONB); deserialize
rows → `SavedSessionSummary` / `SavedSession`.

**Contract**: takes a Supabase client + `userId`.
`saveSession(client, userId, { provider, exam, payload, score }) → { ok: true; id } | { ok: false; error }`;
`listSessions(client, userId) → SavedSessionSummary[]` (ordered by `created_at desc`);
`getSession(client, userId, id) → SavedSession | null`;
`deleteSession(client, userId, id) → { ok: true } | { ok: false; error }`.
All filter by `user_id` explicitly (defense-in-depth atop RLS).

#### 6. Unit tests

**File**: `src/lib/practice/session.test.ts` (extend) + `src/lib/db/sessions.test.ts` (serialize/deserialize only)

**Intent**: Cover the regrade (correct/incorrect/unknown-question) and the row↔DTO
mapping (payload round-trips, summary projection). DB I/O is exercised via mocked client.

**Contract**: pure-function assertions; no live Supabase.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npx astro sync && npm run build`
- Unit tests pass: `npm test`

#### Manual Verification:

- `supabase db push` applies the migration to the hosted project; the table + 3 policies are visible in the dashboard
- `supabase gen types typescript` produces `src/db/database.types.ts` containing `practice_sessions`
- RLS check in the dashboard SQL editor: as user A, a select over `practice_sessions` returns no rows belonging to user B

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Save-on-complete

### Overview

Persist a session when the user reaches the summary screen, with server-side regrade
and a keep-results-and-retry experience on failure.

### Changes Required:

#### 1. Save endpoint

**File**: `src/pages/api/practice/sessions.ts`

**Intent**: Auth-gated `POST` that validates the submitted payload, rejects
non-completed sessions, regrades server-side, and inserts via the sessions service.

**Contract**: `export const prerender = false`. Zod body
`{ provider: enum["AWS","Azure","GCP"], exam: string.min(1), questions: questionSchema[], answers: { questionId, selectedOptionId }[] }`
(reuse `questionSchema` from `@/lib/services/question-schema`). 401 if unauthenticated;
400 on bad JSON, schema failure, or `answers.length !== questions.length`. On success
calls `gradeSubmission` then `saveSession(client, user.id, …)` and returns
`{ ok: true, id }` (200) or `{ ok: false, error }` (400/500). Mirrors the `json()` helper
and structure of [generate.ts](src/pages/api/practice/generate.ts).

#### 2. Client save wiring

**File**: `src/components/practice/PracticeGenerator.tsx`

**Intent**: On transition to summary ([handleNext:93-99](src/components/practice/PracticeGenerator.tsx#L93-L99)),
POST the completed session; track a save status and show a small "Saved" indicator,
or "Couldn't save — Retry" that re-posts, while keeping the score + review on screen.

**Contract**: new `saveStatus: "idle" | "saving" | "saved" | "error"` state; a
`saveSession()` async that posts `{ provider, exam, questions: session.questions, answers: session.answers }`
to `/api/practice/sessions`. Results UI ([summary block:156-192](src/components/practice/PracticeGenerator.tsx#L156-L192))
gains the status line + Retry button. `startNewSet` resets `saveStatus`.

#### 3. Endpoint tests

**File**: `src/pages/api/practice/sessions.test.ts`

**Intent**: Mirror `generate.test.ts` — mock `@/lib/db/sessions` so the route test
avoids `astro:env/server`; assert auth, validation, completed-only, and success.

**Contract**: 401 unauthenticated (service not called); 400 on bad provider / empty exam /
malformed JSON / `answers.length !== questions.length`; 200 returns `{ ok: true, id }` and
the service is called with `user.id` + regraded data.

### Success Criteria:

#### Automated Verification:

- Endpoint tests pass: `npm test`
- Lint passes: `npm run lint`
- Build passes: `npx astro sync && npm run build`

#### Manual Verification:

- Completing a session in the UI inserts a `practice_sessions` row (visible in the dashboard)
- The stored score matches a server recompute even if the client `correct` flag is tampered (integrity holds)
- Simulating a failed save (offline) keeps the summary + review on screen and shows Retry; Retry succeeds when back online

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: History list + revisit detail

### Overview

Two SSR pages: a reverse-chronological list and a per-session revisit view that reuses
`SessionReview`. Protect the new route.

### Changes Required:

#### 1. Protect `/history`

**File**: `src/middleware.ts`

**Intent**: Add `/history` to `PROTECTED_ROUTES` so unauthenticated access redirects to sign-in.

**Contract**: `PROTECTED_ROUTES = ["/dashboard", "/practice", "/history"]` ([middleware.ts:4](src/middleware.ts#L4)).

#### 2. History list page

**File**: `src/pages/history.astro`

**Intent**: Server-side fetch the user's sessions and render rows (provider/exam · date ·
score `X/Y` + % · question count), newest first; show a "No sessions yet" empty state
linking to `/practice`.

**Contract**: builds the RLS-scoped client via `createClient(...)`, calls
`listSessions(client, user.id)`, renders rows linking to `/history/[id]`. Tailwind via
`cn()`; matches existing page/layout styling. The per-row delete control is the React
island from Phase 4 (list renders without it until then).

#### 3. Revisit detail page + adapter island

**File**: `src/pages/history/[id].astro`, `src/components/practice/SavedSessionView.tsx`

**Intent**: Server-fetch one session (404 if not found / not owned); render a header
(provider/exam, date, `X/Y` + %) and pass the payload to a React island that
reconstructs a complete `PracticeSession` and renders `SessionReview`.

**Contract**: page sets `prerender = false`, reads `Astro.params.id`, calls
`getSession(client, user.id, id)`. `SavedSessionView` props `{ payload: SessionPayload }`;
builds `{ questions: payload.questions, currentIndex: payload.questions.length, answers: payload.answers }`
and renders `<SessionReview session={…} />`.

#### 4. Navigation link

**File**: relevant layout/header under `src/layouts/` or `src/components/`

**Intent**: Add a "History" link for signed-in users so the page is discoverable.

**Contract**: link to `/history`, shown when `Astro.locals.user` is present; follows the existing nav pattern.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes (both new routes compile): `npx astro sync && npm run build`
- `npm test` stays green

#### Manual Verification:

- `/history` lists the signed-in user's sessions with provider/exam, date, score, and question count, newest first
- A fresh user sees the empty state, not a blank page
- Clicking a row opens `/history/[id]`; `SessionReview` shows per-question correctness, the correct answer, and explanation-first rationale (FR-009)
- Visiting `/history` while signed out redirects to `/auth/signin`
- A second user cannot see or open the first user's sessions (direct `/history/[id]` URL 404s)

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 4: Delete a session

### Overview

Let a user remove a saved session behind a confirmation. The owner-scoped DELETE policy
already shipped in Phase 1.

### Changes Required:

#### 1. Delete endpoint

**File**: `src/pages/api/practice/sessions/[id].ts`

**Intent**: Auth-gated `DELETE` that removes the session by id via the service; RLS
ensures only the owner's row is affected.

**Contract**: `export const prerender = false`. 401 if unauthenticated; calls
`deleteSession(client, user.id, params.id)`; returns `{ ok: true }` (200) or
`{ ok: false, error }`. Deleting a non-owned/nonexistent id is a no-op success (RLS filters it).

#### 2. Per-row delete control

**File**: `src/components/practice/HistoryList.tsx` (React island used by `history.astro`)

**Intent**: Render the session rows with a delete button that confirms, calls the
DELETE endpoint, and removes the row on success (keeping the link-to-detail behavior).

**Contract**: props `{ sessions: SavedSessionSummary[] }`; on delete → confirm dialog →
`fetch(DELETE /api/practice/sessions/{id})` → drop the row from local state; show an
inline error on failure. `history.astro` renders `<HistoryList sessions={…} />` instead of static rows.

#### 3. Delete endpoint tests

**File**: `src/pages/api/practice/sessions/[id].test.ts`

**Intent**: Mock the sessions service; assert auth + success wiring.

**Contract**: 401 unauthenticated (service not called); 200 calls `deleteSession` with `user.id` + `params.id`.

### Success Criteria:

#### Automated Verification:

- Delete endpoint tests pass: `npm test`
- Lint passes: `npm run lint`
- Build passes: `npx astro sync && npm run build`

#### Manual Verification:

- Clicking delete on a row prompts for confirmation, then removes it from `/history` and the database
- A user cannot delete another user's session (RLS no-op; row remains for the owner)

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation. This is the final phase — then `/10x-impl-review`.

---

## Testing Strategy

### Unit Tests:

- `gradeSubmission`: all-correct, all-wrong, mixed, and unknown-questionId handling
- sessions serialize/deserialize: payload round-trips; summary projection drops the payload

### Integration / Route Tests (mocked Supabase):

- `POST /api/practice/sessions`: auth, schema validation, completed-only rejection, success returns id
- `DELETE /api/practice/sessions/[id]`: auth, success wiring

### Manual Testing Steps:

1. Apply migration (`supabase db push`); confirm table + 3 RLS policies in dashboard
2. Complete a session → row appears; open `/history` → it's listed with correct fields
3. Open the session → `SessionReview` renders correctness + explanations
4. Sign in as a second user → first user's sessions are invisible; direct detail URL 404s
5. Force a save failure (offline) → results stay on screen + Retry works
6. Delete a session → confirm → row gone from list and DB

## Migration Notes

- This is the **first** migration; `supabase/migrations/` is created here.
- Apply via `supabase db push` (a `SUPABASE_ACCESS_TOKEN` exists in `.dev.vars`); the
  CLI must be linked to project `pysbtxstgciylnfkcsdm`. If linking is unavailable,
  fall back to pasting the SQL in the dashboard SQL editor and keep the `.sql` file in-repo.
- Regenerate `src/db/database.types.ts` after the table exists so queries are typed.

## References

- Roadmap slice S-03: `context/foundation/roadmap.md:103-113`
- PRD FR-008 / FR-009: `context/foundation/prd.md:105-111`
- Lesson (LLM latency/volume): `context/foundation/lessons.md`
- Endpoint + test pattern to mirror: `src/pages/api/practice/generate.ts`, `src/pages/api/practice/generate.test.ts`
- Reused review component: `src/components/practice/SessionReview.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data layer (migration, RLS, typed client, sessions service)

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — ba96bbb
- [x] 1.2 Build passes: `npx astro sync && npm run build` — ba96bbb
- [x] 1.3 Unit tests pass: `npm test` — ba96bbb

#### Manual

- [x] 1.4 `supabase db push` applies the migration; table + 3 policies visible in dashboard — ba96bbb
- [x] 1.5 `supabase gen types typescript` produces `src/db/database.types.ts` with `practice_sessions` — ba96bbb
- [x] 1.6 RLS check: user A cannot select user B's rows — ba96bbb

### Phase 2: Save-on-complete

#### Automated

- [x] 2.1 Endpoint tests pass: `npm test` — 1921a93
- [x] 2.2 Lint passes: `npm run lint` — 1921a93
- [x] 2.3 Build passes: `npx astro sync && npm run build` — 1921a93

#### Manual

- [x] 2.4 Completing a session inserts a `practice_sessions` row — 1921a93
- [x] 2.5 Stored score matches server recompute even with a tampered client flag — 1921a93
- [x] 2.6 Failed save keeps results on screen + Retry works — 1921a93

### Phase 3: History list + revisit detail

#### Automated

- [x] 3.1 Lint passes: `npm run lint` — 9c1b904
- [x] 3.2 Build passes (both new routes compile): `npx astro sync && npm run build` — 9c1b904
- [x] 3.3 `npm test` stays green — 9c1b904

#### Manual

- [x] 3.4 `/history` lists sessions with provider/exam, date, score, count, newest first — 9c1b904
- [x] 3.5 Fresh user sees the empty state — 9c1b904
- [x] 3.6 Row opens detail; `SessionReview` shows correctness + explanation-first (FR-009) — 9c1b904
- [x] 3.7 Signed-out `/history` redirects to `/auth/signin` — 9c1b904
- [x] 3.8 A second user cannot see/open the first user's sessions (detail URL 404s) — 9c1b904

### Phase 4: Delete a session

#### Automated

- [x] 4.1 Delete endpoint tests pass: `npm test` — 0c83a86
- [x] 4.2 Lint passes: `npm run lint` — 0c83a86
- [x] 4.3 Build passes: `npx astro sync && npm run build` — 0c83a86

#### Manual

- [x] 4.4 Delete prompts for confirmation, then removes the row from `/history` and the DB — 0c83a86
- [x] 4.5 A user cannot delete another user's session (RLS no-op) — 0c83a86
