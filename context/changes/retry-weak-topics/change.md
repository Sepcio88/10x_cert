---
change_id: retry-weak-topics
title: Retry fresh questions on weak topics (S-05)
created: 2026-06-21
status: impl_reviewed
updated: 2026-06-22
archived_at: null
---

## Notes

Roadmap slice S-05 (last slice). PRD ref: FR-011 (nice-to-have). Prerequisites F-01 (generation) and S-03 (persistence) are both done; parallel with S-04 (done).

**What:** user starts a new session of **freshly generated** questions (NOT a replay) targeting topics they previously got wrong. Re-uses the on-demand generation insight — fresh material, not memorizable repeats.

**Reusable assets already in place:**

- F-01 generation engine: `generateQuestions({ exam, count })` (`src/lib/services/question-generator.ts`).
- S-03 persistence: each saved session stores full payload (`questions[]` with `topic`, `answers[]` with `correct`) + provider/exam/score columns; `listSessions`/`getSession` in `src/lib/db/sessions.ts`.
- S-04 `topicBreakdown(session)` in `src/lib/practice/session.ts`: per-topic correct/total — the basis for identifying weak topics.

**Open design questions for `/10x-plan` (roadmap flagged the first as non-blocking):**

1. **How are "weak topics" defined?** threshold (any wrong vs below X%), scope (one exam vs across exams), recency window (last session / last N / all-time). Owner: user.
2. **How does generation target specific topics?** F-01's contract is `{ exam, count }` only — decide whether to extend the generation contract to accept target topics, or steer via the exam-identifier prompt. This is the key scope/architecture call.
