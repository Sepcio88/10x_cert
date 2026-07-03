# Practice-flow refactor opportunities — Plan Brief

> Full plan: `context/changes/practice-flow-analysis/plan.md`
> Research: `context/changes/practice-flow-analysis/research.md`

## What & Why

Close the two refactor-worthy gaps found while researching the
practice-generation-and-grading flow (M4L3/M4L4 certification artifacts):
the DB read boundary trusts Supabase's JSONB payload without validating it,
and `database.types.ts` can silently drift from the real schema since
nothing checks it automatically.

## Starting Point

Every other boundary in this flow validates untrusted input (LLM output via
zod, client-submitted answers via zod + server regrade) — except reads in
`src/lib/db/sessions.ts`, which cast Supabase's `Json` payload column
straight to app types with `as unknown as ...`, no parse. Separately,
`database.types.ts` is hand-regenerated with no script and no CI check, a
process only ever documented once, in an archived plan.

## Desired End State

Reads in `db/sessions.ts` validate the payload shape and drop/log any row
that doesn't match, instead of silently rendering `undefined` fields in the
UI. CI hard-fails if `database.types.ts` no longer matches the live
Supabase schema, instead of letting it drift unnoticed.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Failure policy for a bad saved row | Skip + log, keep the list working | Matches this file's existing degrade-and-`console.error` convention rather than crashing a whole page over one row | Plan (asked) |
| Guard scope | All three read call sites (`listSessions`, `listSessionsFull`, `getSession`) | Closes the gap completely and consistently, matching the "guard every boundary" pattern already used elsewhere in this flow | Plan (asked) |
| Type representation | `AnswerRecord`/`SessionPayload` become `z.infer` types from a new schema, not hand-written interfaces | Mirrors `Question`, which already proves this pattern in the codebase and makes drift structurally impossible, not just checked | Research → Plan |
| CI drift-check mode | Hard fail | Matches this repo's existing CI philosophy — lint/test/missing-secrets already hard-fail today | Plan (asked) |
| Write-side cast (`saveSession`) | Left as-is, explicitly out of scope | Payload reaching it is already zod-validated one layer up in the API route; lower risk than the read side | Research |

## Scope

**In scope:**
- New `session-schema.ts` (zod) for `AnswerRecord`/`SessionPayload`
- Validated reads in `db/sessions.ts` (drop-and-log on failure)
- `npm run db:types` script + a hard-failing CI drift-check job

**Out of scope:**
- `saveSession`'s write-side cast (already validated upstream)
- Any logging/observability abstraction beyond existing `console.error`
- A UI banner for dropped/unavailable sessions
- RLS integration testing (separate technical-debt item, not a refactor)
- Actually reconciling drift if `database.types.ts` turns out to be stale today — Phase 2 only adds the check

## Architecture / Approach

Phase 1 gives the session-payload shape the same "zod schema is the type"
treatment `Question` already has, then threads a `safeParse` through the
three read functions with one shared drop-and-log helper. Phase 2 is pure
CI/tooling — a script plus a new, independent GitHub Actions job that
regenerates types against the live (already-linked) Supabase project and
diffs against what's committed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Validate the DB read boundary | Zod-backed reads in `db/sessions.ts`; malformed rows degrade instead of silently breaking the UI | Low — additive, all-compile-error-safe by construction |
| 2. Automated `database.types.ts` drift check | `npm run db:types` + a hard-failing CI job | Needs a new `SUPABASE_ACCESS_TOKEN` GitHub secret — a manual, human-only setup step |

**Prerequisites:** none for Phase 1. Phase 2 needs a Supabase personal
access token added as a GitHub secret before its CI job can pass (documented
as a manual step in the plan).
**Estimated effort:** ~1 session, single-phase-each, both fully revertible.

## Open Risks & Assumptions

- Assumes the schema hasn't actually drifted yet (only one migration exists)
  — Phase 2 adds detection, not remediation, so if it does fail on first run
  that's a follow-up, not a plan defect.
- Phase 2's CI job can only be proven end-to-end once the
  `SUPABASE_ACCESS_TOKEN` secret exists — until then its automated
  verification is partially blocked on a manual prerequisite.

## Success Criteria (Summary)

- A session row with a malformed payload no longer renders broken/`undefined`
  UI — it's absent, with a log line, and everything else still works.
- A future schema change that isn't followed by regenerating
  `database.types.ts` fails CI immediately instead of shipping silently.
