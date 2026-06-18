---
project: "CloudExamMatter"
version: 1
status: draft
created: 2026-06-17
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 2
  hard_deadline: 2026-07-17 # approximate — user gave "within ~1 month" window, not a fixed date
  after_hours_only: true
---

## Vision & Problem Statement

Cloud developers preparing for a certification exam (AWS, Azure, GCP) waste time
hunting for representative practice questions, which are scattered across many
sites of uneven quality. When they do find questions, the tools rarely explain
_why_ the correct answer is correct, and rarely keep a memory of past attempts,
so it is hard to know which topics still need work.

The insight: instead of curating a static question bank that learners eventually
memorize, questions are **generated on demand** for a chosen exam and question
count — so practice material is always fresh and exam-relevant — paired with an
explanation of why each correct answer is correct and a persistent record of
past study sessions to revisit.

## User & Persona

Primary persona: a cloud developer studying for a specific cloud certification
exam. They want to drill realistic questions for a named exam, understand the
reasoning behind correct answers, and track progress across study sessions over
time. Multi-user product — each developer has their own account and session
history.

## Success Criteria

### Primary

- A signed-in developer can select a cloud provider, find an exam by code or name,
  choose a question count, answer the generated questions with immediate
  explanation-first feedback per question, and end with a saved, revisitable
  session that shows the correct answers and explanations plus an overall score
  and a per-topic breakdown.

### Secondary

- A developer can re-test the questions they previously got wrong, to close gaps.

### Guardrails

- Generated questions never present a wrong answer as "correct" — answer/explanation
  accuracy is the product's trust anchor; a misleading explanation actively harms prep.
- Once a session is saved, it remains retrievable — saved sessions are never lost.
- A user's sessions and scores are visible only to their own account.
- Generating a question set always gives the user visible feedback — never a blank,
  unresponsive screen.

## User Stories

### US-01: Developer drills an exam and reviews the results

- **Given** a signed-in developer
- **When** they select a cloud provider, find an exam by code or name, choose a question count, and answer the generated questions one at a time
- **Then** after each question they immediately see whether they were correct, with an explanation-first rationale and the correct answer, and on completion the session is saved with an overall score and a per-topic breakdown

#### Acceptance Criteria

- The number of questions generated matches the count the user chose
- After each answered question, the user sees correctness, an explanation (reasoning first), and the correct answer
- The completed session is persisted and appears in the user's history for later revisit
- An overall score plus a per-domain/topic breakdown is computed and shown for the completed session

## Functional Requirements

### Account & access

- FR-001: User can create an account and sign in via email + password or OAuth. Priority: must-have
  > Socrates: Counter considered — "OAuth is overkill / auth delays value for v1." Resolution: kept as written; multi-user with per-user private history is a core premise, email+OAuth login stays.

### Exam selection

- FR-002: User can select a cloud provider (AWS / Azure / GCP). Priority: must-have
  > Socrates: Counter considered — "redundant with exam search / do one provider for v1." Resolution: kept; provider is a useful top-level filter and all three are in scope.
- FR-003: User can find an exam by its code or name. Priority: must-have
  > Socrates: Counter considered — "a fixed dropdown is simpler than free search." Resolution: kept; search by code or name is how developers locate their exam.
- FR-004: User can choose how many questions the session will contain. Priority: must-have
  > Socrates: Counter considered — "a fixed count is simpler; large counts strain generation." Resolution: kept; user-chosen count is core. Open item: a sensible max cap on count (see Open Questions).

### Practice session

- FR-005: User can generate a question set for the chosen exam and count. Priority: must-have
  > Socrates: Counter considered — "a curated static bank is safer; generation latency/cost may hurt UX." Resolution: kept; on-demand generation IS the product. Accuracy handled via the answer-correctness guardrail; responsiveness handled via the generation-feedback guardrail.
- FR-006: User can answer questions one at a time and receive immediate feedback (correctness + explanation) after each, then complete the session (which is saved). Priority: must-have
  > Socrates: Counter considered — "immediate per-question feedback teaches better than batch submit." Resolution: REVISED — changed from batch-submit to immediate per-question feedback (study mode). Real-exam batch mode noted as a possible future option.

### Results & review

- FR-007: User can see, per question, their answer's correctness, the correct answer, and an explanation — presented explanation-first (the reasoning leads, the correct answer follows). Priority: must-have
  > Socrates: Counter considered — "revealing the answer enables memorization." Resolution: REVISED — presentation is explanation-first so users learn the 'why' rather than memorizing the letter.
- FR-008: User can see an overall session score plus a breakdown by exam domain/topic. Priority: must-have
  > Socrates: Counter considered — "a single score is too coarse." Resolution: REVISED — added a per-topic/domain breakdown alongside the overall score so users can target weak areas.

### History & progress

- FR-009: User can revisit previously saved sessions to review past questions and answers. Priority: must-have
  > Socrates: Counter considered — "users rarely revisit; redundant with the dashboard." Resolution: kept; the revisitable study record is core to the product's value.
- FR-010: User can see a personal progress view (average score and trend across sessions) on the home page. Priority: must-have
  > Socrates: Counter considered — "scope creep for 2 weeks; cross-exam averages mislead; trend needs many sessions." Resolution: kept as must-have. Open item: define the progress metric so cross-exam averaging is not misleading (see Open Questions).
- FR-011: User can start a new session of freshly generated questions targeting the topics they previously got wrong. Priority: nice-to-have
  > Socrates: Counter considered — "replaying identical questions trains memorization." Resolution: REVISED — retry generates FRESH questions on weak topics (not identical replay), reinforcing the on-demand-generation insight.

## Non-Functional Requirements

- A question set is ready within 10 seconds of the user requesting it, with
  continuous visible progress shown while it is being produced (never a frozen,
  blank screen).
- After a user answers a question, feedback (correctness + explanation) appears
  within 1 second.

## Business Logic

Given a chosen certification exam and a question count, CloudExamMatter produces
fresh, exam-representative questions, grades the user's answers, and explains why
each correct answer is correct.

The rule consumes three user-facing inputs: the cloud provider, the specific exam
(identified by its code or name), and how many questions the session should
contain. From these it produces a set of questions sized to the requested count
and representative of that exam's subject matter, each with a designated correct
answer and an explanation of the reasoning behind it.

As the user answers, the rule judges each response against the correct answer and
surfaces the explanation, then aggregates the results into an overall score and a
per-topic/domain breakdown for the completed session. Because questions are
produced fresh per session rather than drawn from a fixed bank, repeated practice
on the same exam yields new material rather than memorizable repeats.

## Access Control

Multi-user with accounts. Users sign in via email + password or OAuth. Flat role
model: every authenticated user is a learner with the same capabilities, and each
user's study sessions and history are private to their own account. Unauthenticated
visitors cannot generate questions or view any session history — those routes are
gated behind sign-in. No admin or content-author roles in the MVP.

## Non-Goals

- **No curated or static question bank.** Questions are generated on demand; we will
  not hand-author or maintain a fixed bank. This commits the product to its
  generation-first approach.
- **No team or social features.** No shared workspaces, leaderboards, or study
  groups — v1 is a single-user, private study record.
- **No official-exam guarantee.** Questions are exam-_representative_ practice, not
  real or officially sanctioned exam content; the product makes no brain-dump claim.
- **No payments or subscriptions.** No billing, paywalls, or monetization in v1 —
  free for the initial handful of users.

## Open Questions

1. **What is the maximum question count per session?** — RESOLVED (2026-06-18): **max 5 for the MVP**. During S-01 verification, 10 questions exceeded the <10s budget (~9s timeout) with a single `gpt-4o-mini` call, so the cap was lowered from 20 to 5 (enforced by `MAX_QUESTION_COUNT`). Raising it again requires a faster model or streaming (F-01 follow-up). (relates to FR-004 / FR-005)
2. **How is the progress metric defined across different exams/providers?** — Owner: user. Averaging raw scores across different exams could mislead; the dashboard (FR-010) needs a meaningful aggregation rule.
