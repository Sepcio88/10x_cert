---
date: 2026-07-03T22:32:21+02:00
researcher: Claude Code
git_commit: c2273a4a281fa2652ac430785960b8b1f37527bc
branch: main
repository: Sepcio88/10x_cert (CloudExamMatter)
topic: "Practice generation & grading flow — M4L3 feature analysis"
tags: [research, codebase, practice-flow, question-generation, session-persistence, m4l3, architect-certification]
status: complete
last_updated: 2026-07-03
last_updated_by: Claude Code
---

# Research: Practice generation & grading flow

**Date**: 2026-07-03T22:32:21+02:00
**Researcher**: Claude Code
**Git Commit**: c2273a4a281fa2652ac430785960b8b1f37527bc
**Branch**: main
**Repository**: Sepcio88/10x_cert (CloudExamMatter)

## Research Question

Analyze the practice-generation-and-grading flow end to end — exam/count selection →
question generation (OpenRouter) → answer with explanation-first feedback → session
save → dashboard/history read-back — as the M4L3 "analyze a feature" artifact for the
10xArchitect certification report. Trace the flow with file:line precision, map test
coverage (tested vs. not), and assess blast radius if the question shape or session DB
schema changes. This is the hottest code path per `context/map/repo-map.md` (§2 Territory).

## Summary

The flow is a clean four-layer pipeline (UI → API → service/lib → Supabase) with two
independent, well-placed validation gates — a zod schema at the LLM-output boundary
(`question-generator.ts:92-108`) and a second zod re-validation at the session-save
boundary (`sessions.ts:13`) that treats client-submitted grading as untrusted and
always recomputes server-side (`session.ts:98-123`). Both gates fail loud (typed error
results), not silent. `src/types.ts` is confirmed as the shared kernel the repo map
flagged — a `Question`/`QuestionOption` shape change ripples through ~7 files but
resolves as **compile errors** almost everywhere, which is the safe failure mode.

The one place validation is absent is the **DB read-back path**:
`src/lib/db/sessions.ts` casts Supabase's untyped `Json` payload column straight to
app types (`as unknown as SessionRow[]`, no `safeParse`) — so a schema change that
only affects *already-saved* rows fails silently in the UI instead of loudly. That,
plus a manually-triggered (not codegen-wired) sync between `database.types.ts` and the
real Supabase schema, is the most significant structural gap this research found.

Unit test coverage is strong for pure logic (grading, session lifecycle, progress
aggregation) and route-level validation, but has two real gaps: the OpenRouter HTTP
client itself (`openrouter.ts`) has zero tests, and the DB query layer
(`sessions.ts:63-140`) is untested beyond its pure row-mapper functions — the RLS
"defense in depth" the code comments claim is unverified by any test. E2E coverage is
a single golden-path spec with no negative-path coverage.

## Feature overview

**What it does**: a user picks a cloud-exam provider/code and a question count
(1–5), the app generates fresh exam-representative multiple-choice questions via
OpenRouter (`gpt-4o-mini`), the user answers one at a time with immediate
explanation-first feedback, and on completion the session is graded server-side and
saved — surfacing later as a per-exam score trend on the dashboard and a revisitable
entry in history, with a one-click "retry weak topics" loop back into generation.

**The 27-hop trace** (UI → API → service → DB → UI), condensed to the load-bearing hops:

1. `src/pages/practice.astro:4,18` mounts `<PracticeGenerator client:load />`, gated by `src/middleware.ts:4-22`.
2. `PracticeGenerator.tsx:50-65` — form state, count clamped to `MIN_COUNT=1`/`MAX_COUNT=5` (`:25-26`).
3. `PracticeGenerator.tsx:74-83` → `POST /api/practice/generate`.
4. `generate.ts:29-31` auth gate; `:8-14,40-52` zod `requestSchema` (provider enum, exam non-empty, bounded count).
5. `generate.ts:54-55` → `generateQuestions(...)` (`question-generator.ts`).
6. `question-generator.ts:60-68` re-checks count bounds (defense-in-depth duplicate of the route's zod check).
7. `question-generator.ts:70-76` → `createOpenRouterClient()` (`openrouter.ts:29-32`); `not-configured` if no API key.
8. `openrouter.ts:36-53` — `fetch` with a 9000ms `AbortController` timeout (`REQUEST_TIMEOUT_MS`, `:5`).
9. `question-generator.ts:92-108` — `JSON.parse` → `generationResponseSchema.safeParse`, retries once (`MAX_ATTEMPTS=2`, `:9`), else typed `invalid-output`.
10. `generate.ts:57` returns the `GenerationResult` JSON straight to the client.
11. `PracticeGenerator.tsx:84-89` → `createSession(questions)` (`session.ts:17-19`), status → `"answering"`.
12. `QuestionCard.tsx:54-60` → answer select; `PracticeGenerator.tsx:103-106` → `submitAnswer` (`session.ts:64-75`) — **client-side grading is display-only**, never trusted.
13. `PracticeGenerator.tsx:133-142` → `advance` (`session.ts:81-86`); on `isComplete` → `saveCompletedSession`.
14. `PracticeGenerator.tsx:110-131` → `POST /api/practice/sessions` with raw picks only (no client-computed correctness sent).
15. `sessions.ts:38-40,49-60` — auth + zod validate + reject incomplete sessions.
16. `sessions.ts:62-65` → `gradeSubmission(questions, answers)` (`session.ts:98-123`) — **server-authoritative regrade**, the trust anchor.
17. `sessions.ts:67-77` → `saveSession` (`db/sessions.ts:63-82`) inserts into `practice_sessions` (Supabase, RLS-scoped to `auth.uid() = user_id`, no UPDATE policy — rows are immutable).
18. Dashboard: `dashboard.astro` → `listSessionsFull` → `weakTopicsByExam` (`progress.ts:82-97`) → `ProgressDashboard.tsx` (per-exam trend, never blended across exams) → "Retry weak topics" link closes the loop back to hop 3.
19. History: `history.astro` → `listSessions` → `HistoryList.tsx`; detail view → `getSession` → `SavedSessionView.tsx`; delete → `DELETE /api/practice/sessions/[id].ts` → `deleteSession`, RLS + explicit `user_id` filter.

**Question-count cap**: hard-capped at 1–5 (`question-schema.ts:9-10`), enforced three
times (UI, route zod, engine re-check). The cap was **lowered from 20 to 5** because a
single synchronous call for ~10 questions exceeded the 9s OpenRouter timeout — this is
a documented, already-resolved issue, not a fresh finding (see Historical Context).

## Detailed Findings

### End-to-end trace and `src/types.ts` usage

Full 27-hop trace above. `src/types.ts` (`Question`/`QuestionOption` at `:6-7`,
derived via `z.infer<typeof questionSchema>`; `PracticeSession`/`AnswerRecord` at
`:34-57`; `SessionPayload`/`SavedSession(Summary)` at `:94-120`) is imported at 11
sites touched by this flow specifically: `PracticeGenerator.tsx:19`,
`QuestionCard.tsx:4`, `SessionReview.tsx:5`, `TopicBreakdown.tsx:3`,
`SavedSessionView.tsx:3`, `HistoryList.tsx:3`, `ProgressDashboard.tsx:3`,
`session.ts:1`, `progress.ts:2`, `question-generator.ts:3`, `db/sessions.ts:3` — of
the 15 total repo-wide import sites the dependency-cruiser artifact counted, this flow
alone accounts for 11.

### Test coverage — tested vs. not tested

**Well covered**: session grading/lifecycle (`session.test.ts`, thorough — grading,
idempotent re-grade guard, advance guard, percentage rounding, server-authoritative
regrade ignoring client `correct` flags, out-of-order resubmission); progress
aggregation (`progress.test.ts` — per-exam grouping, weak-topic threshold boundary at
exactly 70%); route-level validation for `generate`, `sessions`, and `sessions/[id]`
(401s, bad input, malformed JSON, incomplete sessions); generation engine happy path,
retry-on-malformed-JSON, double-malformed → `invalid-output`, missing-API-key,
provider-error (no retry), code-fence stripping.

**Gaps**:
- The `zod` `safeParse` *failure* branch in `question-generator.ts:100-104` (schema-valid-JSON-but-wrong-shape — e.g. 3 options instead of 4) is untested; only outright `JSON.parse` failure is exercised.
- `openrouter.ts` has **zero tests** — non-2xx status handling, missing `choices[0].message.content`, and the `AbortController` timeout path are all unverified. All generation-engine tests mock at the `createOpenRouterClient` boundary, bypassing this file entirely.
- `db/sessions.ts:63-140` query logic (`saveSession`/`listSessions`/`listSessionsFull`/`getSession`/`deleteSession`) is untested beyond the pure `rowToSummary`/`rowToSaved` mappers — no test simulates a Supabase error response or verifies the `.eq("user_id", userId)` scoping actually works against a real/RLS-enforcing client. This is exactly the "defense in depth" layer the file's own comments call out as a backstop, and it's unverified.
- No component test exists for `PracticeGenerator.tsx` (no `.test.tsx`).
- `count=5` (the max) happy-path generation is never directly tested; only 1–3 appear.
- E2E is a **single** golden-path spec (`tests/e2e/practice-flow.spec.ts`, 1 question, correct locators per `.claude/rules/e2e.md` — `waitForResponse`, role/text locators, business-outcome assertions) with **no negative-path coverage**: no failed generation, no multi-question session, no incorrect-answer rendering, no delete/revisit flow.

### Blast radius — question shape and session schema changes

**Question shape** (`question-schema.ts:17-29`, TS type is `z.infer`'d from it — single
source of truth, good): touches `question-generator.ts`, `session.ts`,
`QuestionCard.tsx`, `SessionReview.tsx`, `PracticeGenerator.tsx`, `sessions.ts` (API
re-validation). A rename mostly resolves as a **compile error** (safe); the one silent
path is **already-saved rows** in `practice_sessions.payload` — a tightened schema
won't retroactively invalidate old JSONB, and nothing re-validates it on read.

**Session DB schema**: app type (`types.ts`) and generated type
(`db/database.types.ts`) are synced **manually**, not by CI codegen — `package.json`
has no `db:types`/`gen:types` script; the only documented process is a human running
`supabase gen types typescript` after `supabase db push`
(`context/archive/2026-06-19-session-persistence-history/plan.md:148-157`). The bridge
from Supabase's untyped `Json` payload column to `SessionPayload` is an **unchecked
cast** (`db/sessions.ts:73,96,111,130` — `as unknown as ...`), not a validated one — no
`safeParse` on read.

Consumer-by-consumer: `progress.ts`, `ProgressDashboard.tsx`, `dashboard.astro`,
`history.astro`/`HistoryList.tsx`, `history/[id].astro` all dot-access session fields
by name, so a **rename** is a compile error everywhere (safe). An **added required
field** is invisible to the type checker for historical data — old JSONB rows lack it,
nothing validates it, so the UI renders `undefined` silently; and if the new DB column
is `NOT NULL` without a default, new saves fail with an opaque generic error string
(`db/sessions.ts:78-80` surfaces only `error.message`).

**Ranked riskiest files** (blast radius × silent-vs-loud failure mode):
1. `question-schema.ts` — widest fan-out, mostly compile-error-safe, but stale saved rows are a silent risk.
2. `db/sessions.ts` (mappers + `as unknown as` casts) — the sole DB↔app translation layer; a schema change here is a **silent runtime bug by construction**, no validation exists.
3. `supabase/migrations/*_create_practice_sessions.sql` — a `NOT NULL` column added without updating `saveSession` breaks every save with an opaque Postgres error string.
4. `src/types.ts` itself — Ca=15 repo-wide (per `context/map/artifact-2-structure.md`), widest fan-out, but the safe (compile-error) failure mode.
5. `src/db/database.types.ts` — manually regenerated, never automatically; can go stale silently after a migration while TS keeps compiling against the old shape.

## Feature overview / Technical debt

_(Per the M4L3 artifact requirement, technical debt is broken out explicitly below —
feature overview is above.)_

## Technical debt

1. **Unvalidated DB read-back is the single largest gap.** `db/sessions.ts` casts
   Supabase JSONB straight to app types with no `zod.safeParse` on read
   (`:73,96,111,130`). Every other boundary in this flow (LLM output, client-submitted
   answers) is validated; this one isn't. Because `practice_sessions` rows are
   immutable (no UPDATE policy), any future schema tightening leaves permanently
   unvalidated legacy rows in place with no migration path. **Recommendation**: add a
   `safeParse` at the read boundary in `db/sessions.ts`, or a lazy migration on read.

2. **`database.types.ts` sync is manual and undocumented in the active workflow.** No
   `package.json` script, no CI step — the only record of the process is in an
   *archived* change's plan (`context/archive/2026-06-19-session-persistence-history/plan.md`).
   A future schema change is one missed `supabase gen types` away from silent
   TS/Postgres drift. **Recommendation**: add an `npm run db:types` script and a CI
   check that fails if `database.types.ts` is stale relative to `supabase/migrations/`.

3. **`openrouter.ts` has zero direct test coverage.** All generation-engine tests mock
   at the `createOpenRouterClient` function boundary, so the actual HTTP error
   translation (non-2xx status, missing `choices[0]`, `AbortError`→timeout message) is
   unexercised. This is the flow's only external network dependency and its error
   paths are the least-tested part of the stack. **Recommendation**: add
   `openrouter.test.ts` with `fetch` mocking (msw or `vi.stubGlobal`) covering 429/500,
   malformed envelope, and timeout.

4. **DB query layer (`db/sessions.ts:63-140`) untested beyond pure mappers.** The
   file's own comments frame the explicit `user_id` filters as defense-in-depth behind
   RLS, but no test verifies that defense actually works — e.g., no test attempts a
   cross-user read/delete against a real or RLS-simulating client.
   **Recommendation**: at minimum, an integration test against a local Supabase
   instance (or a fake Postgres) exercising the RLS boundary once, since this is a
   security-relevant guarantee currently only asserted by code comments.

5. **E2E coverage is a single golden path.** No Playwright test exercises a failed
   generation, a multi-question session, an incorrect answer, or history
   revisit/delete — meaning a regression in any negative path ships silently past CI's
   only user-facing check. **Recommendation**: at least one negative-path E2E case
   (generation failure) given how central this flow is per the repo-map territory
   analysis.

6. **Resolved-but-worth-flagging**: the question-count cap (1–5) is a workaround for a
   9s timeout the current model can't beat at higher volumes — already documented in
   `context/foundation/lessons.md` and not a fresh gap, but it does mean **raising the
   cap requires either a faster model or a streaming architecture change**, not just a
   config bump. Flagged here so the M4L4 refactor-opportunities pass has it as a
   candidate if UX pressure to allow more questions ever surfaces.

## Code References

- `src/pages/practice.astro:4,18` — mounts the practice island, auth-gated
- `src/middleware.ts:4-22` — protected-route gate
- `src/components/practice/PracticeGenerator.tsx:25-26,50-89,103-142,159-173` — form state, count clamp, generation call, answer/advance/save orchestration, retry-topics deep link
- `src/components/practice/QuestionCard.tsx:4,29,34,39-90` — question rendering, answer select, explanation-first feedback
- `src/pages/api/practice/generate.ts:8-14,29-31,40-57` — auth + zod validation + engine call
- `src/lib/services/question-generator.ts:60-119` — count re-check, OpenRouter call, parse/validate/retry loop
- `src/lib/services/question-schema.ts:5-10,17-29` — count bounds (with the 20→5 history comment), `questionSchema` with `correctOptionId` refine invariant
- `src/lib/services/openrouter.ts:5,29-53,58-68` — timeout constant, client factory, fetch + error translation (untested)
- `src/lib/practice/session.ts:17-149` — create/current/submit/advance/complete/grade lifecycle, server-authoritative `gradeSubmission`
- `src/pages/api/practice/sessions.ts:6,13,38-40,49-82` — save-session route: auth, re-validation, server regrade, persist
- `src/lib/db/sessions.ts:46-61,63-140` — row mappers, `saveSession`/`listSessions`/`listSessionsFull`/`getSession`/`deleteSession`, unchecked `Json` casts
- `src/db/database.types.ts:47-82` — generated Supabase types for `practice_sessions`
- `supabase/migrations/20260619111103_create_practice_sessions.sql:5-31` — table schema + RLS policies (no UPDATE)
- `src/types.ts:6-7,34-57,94-120` — shared kernel types (`Question`, `PracticeSession`, `SessionPayload`, `SavedSession(Summary)`)
- `src/lib/practice/progress.ts:14-97` — per-exam grouping, weak-topic threshold
- `src/pages/dashboard.astro`, `src/components/dashboard/ProgressDashboard.tsx:32-136` — dashboard read-back and trend rendering
- `src/pages/history.astro`, `src/pages/history/[id].astro`, `src/components/practice/HistoryList.tsx`, `src/components/practice/SavedSessionView.tsx` — history list/detail/delete
- `tests/e2e/practice-flow.spec.ts:24-76` — the single E2E happy-path spec

## Architecture Insights

- **Two independent validation gates, both fail loud**: LLM-output boundary
  (`question-generator.ts`) and session-save boundary (`sessions.ts` re-validating +
  server regrade). This is a deliberate "never trust the client, never trust the
  model" pattern, consistently applied — except at the DB read boundary (see
  Technical debt #1), which is the one place the pattern isn't extended.
- **`z.infer`-derived types** (`Question` from `questionSchema`) avoid the classic
  "hand-written type drifts from its validator" bug — the schema *is* the type. The
  DB side doesn't have this property (`database.types.ts` is generated separately from
  `SessionPayload`), which is exactly why the DB side is the weaker link.
- **Immutable session rows** (no UPDATE RLS policy) is a simple, defensible design for
  an append-only practice log, but it also means any future payload-shape migration
  has no in-place update path — old rows must be read-adapted forever or backfilled.
- **Layering matches the dependency-cruiser instability gradient** from the repo map:
  this flow's UI/API layer (I=1.0) depends inward on a stable service/db core, with no
  violations found in either the structural graph or this deeper trace.

## Historical Context (from prior changes)

- `context/foundation/lessons.md:5-10` — "LLM latency scales with requested output
  volume" — the exact count-cap/timeout coupling this research reconfirmed as already
  resolved (cap lowered from 20 to 5 following a measured ~9009ms run at count 10).
- `context/archive/2026-06-19-session-persistence-history/plan.md:148-157,215-218,442-444`
  — documents the manual `supabase gen types` process this research flags as
  undocumented-in-the-active-workflow (Technical debt #2) — it *was* documented once,
  in an archived plan, but nothing carries that forward as an enforced step.
- `context/archive/2026-06-18-question-generation-engine/change.md` — origin of the
  F-01 generation-engine slice; the count-cap history traces back to this slice's
  follow-up notes.
- `context/map/repo-map.md` §3–4 — this research's file-level findings (types.ts
  fan-out, layering) confirm and sharpen the folder-level dependency-cruiser signal
  the repo map already surfaced; no contradictions found between the two.

## Related Research

- `context/map/repo-map.md` and its three source artifacts (`context/map/artifact-1-territory.md`,
  `artifact-2-structure.md`, `artifact-3-contributors.md`) — M4L2 predecessor this
  research builds on.

## Open Questions

- Should the DB read-back path (`db/sessions.ts`) get a `safeParse` guard now, or is
  that better scoped as a dedicated refactor-opportunity item for M4L4? (Leaning
  toward: flag it there — it's a genuine refactor, not a quick fix, since it needs a
  decision on how to handle already-invalid legacy rows.)
- Is a faster/streaming model swap in scope for this certification cycle, or does the
  count-cap-at-5 constraint stay as documented, accepted debt?
- Would a local Supabase instance in CI be justified just to close the RLS-untested
  gap, or is that disproportionate to the current single-table scope?

## Refactor opportunities

_M4L4 pass over the Technical debt list above. Each item classified KANDYDAT (real
refactor candidate) or not, before investigating the candidates further._

### Classification

| Debt item | Class | Reasoning |
|---|---|---|
| 1. Unvalidated DB read-back (`db/sessions.ts`) | **KANDYDAT** | Structural gap in an otherwise-consistent validation pattern; fixable by changing code shape, not by adding a test. |
| 2. Manual `database.types.ts` sync | **KANDYDAT** | Process/tooling gap with a concrete automatable fix (CI drift check). |
| 3. `openrouter.ts` untested | Not a candidate | Pure testing gap — the code shape is fine, it just lacks a test file. Belongs on a test-plan, not a refactor plan. |
| 4. `db/sessions.ts` query layer untested | Not a candidate | Same — testing gap, not a shape problem. |
| 5. Single-golden-path E2E | Not a candidate | Testing gap. |
| 6. Count-cap-at-5 (latency-coupled) | Not a candidate | Already resolved and documented in `lessons.md`; re-opening it means a model/architecture change, not a refactor of existing code. |

Two real candidates. Both investigated below.

### Candidate A — DB read-back has no validation boundary

- **Current shape**: `db/sessions.ts:73` writes `payload` with an unchecked cast
  (`as unknown as ...Insert["payload"]`); reads at `:96,111,130` cast Supabase's
  untyped `Json` column straight to `SummaryRow`/`SessionRow` with no `zod.safeParse`.
  Every *other* boundary in this flow validates (LLM output, client-submitted
  answers) — this is the one place the pattern was dropped. Archetype-wise this is a
  thin Transaction Script (`saveSession`/`listSessions`/etc. are flat functions, no
  aggregate object) — appropriate for the feature's current size, so the fix is a
  guard added to the existing shape, not a model rewrite.
- **History and intentionality**: `context/archive/2026-06-19-session-persistence-history/plan.md`
  designed the write-side validation (`sessions.ts` route-level zod) deliberately, but
  the plan's scope stopped at "save," never circling back to "read." Reads
  `git blame`-style back to that slice, single commit, no follow-up ticket exists —
  this reads as scope boundary, not a considered trade-off, i.e. an *accidental* gap,
  not an intentional one. Safe to close without cross-checking a design decision.
- **Migration feasibility**: additive-only. Add a `sessionPayloadSchema` (zod) next to
  `SessionPayload` in `types.ts`, `safeParse` at the three read call sites in
  `db/sessions.ts`, and decide a failure policy (skip the row + log, vs. surface a
  degraded-row placeholder). No existing call site needs to change shape — this is a
  **guard, not a rebuild**. Single revertible commit; the "what to do on legacy-shape
  mismatch" sub-decision needs an explicit answer (see Open Questions above), but
  doesn't block adding the guard itself.

### Candidate B — `database.types.ts` drifts silently from the real schema

- **Current shape**: `database.types.ts` is committed, hand-generated, with no
  script (`package.json` has no `db:types` entry) and no CI step referencing it.
  `supabase` (v2.98.2) is already a devDependency and the project is CLI-linked
  (`supabase/.temp/linked-project.json` exists), so the tooling to regenerate is
  already present locally — it's just not wired into any automated check.
- **History and intentionality**: the manual-regen process is documented once, inside
  an *archived* plan (`context/archive/2026-06-19-session-persistence-history/plan.md:148-157`),
  as a one-time step for that slice, not as a standing process. No later change
  re-established it as a habit — this is process debt that was correct at the time and
  never generalized, not a deliberate "we accept drift" decision.
- **Migration feasibility**: add `"db:types": "supabase gen types typescript --project-id <ref> > src/db/database.types.ts"` to `package.json`, and a CI check (new job or step in `ci.yml`) that runs it against a linked project and fails the build on a diff (`git diff --exit-code src/db/database.types.ts`). Requires a `SUPABASE_ACCESS_TOKEN` secret (project already manages `SUPABASE_URL`/`SUPABASE_KEY` secrets, so the secret-provisioning pattern already exists) — no code-shape change, purely additive CI wiring. Single revertible commit.

### Ranking

1. **Candidate A** (validation guard) — higher risk if left alone (silent UI bugs on
   legacy rows), pure-addition fix, no external dependency (no new secret needed).
   Do first.
2. **Candidate B** (types-drift CI check) — lower immediate risk (nothing has drifted
   yet, single migration exists), needs one new CI secret. Do second.

Both are safe, additive, single-phase, fully reversible — plan.md sequences them
guard-first per the ranking above.
