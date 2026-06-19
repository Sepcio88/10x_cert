# Session Persistence & History (S-03) — Plan Brief

> Full plan: `context/changes/session-persistence-history/plan.md`

## What & Why

Persist completed practice sessions to the database and let a signed-in developer
revisit them. Today a session lives only in client React state and is lost on reload;
this slice delivers FR-008 (saved session) and FR-009 (revisit), honoring the
"saved sessions are never lost" guardrail. It is the **first** slice to introduce a
database table — establishing the migration/RLS/data-access patterns S-04 and S-05 build on.

## Starting Point

The generate → answer → summary flow (S-01, S-02) is complete and fully client-side:
`PracticeGenerator` holds the `PracticeSession` in state and computes the score in the
browser. The data layer is greenfield — no migrations, no app tables, an untyped anon-key
Supabase client. Auth is wired (`context.locals.user`, `PROTECTED_ROUTES` middleware).

## Desired End State

Finishing a session saves it automatically. `/history` lists past sessions
(provider/exam · date · score · question count, newest first); opening one shows the
full explanation-first review (reusing `SessionReview`); sessions can be deleted behind
a confirmation. Everything is private per user via RLS, and save failures keep results
on screen with a Retry.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Save model | Save-on-complete (single write at summary) | Simplest path that meets the never-lost guardrail; fits the 2-week budget | Plan |
| Schema | One table + JSONB payload + queryable columns | Matches "minimal schema only"; serves list (columns) and revisit (JSONB) at small scale | Plan |
| Score integrity | Server recomputes from submitted payload | Cheap guard against client scoring bugs without trusting a client-sent number | Plan |
| Forward-compat | Store topic + provider/exam/timestamps now | Free data in hand; unblocks S-04/S-05 with no future migration | Plan |
| History UX | Dedicated `/history` page | Keeps `/dashboard` free for the S-04 progress view; clean room to grow | Plan |
| Revisit view | Reuse `SessionReview` via a reconstructed session | Zero new review UI, identical UX, satisfies FR-009 directly | Plan |
| Migration apply | Supabase CLI `db push` + `gen types` | Versioned, repeatable, typed queries | Plan |
| Save failure | Keep results on screen + explicit Retry | Honors never-lost; never silently drops a finished session | Plan |
| Testing | Unit + mocked-endpoint + manual RLS | Matches existing conventions; no new infra | Plan |
| Delete | In scope, confirm-gated, owner RLS policy | User-intended deletion is compatible with never-lost (guards accidental loss) | Plan |

## Scope

**In scope:** one `practice_sessions` table + RLS; typed client; sessions service +
pure regrade; save-on-complete endpoint + client wiring; `/history` list + `/history/[id]`
revisit; delete with confirmation; empty-state.

**Out of scope:** resume in-progress sessions; pagination/filter/search; per-topic
breakdown UI and progress trend (S-04); weak-topic retry (S-05); edit/rename; batch mode;
offline queue; Playwright/E2E.

## Architecture / Approach

`practice_sessions` row = queryable columns (user_id, provider, exam, correct, total,
percentage, created_at) + JSONB `payload` (`{ questions, answers }`). A server-side
`src/lib/db/sessions.ts` wraps all queries (discriminated-result style); a pure
`gradeSubmission` recomputes authoritative correctness/score. Client posts the completed
session to `POST /api/practice/sessions`; `/history` + `/history/[id]` are SSR pages reading
through the RLS-scoped client, reusing `SessionReview`. `DELETE /api/practice/sessions/[id]`
backs the delete control.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data layer | Migration + RLS, typed `Database`, sessions service + pure regrade, unit tests | First migration; RLS correctness rests on manual verification |
| 2. Save-on-complete | Save endpoint (server regrade) + client wiring with Retry | Trusting/validating the client payload; failure UX |
| 3. History + revisit | `/history` list + `/history/[id]` detail reusing `SessionReview` | Index-aligned reconstruction for the review component |
| 4. Delete | DELETE endpoint + confirm-gated per-row control | RLS scoping so deletes can't cross users |

**Prerequisites:** S-02 done (it is); Supabase CLI linked to the hosted project for `db push` + `gen types`.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Assumes the Supabase CLI can be linked for `db push`/`gen types`; dashboard-SQL fallback exists.
- RLS isolation is verified manually (two users), not by automated tests.
- Reused `SessionReview` requires stored `answers` to stay index-aligned with `questions`.

## Success Criteria (Summary)

- A completed session is saved automatically and appears on `/history`; opening it shows correctness + explanation-first review.
- Sessions are private per user (a second user sees none) and survive reload; save failures never silently lose a finished session.
- A user can delete their own session behind a confirmation; cannot affect others'.
