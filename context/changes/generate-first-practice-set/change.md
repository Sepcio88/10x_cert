---
change_id: generate-first-practice-set
roadmap_id: S-01
title: Generate a practice set for a chosen exam (north star)
status: implementing
created: 2026-06-18
updated: 2026-06-18
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
