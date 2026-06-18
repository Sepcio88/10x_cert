# 10xDevs — Certification Project (Agent Router)

This is a **greenfield certification project** built with the 10xDevs AI toolkit.
This file is a **lean router**, not an encyclopedia. Per M4L1: a bloated root file
makes the agent ignore real instructions. Keep it short; reach into `context/` and
`knowledge/` just-in-time.

## How to work here — the canonical pipeline

Run these skills **in order**. Each writes a durable artifact the next one consumes.
Do not skip ahead; each step depends on the previous artifact existing.

| #   | Skill                      | Input                    | Output artifact                                  |
| --- | -------------------------- | ------------------------ | ------------------------------------------------ |
| 0   | `/10x-init`                | —                        | `context/{changes,archive,foundation}/` _(done)_ |
| 1   | `/10x-shape`               | your idea (conversation) | `context/foundation/shape-notes.md`              |
| 2   | `/10x-prd`                 | shape-notes.md           | `context/foundation/prd.md`                      |
| 3   | `/10x-tech-stack-selector` | prd.md                   | `context/foundation/tech-stack.md`               |
| 4   | `/10x-bootstrapper`        | tech-stack.md            | scaffolded app                                   |
| 5   | `/10x-agents-md`           | scaffolded app           | `AGENTS.md` (project rules)                      |
| 6   | `/10x-roadmap`             | prd.md                   | `context/foundation/roadmap.md`                  |

Then, **per roadmap slice**, loop:

```
/10x-new <id>  →  /10x-research <id>  →  /10x-plan <id>  →  /10x-plan-review <id>
            →  /10x-implement <id> phase N   (or /10x-tdd for test-first phases)
            →  /10x-impl-review <id>  →  /10x-archive <id>
```

Helpers, used on signal (not every slice):

- `/10x-frame` — challenge WHAT to build before planning HOW (bug-vs-fix, scope).
- `/10x-test-plan` — phased test rollout for the product (brownfield/after MVP).
- `/10x-infra-research` — pick a deploy platform (after PRD/stack).
- `/10x-lesson` — capture a recurring rule into `context/foundation/lessons.md`.
- `/10x-rule-review`, `/10x-health-check`, `/10x-stack-assess` — maintenance/audit.

## Where things live (rung 1 of the maturity ladder)

- `CLAUDE.md` (this file) — agent router. Claude Code reads this; not engineering rules.
- `AGENTS.md` — global project conventions. **Written at step 5**, after the stack exists.
- `context/foundation/` — cross-change living docs (prd, roadmap, tech-stack, lessons…). Edit in place.
- `context/changes/<id>/` — active work (change.md, research, plan).
- `context/archive/YYYY-MM-DD-<id>/` — completed work, read-only.
- `.claude/skills/` — the `10x-*` toolkit (23 skills). `.claude/rules/e2e.md` — E2E conventions.
- `knowledge/m1..m5/`, `knowledge/prework/` — full 10xDevs lesson texts (PL), **reference only**.
  Pull the relevant lesson when a step needs its theory; do not load wholesale.

## Operating rules

- **Stay on rung 1** (root `AGENTS.md` + central `context/`). Do not create per-module
  `AGENTS.md` or per-module `context/` until escalation signals appear (root > ~250 lines,
  agent repeatedly loses module context, a module gets its own owner/deploy).
- **References go to `context/`**, loaded just-in-time — not pasted into this file.
- **Keep this router lean.** New conventions → `AGENTS.md`/`rules/`. New procedures → skills.

## Current state

`/10x-init` is done. **Next step: `/10x-shape`** — start the discovery conversation about
what to build for the certification, which writes `context/foundation/shape-notes.md`.
