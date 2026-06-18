---
change_id: generate-first-practice-set
roadmap_id: S-01
title: Generate a practice set for a chosen exam (north star)
status: archived
created: 2026-06-18
updated: 2026-06-18
archived_at: 2026-06-18T13:37:46Z
---

# Generate a practice set for a chosen exam (S-01, north star)

The first user-facing slice (roadmap S-01). A signed-in developer selects a cloud
provider, types an exam code/name, chooses a question count, and gets a freshly
generated question set displayed (stem + options + topic — no answers; answering
is S-02). Built on the F-01 question-generation engine via a new auth-gated API
route and a React island. Proves the core hypothesis end-to-end through the UI.

- Plan: `plan.md`
- Brief: `plan-brief.md`
- Depends on: F-01 (question-generation-engine, archived)

## Note: question-count cap lowered 20 → 5

During manual verification, generating 10 questions exceeded F-01's 9s timeout
(measured ~9009ms with `openai/gpt-4o-mini` in a single call), tripping the `<10s`
guardrail. Per decision, `MAX_QUESTION_COUNT` was lowered from 20 to 5 so the budget
always holds. This **revises a resolved PRD open question** (which set max = 20):
`context/foundation/prd.md` should be updated to reflect max 5 for the MVP. Raising
it again requires a faster model or streaming (tracked as an F-01 follow-up).
