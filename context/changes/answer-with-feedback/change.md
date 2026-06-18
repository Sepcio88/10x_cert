---
id: answer-with-feedback
roadmap_ref: S-02
status: implementing
created: 2026-06-18
updated: 2026-06-18
prd_refs: [US-01, FR-006, FR-007, FR-008]
prerequisites: [generate-first-practice-set]
---

# S-02: Answer the set with immediate explanation-first feedback

Turn the read-only generated question list from S-01 into an interactive answering
loop: answer one question at a time, get immediate explanation-first feedback
(correctness + correct answer + explanation), and finish with an overall session
score plus a reviewable recap.

Scope is client-side only — generated questions already carry `correctOptionId` and
`explanation`, so grading happens in the browser. No persistence (S-03), no per-topic
breakdown / dashboard (S-04).

See `plan-brief.md` for the two-pager and `plan.md` for the full plan.
