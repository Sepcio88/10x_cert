---
project: "CloudExamMatter"
version: 1
status: draft
created: 2026-06-17
updated: 2026-06-18
prd_version: 1
main_goal: market-feedback
top_blocker: time
---

# Roadmap: CloudExamMatter

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Cloud developers studying for a certification exam waste time hunting for scattered, uneven practice questions that rarely explain _why_ an answer is correct and keep no memory of past attempts. CloudExamMatter generates fresh, exam-representative questions on demand for a chosen exam, grades answers with an explanation-first rationale, and keeps a private, revisitable study record. The bet — the one trait that, if removed, makes this indistinguishable from a generic quiz app — is that questions are **generated fresh per session** (never a memorizable static bank) and that the explanation, not the answer letter, leads.

## North star

**S-01: Generate a practice set for a chosen exam** — shipping this first proves the core hypothesis (we can produce trustworthy, exam-relevant questions on demand), which everything else depends on.

> "North star" here means the smallest end-to-end slice whose successful delivery would prove the product's core hypothesis — placed as early as its prerequisites allow, because every later slice only matters if this one works. The "riskiest assumption" (used below) is the single belief most likely to be wrong and most expensive to discover late — here, that on-demand generation yields accurate, exam-relevant questions.

## At a glance

| ID   | Change ID                   | Outcome (user can …)                                                                                                          | Prerequisites | PRD refs                                           | Status   |
| ---- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------- | -------- |
| F-01 | question-generation-engine  | (foundation) a generation call returns exam-relevant questions with correct answer, explanation, and topic, within guardrails | —             | FR-005, NFR (gen <10s), Guardrail: answer accuracy | done     |
| S-01 | generate-first-practice-set | select a provider, find an exam by code/name, choose a count, and get a generated question set                                | F-01          | US-01, FR-001, FR-002, FR-003, FR-004, FR-005      | proposed |
| S-02 | answer-with-feedback        | answer the set one-by-one with immediate explanation-first feedback and an overall score                                      | S-01          | US-01, FR-006, FR-007, FR-008                      | proposed |
| S-03 | session-persistence-history | finish a session that is saved, and revisit past sessions                                                                     | S-02          | FR-008, FR-009                                     | proposed |
| S-04 | progress-dashboard          | see a per-topic breakdown and a progress trend across sessions                                                                | S-03          | FR-008, FR-010                                     | blocked  |
| S-05 | retry-weak-topics           | start a fresh set targeting topics previously answered wrong                                                                  | F-01, S-03    | FR-011                                             | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme              | Chain                                      | Note                                                                              |
| ------ | ------------------ | ------------------------------------------ | --------------------------------------------------------------------------------- |
| A      | Core practice loop | `F-01` → `S-01` → `S-02` → `S-03` → `S-04` | The spine. Riskiest-first per `market-goal`; `S-04` blocked on a metric decision. |
| B      | Weak-topic retry   | `S-05`                                     | Nice-to-have; runs parallel once `F-01` and `S-03` are done.                      |

## Baseline

What's already in place in the codebase as of 2026-06-17 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 islands + Tailwind 4 + shadcn/ui (`src/components`, `src/layouts`, `src/pages`).
- **Backend / API:** present — Astro SSR API routes (`src/pages/api/auth/*`); `output: "server"`.
- **Data:** partial — Supabase SSR client wired (`src/lib/supabase.ts`); no application tables/migrations yet (`supabase/migrations` empty).
- **Auth:** present — Supabase email/OAuth + route middleware + auth pages/endpoints (satisfies FR-001; per `tech-stack.md`).
- **Deploy / infra:** present — Cloudflare Workers (`wrangler.jsonc`) + GitHub Actions CI (per `tech-stack.md`).
- **Observability:** absent — no logging/error-tracking library detected (not forced by any launch-gating NFR; left simple per `top_blocker: time`).

## Foundations

### F-01: Question-generation engine

- **Outcome:** (foundation) a single generation call accepts an exam + count and returns exam-relevant questions, each with a designated correct answer, an explanation, and a topic/domain tag — meeting the accuracy and latency guardrails. Not user-visible on its own.
- **Change ID:** question-generation-engine
- **PRD refs:** FR-005, NFR (question set ready < 10s), Guardrail: generated answers/explanations are accurate (the product's trust anchor).
- **Unlocks:** S-01 (the north star wraps this in the user flow), S-05 (retry re-uses fresh generation), and it reduces the roadmap's top blocking unknown — generation feasibility (accuracy + latency).
- **Prerequisites:** — (auth, deploy, and the data client are present per Baseline)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Which LLM provider/approach guarantees the accuracy bar and the <10s latency target? — Owner: user/team. Block: no (resolvable during `/10x-plan` research; a spike confirms feasibility before S-01).
- **Risk:** Sequenced first because it is the riskiest assumption — if generation can't produce accurate, exam-relevant questions within the latency budget, the whole product premise fails. Kept minimal (a working generation contract, not a full subsystem) so S-01 can integrate and exercise it through real user behavior immediately.
- **Status:** done

## Slices

### S-01: Generate a practice set for a chosen exam

- **Outcome:** user can select a cloud provider, find an exam by its code or name, choose how many questions, and get a freshly generated question set for that exam.
- **Change ID:** generate-first-practice-set
- **PRD refs:** US-01, FR-001 (flow gated behind the existing auth), FR-002, FR-003, FR-004, FR-005
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Maximum question count per session (a cap to protect latency/cost)? — Owner: user. Block: no (a sensible default unblocks planning; see Open Roadmap Questions).
- **Risk:** The north star. Sequenced first among slices because seeing real generated questions for a chosen exam is the earliest point a human can judge whether the generation bet holds. Depends only on F-01; auth already exists.
- **Status:** proposed

### S-02: Answer the set with immediate explanation-first feedback

- **Outcome:** user can answer the generated questions one at a time, see immediately whether each was correct with an explanation-first rationale and the correct answer, and finish with an overall session score.
- **Change ID:** answer-with-feedback
- **PRD refs:** US-01, FR-006, FR-007, FR-008 (overall score)
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Proves the second half of the bet — explanation-first teaching, not answer-recall. Sequenced after S-01 because it consumes a generated set; low risk once generation is trustworthy.
- **Status:** proposed

### S-03: Persist completed sessions and revisit history

- **Outcome:** user can complete a session that is saved durably and later revisit past sessions to review their questions and answers.
- **Change ID:** session-persistence-history
- **PRD refs:** FR-008 (saved session), FR-009
- **Prerequisites:** S-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Introduces persistence at the first slice that genuinely needs it (progressive disclosure), rather than pre-building a data layer. Carries the "saved sessions are never lost" guardrail. Minimal session/result schema only.
- **Status:** proposed

### S-04: Per-topic breakdown and progress dashboard

- **Outcome:** user can see a per-topic/domain breakdown of a session and a progress trend (average score over time) across all sessions on the home page.
- **Change ID:** progress-dashboard
- **PRD refs:** FR-008 (per-topic breakdown), FR-010
- **Prerequisites:** S-03
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:**
  - How is the progress metric defined across different exams/providers? Averaging raw scores across different exams could mislead. — Owner: user. Block: yes (the aggregation rule must be decided before this slice can be planned coherently).
- **Risk:** Depends on multiple saved sessions existing (S-03). Blocked until the cross-exam aggregation rule is defined — sequencing it earlier would prejudge a metric the PRD left open.
- **Status:** blocked

### S-05: Retry fresh questions on weak topics

- **Outcome:** user can start a new session of freshly generated questions targeting the topics they previously answered incorrectly.
- **Change ID:** retry-weak-topics
- **PRD refs:** FR-011
- **Prerequisites:** F-01, S-03
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:**
  - How are "weak topics" identified from past results (threshold, recency window)? — Owner: user. Block: no.
- **Risk:** Nice-to-have (PRD priority). Re-uses F-01's generation for fresh questions (not identical replay) and needs per-topic result data from S-03. Deferrable under `top_blocker: time` without losing the core loop.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                   | Suggested issue title                                       | Ready for `/10x-plan` | Notes                                                               |
| ---------- | --------------------------- | ----------------------------------------------------------- | --------------------- | ------------------------------------------------------------------- |
| F-01       | question-generation-engine  | Build the exam question-generation engine (accuracy + <10s) | yes                   | Run `/10x-plan question-generation-engine` — unlocks the north star |
| S-01       | generate-first-practice-set | Generate a practice set for a chosen exam (north star)      | no                    | Needs F-01 done first                                               |
| S-02       | answer-with-feedback        | Answer a set with immediate explanation-first feedback      | no                    | Needs S-01                                                          |
| S-03       | session-persistence-history | Persist completed sessions and revisit history              | no                    | Needs S-02                                                          |
| S-04       | progress-dashboard          | Per-topic breakdown + progress dashboard                    | no                    | Blocked: define cross-exam progress metric first                    |
| S-05       | retry-weak-topics           | Retry fresh questions on weak topics                        | no                    | Nice-to-have; needs F-01 + S-03                                     |

This table is the clean handoff to Jira/Linear or any MCP-backed backlog. One row per `F-NN`/`S-NN`.

## Open Roadmap Questions

1. **What is the maximum question count per session?** — Owner: user. Block: S-01 (no — a sensible default unblocks planning; affects FR-004 and generation cost/latency).
2. **How is the progress metric defined across different exams/providers?** — Owner: user. Block: S-04 (yes — averaging raw scores across different exams could mislead; the dashboard needs a meaningful aggregation rule).

## Parked

- **A curated or static question bank** — Why parked: PRD §Non-Goals; generation is on-demand by design.
- **Team / social features (shared workspaces, leaderboards, study groups)** — Why parked: PRD §Non-Goals; v1 is a single-user private study record.
- **Official-exam guarantee / brain-dump content** — Why parked: PRD §Non-Goals; questions are exam-representative practice only.
- **Payments / subscriptions** — Why parked: PRD §Non-Goals; free for the initial handful of users.

## Done

- **F-01: (foundation) a single generation call accepts an exam + count and returns exam-relevant questions, each with a designated correct answer, an explanation, and a topic/domain tag — meeting the accuracy and latency guardrails. Not user-visible on its own.** — Archived 2026-06-18 → `context/archive/2026-06-18-question-generation-engine/`. Lesson: —.
