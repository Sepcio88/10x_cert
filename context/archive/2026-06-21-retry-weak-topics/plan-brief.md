# Retry Fresh Questions on Weak Topics (S-05) — Plan Brief

> Full plan: `context/changes/retry-weak-topics/plan.md`

## What & Why

The last roadmap slice (FR-011): let a developer start a new session of **freshly generated**
questions targeting the exam topics they've historically been weakest on — reinforcing the
on-demand-generation bet (fresh material, never a memorizable replay). Builds on F-01
(generation), S-03 (persistence), and S-04 (per-topic breakdown).

## Starting Point

Generation takes only `{ exam, count }`. The full generate→answer→save loop lives in one island
(`PracticeGenerator`) on `/practice`. S-04 gives per-session `topicBreakdown`, but cross-session
weak-topic aggregation was explicitly deferred here. `listSessions` returns summaries (no
payload); the dashboard already SSR-fetches sessions and renders a per-exam trend with a switcher.

## Desired End State

On `/dashboard`, an exam with historically weak topics (sub-70% all-time) shows a "Retry weak
topics" button; clicking it opens `/practice` pre-filled and auto-generates a fresh set focused
on those topics. The user answers it with normal feedback, and it saves as an ordinary session
that feeds future weak-topic calcs. All-strong exams show no button.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Entry point / scope | Cross-session, per exam, from /dashboard | Matches FR-011 "previously got wrong"; uses S-04's deferred aggregation | Plan |
| Weak-topic threshold | Below 70% accuracy | Tolerant of one unlucky miss; targets genuine gaps | Plan |
| History window | All sessions for the exam (all-time) | Most stable signal; simplest; small data | Plan |
| Retry count | Reuse the existing 1–5 picker | Consistent with normal generation; respects F-01's count cap | Plan |
| Launch mechanism | Link to /practice?exam=…&topics=csv; auto-start | Reuses the whole existing loop unchanged | Plan |
| No-gaps state | Hide/disable retry + short note | Never launches an empty/pointless retry | Plan |
| Set fill | Spread N across weak topics only | Every question targets a real gap | Plan |
| Generation targeting | Extend generateQuestions with optional topics[] | Clean, typed, backward-compatible; keeps stored exam clean | Plan |
| Retry persistence | Save as a normal session (no marker) | Zero schema/flow change; a strong retry lifts the topic out of "weak" | Plan |
| Testing | Unit aggregation + prompt-targeting; manual rest | Covers the real bug surface; matches S-03/S-04 | Plan |

## Scope

**In scope:** optional `topics[]` on generation + endpoint; pure cross-session `weakTopics`/
`weakTopicsByExam`; server-only full-session read; dashboard "Retry weak topics" button (per
exam, hidden when none); `PracticeGenerator` query-param auto-start; unit tests for aggregation + targeting.

**Out of scope:** schema/columns; a "retry" session type; summary-only/in-session retry; general
fill; exam blending; recency windows; chart/E2E harness.

## Architecture / Approach

Optional `topics?: string[]` threads into `buildMessages` as a focus instruction and through
`/api/practice/generate`. The dashboard SSR loads full sessions, computes `weakTopicsByExam`
server-side (payloads never reach the client), and passes the map + summaries to
`ProgressDashboard`, which shows a per-exam retry link to `/practice?provider=…&exam=…&topics=csv`.
`PracticeGenerator` reads those params on mount and auto-starts a targeted generation; the rest
of the loop is reused untouched.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Targeted generation | optional topics[] on engine + endpoint | Backward-compat (no change when topics absent) |
| 2. Weak-topic detection + entry | cross-session aggregation + dashboard button | Server-side payload load; threshold/ordering correctness |
| 3. Retry launch wiring | query-param auto-start in PracticeGenerator | Param parsing/validation; single auto-start; direct /practice unaffected |

**Prerequisites:** F-01 + S-03 done (they are); S-04 done. No new deps, no migration.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Weak topics need full payloads — computed server-side; keep them off the client.
- Targeted generation quality rests on the prompt focus line; verified manually.
- A retry skews per-topic data toward weak topics — intended (it's practice where it's needed).

## Success Criteria (Summary)

- A history with a sub-70% topic surfaces a "Retry weak topics" button; clicking generates a fresh set focused on it.
- The retry answers and saves as a normal session, feeding back into history/dashboard.
- All-strong exams (and thin data) show no retry; normal `/practice` is unaffected.
