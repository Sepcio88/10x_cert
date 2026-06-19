# Per-topic Breakdown + Per-exam Progress Dashboard (S-04) — Plan Brief

> Full plan: `context/changes/progress-dashboard/plan.md`

## What & Why

Deliver roadmap slice S-04 on top of S-03's persistence: a **per-topic/domain breakdown**
of a session (FR-008) so users see which areas are weak, and a **per-exam progress trend**
on the home page (FR-010) so they see improvement over time. This is the slice that was
blocked on the cross-exam metric question — now resolved as per-exam aggregation.

## Starting Point

S-03 persists every completed session and exposes `listSessions` (returns `provider, exam,
correct, total, percentage, createdAt` per session) plus the full `{questions, answers}`
payload with a `topic` on each question. The summary and revisit views show overall score
and per-question review, but no per-topic aggregation. `/dashboard` is an auth-gated stub.
No chart library is installed.

## Desired End State

Finishing or revisiting a session shows color-coded per-topic bars (correct/total per
domain). `/dashboard` shows a line of score-over-time for one exam, defaulting to the most
recently practiced, with a dropdown to switch exams, a caption, and a history link. Exams
are never blended; one-session exams show a single point + hint; new users get a CTA.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Cross-exam metric | Per-exam aggregation (never blend exams) | Averaging different exams misleads (PRD Open Q#2) | Prior session |
| Home view | Most-recent exam default + dropdown switcher | Immediately relevant, scales as exams grow | Prior session |
| Trend chart | Hand-rolled inline SVG line | No dependency, fine for small data, lean bundle | Plan |
| Trend metric | Raw score % per session | Honest, simple, uses stored percentage directly | Plan |
| Topic breakdown UI | Color-coded horizontal bars | Scannable "where am I weak"; matches existing style | Plan |
| Breakdown placement | Both summary + revisit (shared component) | FR-008 ties it to the session; reuse one component | Plan |
| Topic scope | Per-session only (defer cross-session to S-05) | Clean slice boundary; S-05 owns weak-topic ID | Plan |
| Dashboard content | Trend + switcher + caption + history link | Useful home without clutter | Plan |
| Thin/empty data | Single-point + hint; zero-state CTA | Honest at every data volume; mirrors /history empty state | Plan |
| Switcher UX | Dropdown `<select>` | Scales to many exams; reuses existing select styling | Plan |
| Testing | Unit-test pure aggregations; manual UI | Covers the real bug surface; matches S-03 convention | Plan |

## Scope

**In scope:** pure `topicBreakdown` + `TopicBreakdown` bars (on summary + revisit); pure
`progress.ts` aggregation; `ProgressDashboard` island (SVG line, dropdown, caption, history
link, thin/empty states); `/dashboard` SSR wiring; unit tests for both aggregations.

**Out of scope:** cross-session topic analytics (S-05); chart library; rolling/cumulative
averages; recent-sessions list or stats panel on the dashboard; schema/API changes;
component-render test harness.

## Architecture / Approach

No new data layer — `/dashboard` does an SSR `listSessions(user.id)` and hands the array to
the `ProgressDashboard` island, which groups by `exam` in JS (`progress.ts`), defaults to the
most-recent exam, and renders an inline SVG line (raw % per session, y fixed 0–100, ordered
oldest→newest). `topicBreakdown` (pure, in `session.ts`) groups a session's answers by
`question.topic`; `TopicBreakdown` renders the bars and is mounted on both the live summary
and the saved-session revisit.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Per-topic breakdown | `topicBreakdown` + bars on summary & revisit | Grouping correctness + deterministic topic order |
| 2. Progress dashboard | Per-exam SVG trend + switcher on /dashboard | SVG scaling/ordering; thin & empty data states |

**Prerequisites:** S-03 done (it is). No new deps, no migration.
**Estimated effort:** ~1–2 sessions across 2 phases.

## Open Risks & Assumptions

- Per-exam trends are thin until a user has several sessions of the same exam — handled with a single-point hint.
- Hand-rolled SVG must fix the y-axis to 0–100 (not auto-scale) or small score wobbles look dramatic.
- `topicBreakdown` trusts the stored server-recomputed `answer.correct` from S-03 (sound — it's authoritative).

## Success Criteria (Summary)

- Per-topic bars appear on the summary and on `/history/[id]`, color-coded and accurate.
- `/dashboard` shows the most-recent exam's score-over-time trend; switching exams re-renders without blending.
- One-session exams and zero-session accounts show honest, non-broken states.
