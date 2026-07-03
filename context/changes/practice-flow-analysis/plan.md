# Practice-flow refactor opportunities — Implementation Plan

## Overview

Close the two refactor-worthy gaps identified in `research.md`'s M4L4
"Refactor opportunities" section: (1) the DB read boundary in
`src/lib/db/sessions.ts` casts Supabase's untyped `Json` payload straight to
app types with no validation — the one boundary in this flow that doesn't
follow the "guard, don't trust" pattern used everywhere else — and (2)
`src/db/database.types.ts` is synced with the real Supabase schema by hand,
with no automated check that it hasn't drifted.

## Current State Analysis

- `src/lib/db/sessions.ts:73,96,111,130` — every read/write touching the
  `payload` JSONB column uses an unchecked TS cast (`as unknown as ...`), not
  a validated parse. `AnswerRecord`/`SessionPayload` (`src/types.ts:34-41,100-103`)
  are hand-written `interface`s, not `z.infer` types — unlike `Question`
  (`src/types.ts:6-7`), which is derived from `question-schema.ts`'s zod
  schema and therefore cannot drift from its validator.
- `src/db/database.types.ts` is a committed, hand-generated file. No
  `package.json` script and no CI step regenerates or checks it. The only
  record of the manual process is in an archived plan
  (`context/archive/2026-06-19-session-persistence-history/plan.md:148-157`).
  The `supabase` CLI (v2.98.2) is already a devDependency and the project is
  CLI-linked (`supabase/.temp/linked-project.json` → project ref
  `pysbtxstgciylnfkcsdm`), so the tooling to regenerate already exists — it's
  just not wired into anything automated.
- Existing failure convention in this file: reads (`listSessions`,
  `listSessionsFull`, `getSession`) degrade to `[]`/`null` on a Supabase
  error and `console.error` it (the file's own header comment says so
  explicitly, `sessions.ts:6-11`); writes return a discriminated
  `{ ok: false, error }` result. New validation failures should follow the
  **read** convention (degrade + log), not invent a new error-handling shape.
- `.github/workflows/ci.yml` already has a precedent for a hard-fail
  "verify required secrets" step (the `deploy` job, `ci.yml:84-100`) — the new
  drift-check job follows the same shape.

## Desired End State

Every place `src/lib/db/sessions.ts` turns Supabase's `Json` payload column
into an app-level type does so through a zod parse, not an unchecked cast. A
row that fails validation is dropped (list reads) or treated as not-found
(single-row read) and logged — it never reaches the UI as a crash or as
`undefined` field access. Separately, CI fails loudly if
`src/db/database.types.ts` no longer matches the live Supabase schema,
instead of silently going stale.

Verification: `npm run test` covers the new validation paths; a manually
crafted malformed row (see Phase 1 manual verification) is dropped, not
thrown; a manually introduced no-op schema change to `database.types.ts`
(see Phase 2 manual verification) makes the new CI job fail.

### Key Discoveries:

- `Question` already proves the target pattern works in this codebase —
  `z.infer<typeof questionSchema>` (`src/types.ts:6-7`) means the type
  *cannot* diverge from its validator. Applying the same shape to
  `AnswerRecord`/`SessionPayload` is a proven, not novel, pattern here.
- The write path (`saveSession`, `sessions.ts:73`) already receives
  pre-validated data — the API route re-validates with
  `z.array(questionSchema)` before calling it
  (`src/pages/api/practice/sessions.ts:13`) — so the write-side cast is lower
  risk than the read-side ones and is explicitly out of scope (see below).

## What We're NOT Doing

- Not touching `saveSession`'s write-side cast (`sessions.ts:73`) — the
  payload reaching it is already zod-validated one layer up in the API
  route; re-typing the `Insert["payload"]` column properly is a
  `database.types.ts`-generation concern, which overlaps with Phase 2's
  scope, not Phase 1's.
- Not adding a logging/observability abstraction (Sentry, structured
  logger, etc.) — `console.error` is the established pattern in this file
  and this plan follows it, not replaces it.
- Not building a UI-facing "some sessions couldn't load" banner — dropped
  rows fail silently to the user by design per the chosen failure policy
  (skip + log); surfacing that in the UI is a separate feature decision,
  not a refactor.
- Not adding a local/CI Supabase instance to test RLS boundaries — that's a
  distinct testing-gap item from `research.md`'s Technical debt list (#4),
  not a refactor-opportunities item, and out of scope here.
- Not re-generating `database.types.ts` as part of this change — Phase 2
  only adds the *check*; if it currently reports drift, reconciling that is
  a follow-up, not blocking this plan (the schema has been stable at one
  migration since inception, so no drift is expected).

## Implementation Approach

Two independent, additive, single-phase changes, sequenced guard-first per
`research.md`'s ranking (Candidate A before B: A closes a live silent-bug
risk, B is preventive for a schema that hasn't drifted yet). Neither phase
depends on the other; each is its own revertible commit.

## Phase 1: Validate the DB read boundary

### Overview

Give `AnswerRecord`/`SessionPayload` the same `z.infer`-from-schema treatment
`Question` already has, then use that schema to validate (not just cast)
every read in `src/lib/db/sessions.ts`. A row that fails validation is
dropped from list reads and logged; `getSession` returns `null` and logs
(mirrors "not found," consistent with the file's existing degrade-on-error
convention).

### Changes Required:

#### 1. New schema module

**File**: `src/lib/db/session-schema.ts` (new)

**Intent**: Define `answerRecordSchema` and `sessionPayloadSchema` as the
single source of truth for the session-payload shape, mirroring
`question-schema.ts`'s existing style (plain `z.object`, no exotic
refinements needed here since there's no cross-field invariant to enforce
beyond what `questionSchema` already checks).

**Contract**:
```ts
export const answerRecordSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionId: z.string().min(1),
  correct: z.boolean(),
});

export const sessionPayloadSchema = z.object({
  questions: z.array(questionSchema),
  answers: z.array(answerRecordSchema),
});
```
(`questionSchema` imported from `@/lib/services/question-schema`, matching
the existing import path convention.)

#### 2. Derive types from the new schema instead of hand-writing them

**File**: `src/types.ts`

**Intent**: Replace the hand-written `AnswerRecord` (`:34-41`) and
`SessionPayload` (`:100-103`) interfaces with `z.infer` types sourced from
the new schema module, closing the type/validator drift risk permanently
rather than validating against a separately-maintained shape.

**Contract**: `export type AnswerRecord = z.infer<typeof answerRecordSchema>;`
and `export type SessionPayload = z.infer<typeof sessionPayloadSchema>;`,
importing both schemas from `@/lib/db/session-schema`. Field-for-field
identical to the current interfaces (structural typing means no downstream
file needs to change) — this is a pure representation swap, not a shape
change. Keep the existing JSDoc comments on both.

#### 3. Validate at every read call site

**File**: `src/lib/db/sessions.ts`

**Intent**: Replace the three unchecked casts on read
(`:96` `data as SummaryRow[]`, `:111` `data as unknown as SessionRow[]`,
`:130` `data as unknown as SessionRow`) with a `safeParse` against the new
schema. On failure: `listSessions`/`listSessionsFull` drop the offending row
from the returned array and `console.error` it (row id + zod error, same
style as the existing `error.message` logs at `:93,108,124`); `getSession`
logs and returns `null`, same as its existing not-found/error paths.

**Contract**: Add a small `sessionRowSchema`/`summaryRowSchema` pair (zod
`z.object` over `SummaryRow`/`SessionRow`'s own fields, with `payload:
sessionPayloadSchema` on the full-row variant) local to this file — these
validate the *row shape itself* (including the JSONB payload), not just
re-export the payload schema. Introduce one private helper, e.g.
`parseRows<T>(rows: unknown[], schema, context: string): T[]` used by
`listSessions`/`listSessionsFull`, and a matching single-row variant for
`getSession`, so the three call sites share one drop-and-log
implementation rather than three copies of the same logic.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `npx astro check`
- [ ] Lint passes: `npm run lint`
- [ ] Unit tests pass: `npm run test`
- [ ] New tests added and passing: a malformed row (e.g. `payload.answers`
      missing `correct`) is dropped by `listSessions`/`listSessionsFull` and
      makes `getSession` return `null`, without throwing — test at the
      parse-helper level, following `sessions.test.ts`'s existing pattern of
      testing pure functions with plain object fixtures (no Supabase client
      mock needed)
- [ ] Existing tests in `src/lib/db/sessions.test.ts` still pass unmodified
      (the row→DTO mapping behavior for valid rows is unchanged)

#### Manual Verification:

- [ ] Insert one syntactically-valid-but-schema-invalid row directly via the
      Supabase SQL editor against the dev project (e.g. `payload` missing
      the `answers` key), then load `/history` and `/dashboard` locally —
      confirm the page renders normally with that row simply absent, and
      confirm the dropped-row log line appears in the dev server console
- [ ] Confirm a normal, valid session (generate → answer → save) still
      appears correctly in both `/history` and `/dashboard` after this
      change — no regression to the happy path

---

## Phase 2: Automated drift check for `database.types.ts`

### Overview

Add an `npm` script that regenerates `database.types.ts` from the live
Supabase schema, and a CI job that runs it and hard-fails the build if the
regenerated file differs from what's committed — turning silent schema
drift into a loud, blocking CI failure, matching this repo's existing
CI philosophy (`ci.yml` already hard-fails on lint/test/missing secrets).

### Changes Required:

#### 1. Regeneration script

**File**: `package.json`

**Intent**: Give the manual `supabase gen types` process (currently
documented only in an archived plan) a first-class, discoverable command any
future change can re-run after a migration.

**Contract**: add `"db:types": "supabase gen types typescript --project-id pysbtxstgciylnfkcsdm --schema public > src/db/database.types.ts"` to `scripts`.

#### 2. CI drift-check job

**File**: `.github/workflows/ci.yml`

**Intent**: A new job, independent of the existing `ci`/`e2e`/`deploy` jobs
(no `needs:`, so it runs in parallel and doesn't slow down the existing
pipeline), that regenerates the types file into a temp path and diffs it
against the committed one, failing the build on any difference. Mirrors the
existing `deploy` job's "verify required secrets first" pattern
(`ci.yml:84-100`) so a missing token fails with a clear message instead of
an opaque CLI auth error.

**Contract**: new job `db-types-drift`, triggers `push`/`pull_request` to
`main` (same as the top-level `ci` job), steps: checkout → setup-node →
`npm ci` → verify `SUPABASE_ACCESS_TOKEN` secret is set (fail with
`::error::` if not, same style as `ci.yml:96-98`) → run
`npx supabase gen types typescript --project-id pysbtxstgciylnfkcsdm --schema public` with `SUPABASE_ACCESS_TOKEN` in env, redirected to a temp
file → `diff` (or `git diff --no-index --exit-code`) that temp file against
`src/db/database.types.ts` → non-zero exit fails the job.

### Success Criteria:

#### Automated Verification:

- [ ] `npm run db:types` runs locally and produces output structurally
      matching the current `src/db/database.types.ts` (confirms the script
      and project ref are correct) — requires a local `SUPABASE_ACCESS_TOKEN`;
      run manually once during implementation, not part of the CI-run
      automated suite
- [ ] New `db-types-drift` CI job appears in a PR's checks and passes when
      `database.types.ts` is up to date

#### Manual Verification:

- [ ] Generate a Supabase personal access token
      (supabase.com/dashboard/account/tokens) and add it as the
      `SUPABASE_ACCESS_TOKEN` GitHub Actions secret on this repo — this is a
      one-time setup step only the repo owner can do (requires their
      Supabase account); the CI job fails with a clear
      missing-secret message until this is done
- [ ] Open a throwaway PR that hand-edits one field in
      `src/db/database.types.ts` (simulating drift) and confirm the new CI
      job fails; then revert and confirm it passes — proves the check
      actually catches drift, not just that it runs

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human that
the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:

- New: parse-helper tests in `src/lib/db/sessions.test.ts` (or a sibling
  `session-schema.test.ts`) covering valid rows (pass through unchanged,
  matching existing `rowToSummary`/`rowToSaved` fixtures) and invalid rows
  (dropped, not thrown) for both the list and single-row shapes.
- Existing: no changes needed to `session.test.ts`, `progress.test.ts`,
  route-level tests — none of them touch the read-parse boundary directly.

### Integration Tests:

- None added — Phase 1's manual verification (SQL-editor-inserted bad row →
  page still renders) covers the one integration scenario that matters here
  and doesn't justify standing up a Supabase test harness for a two-line
  guard (see "What We're NOT Doing").

### Manual Testing Steps:

1. Phase 1: insert a malformed `payload` row via Supabase SQL editor, load
   `/history` and `/dashboard`, confirm graceful degradation + log line.
2. Phase 1: run the full happy path (generate → answer → save) once more,
   confirm no regression.
3. Phase 2: provision the `SUPABASE_ACCESS_TOKEN` secret, open a
   drift-simulating throwaway PR, confirm the new job fails, then confirm it
   passes once reverted.

## Performance Considerations

Negligible — `safeParse` on a handful of small objects per page load is not
a measurable cost next to the existing OpenRouter/Supabase network calls in
this flow.

## Migration Notes

No data migration needed. Existing rows are read through the new validation
on the next request; nothing is rewritten in place (consistent with
`practice_sessions` having no UPDATE policy — see `research.md`'s
Architecture Insights). Rows that happen to already be invalid under the
current schema (none expected — the schema hasn't changed since the single
existing migration) would simply stop appearing, per the chosen failure
policy.

## References

- Research: `context/changes/practice-flow-analysis/research.md` (Technical
  debt #1–#2, Refactor opportunities — Candidates A & B)
- Repo map: `context/map/repo-map.md`, `context/map/artifact-2-structure.md`
- Pattern to follow: `src/lib/services/question-schema.ts:12-29` (existing
  zod-schema-as-source-of-truth style)
- Existing hard-fail CI precedent: `.github/workflows/ci.yml:84-100`
  (`deploy` job's "verify required secrets" step)
- Manual regen process this formalizes:
  `context/archive/2026-06-19-session-persistence-history/plan.md:148-157`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Validate the DB read boundary

#### Automated

- [ ] 1.1 Type checking passes: `npx astro check`
- [ ] 1.2 Lint passes: `npm run lint`
- [ ] 1.3 Unit tests pass: `npm run test`
- [ ] 1.4 New malformed-row tests added and passing
- [ ] 1.5 Existing `sessions.test.ts` tests still pass unmodified

#### Manual

- [ ] 1.6 Malformed row inserted via SQL editor; `/history` and `/dashboard` degrade gracefully with a log line
- [ ] 1.7 Happy-path session (generate → answer → save) still works end to end

### Phase 2: Automated drift check for `database.types.ts`

#### Automated

- [ ] 2.1 `npm run db:types` runs locally and matches the current committed file
- [ ] 2.2 New `db-types-drift` CI job passes on a clean PR

#### Manual

- [ ] 2.3 `SUPABASE_ACCESS_TOKEN` GitHub secret provisioned
- [ ] 2.4 Drift-simulating throwaway PR confirms the job fails, then passes once reverted
