---
title: "CloudExamMatter — Domain Distillation"
created: 2026-07-03
type: domain-distillation
---

# CloudExamMatter — Domain Distillation

Scope: `context/foundation/prd.md`, `context/foundation/tech-stack.md`, `README.md`,
`context/changes/*/change.md`, `context/archive/*/change.md`, and the `src/`, `supabase/`
implementation as of 2026-07-03. Research-only — no production code was modified.

## Step 0 — Project context

CloudExamMatter is an Astro 6 (SSR, `output: "server"`) + React 19 islands app on
Cloudflare Workers, with Supabase (Postgres + Auth + RLS) for persistence and OpenRouter
(`openai/gpt-4o-mini`) for on-demand question generation (`context/foundation/tech-stack.md:26-33`,
`README.md:19-29`). Layer map, confirmed by reading each file:

| Layer | Location | Role |
|---|---|---|
| API routes | `src/pages/api/**` | Auth-gated HTTP boundary; zod-validated request/response, never trusts client-sent correctness |
| Domain logic (pure) | `src/lib/practice/session.ts`, `src/lib/practice/progress.ts` | Session lifecycle, grading, topic breakdown, per-exam trend aggregation — no I/O |
| Generation service | `src/lib/services/question-generator.ts`, `openrouter.ts`, `question-schema.ts` | LLM call, retry, Zod validation of model output |
| Persistence | `src/lib/db/sessions.ts`, `supabase/migrations/*.sql` | `practice_sessions` table access, RLS |
| UI | `src/components/**`, `src/pages/*.astro` | Astro pages + React islands (practice flow, dashboard, history, auth) |
| Shared contract | `src/types.ts` | Central DTO/entity kernel (Ca=15 per `context/map/repo-map.md:71`) |

Also read for narrative history: all six archived `change.md` files (F-01, S-01..S-05) and
the open `practice-flow-analysis/change.md`, plus the existing `context/map/repo-map.md`
(a prior structural analysis) — used only as corroborating context, not as a primary source
for quotes.

## Step 1 — Ubiquitous Language

Each entry: **Term** — definition — PRD/doc source quote (file:line) — code location or
`MISSING in code`.

| Term | Definition | Source quote | Code |
|---|---|---|---|
| **Practice session / Session** | One run of answering a generated question set, from generation to completion. | "answer the generated questions with immediate explanation-first feedback per question, and end with a saved, revisitable session" — `prd.md:46-48` | `PracticeSession` interface, `src/types.ts:51-57`; lifecycle functions `src/lib/practice/session.ts:17-86` |
| **Question** | A single multiple-choice item: stem, 4 options, one correct option, an explanation, a topic tag. | "each with a designated correct answer and an explanation of the reasoning behind it" — `prd.md:134-135` | `questionSchema`, `src/lib/services/question-schema.ts:17-29`; type alias `src/types.ts:7` |
| **Question set** | The group of questions generated for one session, sized to the user's chosen count. | "generate a question set for the chosen exam and count" — `prd.md:96` (FR-005) | No `QuestionSet` type exists; represented ad hoc as `Question[]` (`GenerationResult.questions`, `src/types.ts:28`; `PracticeSession.questions`, `src/types.ts:52`) |
| **Cloud provider** | Top-level filter: AWS, Azure, or GCP. | "User can select a cloud provider (AWS / Azure / GCP)" — `prd.md:87` (FR-002) | `z.enum(["AWS","Azure","GCP"])`, `src/pages/api/practice/generate.ts:9`; also `src/pages/api/practice/sessions.ts:11` |
| **Exam** | The specific certification exam a session targets, identified by code or name. | "User can find an exam by its code or name" — `prd.md:89` (FR-003) | **No `Exam` entity/type exists.** Represented everywhere as a bare `exam: string` — `GenerateQuestionsInput.exam`, `src/types.ts:11-12`; `SavedSessionSummary.exam`, `src/types.ts:109`. No catalog, id, or normalization (verified: no matches for `catalog`/`examList`/`EXAM_` in `src/`). |
| **Question count** | User-chosen number of questions per session, bounded 1–5. | "User can choose how many questions the session will contain" — `prd.md:91` (FR-004); cap resolved to "max 5 for the MVP" — `prd.md:165` | `MIN_QUESTION_COUNT`/`MAX_QUESTION_COUNT`, `src/lib/services/question-schema.ts:9-10` |
| **Answer / AnswerRecord** | The option a user picked for a question, plus whether it was correct. | "judges each response against the correct answer" — `prd.md:137-138` | `AnswerRecord`, `src/types.ts:34-41` |
| **Grading** | Determining an answer's correctness by comparing the pick to the question's correct option. | "the rule judges each response against the correct answer" — `prd.md:137` | `submitAnswer`, `src/lib/practice/session.ts:64-75` (client-side, live); `gradeSubmission`, `src/lib/practice/session.ts:98-123` (server-authoritative regrade on save) |
| **Explanation-first feedback** | Feedback where the reasoning is presented before/instead of leading with the answer letter. | "presented explanation-first (the reasoning leads, the correct answer follows)" — `prd.md:103-104` (FR-007) | Enforced only as an LLM prompt instruction: "Write the explanation reasoning-first... do not merely name the letter" — `src/lib/services/question-generator.ts:16`. No code validates the explanation text actually leads with reasoning. |
| **Score (session)** | Correct count, total, and rounded percentage for a completed session. | "an overall score and a per-topic breakdown" — `prd.md:48` | `SessionScore`, `src/types.ts:60-64`; `score()`, `src/lib/practice/session.ts:52-57` |
| **Topic / domain breakdown** | Per-topic correct/total/percentage tally within a session. | "a breakdown by exam domain/topic" — `prd.md:105` (FR-008) | `TopicScore`, `src/types.ts:67-72`; `topicBreakdown()`, `src/lib/practice/session.ts:130-150`. Schema only ever stores a single `topic` field (`question-schema.ts:24`) — "domain" is prose only, never a distinct field. |
| **Saved session** | A completed, persisted session record, retrievable later. | "Once a session is saved, it remains retrievable — saved sessions are never lost." — `prd.md:58` | `SavedSession`/`SavedSessionSummary`, `src/types.ts:106-120`; table `practice_sessions`, `supabase/migrations/20260619111103_create_practice_sessions.sql:5-15` |
| **Progress trend** | A per-exam score-over-time series built from a user's saved sessions. | "a personal progress view (average score and trend across sessions)" — `prd.md:112` (FR-010) | `ExamProgress`/`TrendPoint`, `src/types.ts:75-89`; `groupByExam()`, `src/lib/practice/progress.ts:14-37` |
| **Weak topic** | A topic whose all-time accuracy for an exam falls below a threshold, used to target retries. | "targeting the topics they previously got wrong" — `prd.md:114` (FR-011) | `WEAK_TOPIC_THRESHOLD = 70`, `src/lib/practice/progress.ts:5`; `weakTopics()`/`weakTopicsByExam()`, `src/lib/practice/progress.ts:55-97` |
| **Generation confidence** | The model's self-reported certainty ("high"/"low") that it recognized the exam. | **MISSING in `prd.md`** — not named anywhere in the PRD text | `GenerationConfidence`/`confidenceSchema`, `src/types.ts:8`, `src/lib/services/question-schema.ts:31`; surfaced as a UI warning, `src/components/practice/PracticeGenerator.tsx:190-195` |
| **Answer-accuracy guardrail** | "Generated questions never present a wrong answer as correct" — the product's stated trust anchor. | `prd.md:56-57` | Only structurally enforced: `correctOptionId` must match one of the option ids — `question-schema.ts:26-28` (`.refine(...)`). No semantic/factual verification exists anywhere in `src/`. |
| **Account / User** | An authenticated developer; every session and score is private to their own account. | "each user's study sessions and history are private to their own account" — `prd.md:147-148` | `context.locals.user` (Supabase `User`), set in `src/middleware.ts:11-16`; RLS policies, `supabase/migrations/...sql:24-31` |

## Step 2 — Subdomain classification

| Area | Classification | Justification |
|---|---|---|
| **On-demand question generation** (`question-generator.ts`, `openrouter.ts`, `question-schema.ts`) | **Core** | This is the PRD's explicit differentiator: "instead of curating a static question bank... questions are generated on demand" (`prd.md:26-27`); Non-Goals reaffirm "No curated or static question bank... This commits the product to its generation-first approach" (`prd.md:153-155`); roadmap calls it "the riskiest assumption" and "the north star" (`roadmap.md:24-26`). |
| **Explanation-first grading** (`session.ts` grading functions, `QuestionCard.tsx`) | **Core** | PRD frames it as the other half of the same bet: "rarely explain _why_ the correct answer is correct" is the stated problem (`prd.md:22-23`); FR-007 was explicitly *revised* to make explanation-first the default (`prd.md:103-104`). Roadmap: "the one trait that, if removed, makes this indistinguishable from a generic quiz app" (`roadmap.md:20`). |
| **Progress tracking & weak-topic retry** (`progress.ts`, `ProgressDashboard.tsx`) | **Core-adjacent / Supporting** | Must-have (FR-010) and reinforces the generation bet (retry uses *fresh* generation, not replay — `prd.md:114-115`), but the roadmap's own north-star framing places generation+grading, not progress, as the make-or-break slice (`roadmap.md:24`, S-04 sequenced fourth). Classified Supporting: valuable and differentiator-reinforcing, but the product's reason-for-being survives without it; it does not survive without generation+grading. |
| **Session persistence & history** (`db/sessions.ts`, `history.astro`) | **Supporting** | Necessary to keep the "revisitable" promise (FR-009, Guardrail `prd.md:58`), but persisting a quiz result is generic to any quiz product — the value is in *what* gets persisted (fresh, explained questions), not the persistence mechanism itself. |
| **Exam/provider selection & catalog** (FR-002/003/004) | **Supporting** | Necessary input-capture UX, but generic form/search plumbing — and, notably, the codebase treats it as low-investment: no `Exam` entity or catalog exists at all (see Step 4). |
| **Account & access (auth)** | **Generic** | Fully delegated to Supabase Auth; PRD itself treats it as a premise, not a differentiator ("multi-user with per-user private history is a core premise" but the *mechanism* is off-the-shelf — `prd.md:83`). Non-Goals confirm no custom roles: "No admin or content-author roles in the MVP" (`prd.md:149`). |
| **Deployment / CI / hosting** | **Generic** | Cloudflare Workers + GitHub Actions (`tech-stack.md:35-36`) — commodity infrastructure, not domain logic. |

## Step 3 — Aggregate candidates and invariants

### A. `PracticeSession` (in-flight, client-held)

- **Invariant:** "`answers` is index-aligned with `questions` and filled strictly forward... A question is graded exactly once... Advancing requires the current question to be answered." — `src/lib/practice/session.ts:8-13` (doc comment)
- **Status: enforced in code.** `submitAnswer` refuses to re-grade an answered question (`session.ts:64-68`); `advance` refuses to move forward until answered (`session.ts:81-84`).
- **Evidence of enforcement:** unit-tested — `cannot re-grade an already-answered question` and `cannot advance before answering the current question`, `src/lib/practice/session.test.ts:75, 83`.

### B. Saved session (`practice_sessions` row / `SavedSession`)

- **Invariant 1 — server-authoritative score:** the persisted score must never trust a client-supplied correctness flag. Implied by README's architecture note: "The server recomputes the score on save (never trusting the client)" — `README.md:96`.
  - **Status: enforced.** `RawAnswer` (what the client sends) carries no `correct` field (`src/types.ts:94-97`); `gradeSubmission` recomputes it server-side from `question.correctOptionId` (`session.ts:98-123`), called from `POST /api/practice/sessions` (`src/pages/api/practice/sessions.ts:62`).
  - **Evidence:** tested — `saves with a server-recomputed score and returns the new id`, `src/pages/api/practice/sessions.test.ts:97`.
- **Invariant 2 — only completed sessions persist:** "Only completed sessions can be saved" — `src/pages/api/practice/sessions.ts:57`.
  - **Status: enforced** — `answers.length !== questions.length` → 400 (`sessions.ts:55-60`); tested at `sessions.test.ts:87`.
- **Invariant 3 — never lost:** "Once a session is saved, it remains retrievable — saved sessions are never lost." — `prd.md:58` (a named Guardrail, one of only four in the whole PRD).
  - **Status: VIOLATED / violable by design.** A full delete path exists and is exercised: RLS policy `own_sessions_delete` (`supabase/migrations/20260619111103_create_practice_sessions.sql:30-31`), `deleteSession()` (`src/lib/db/sessions.ts:133-140`), `DELETE /api/practice/sessions/[id]` (`src/pages/api/practice/sessions/[id].ts:18-38`), and a UI trash-can button with a confirm dialog (`src/components/practice/HistoryList.tsx:29-46, 89-97`). The delete path is itself unit-tested as *working* — `deletes the caller's session scoped to their user id`, `src/pages/api/practice/sessions/[id].test.ts:45` — meaning the test suite locks in behavior that contradicts the PRD guardrail; nothing will ever go red for this.
- **Invariant 4 — private to owner:** "A user's sessions and scores are visible only to their own account." — `prd.md:59`.
  - **Status: enforced (defense-in-depth).** RLS (`select`/`insert`/`delete` policies scoped to `auth.uid() = user_id`, migration:24-31) *and* explicit `user_id` filters in every query in `src/lib/db/sessions.ts:84-140`.

### C. Generated `Question` / question set

- **Invariant 1 — structural well-formedness:** exactly 4 options, `correctOptionId` matches one of them. — `question-schema.ts:21, 26-28`.
  - **Status: enforced** via Zod `.refine()`; every generation response is validated before being returned (`question-generator.ts:100-108`).
- **Invariant 2 — requested count is honored:** "The number of questions generated matches the count the user chose" — `prd.md:73` (US-01 acceptance criterion).
  - **Status: enforced with retry** — `question-generator.ts:105-108` checks `result.data.questions.length !== count`, retries once (`MAX_ATTEMPTS = 2`, line 9), else returns `invalid-output`.
- **Invariant 3 — semantic answer accuracy (the guardrail):** "Generated questions never present a wrong answer as 'correct'... a misleading explanation actively harms prep." — `prd.md:56-57`.
  - **Status: NOT enforced — structurally unenforceable by the current design.** Nothing in the codebase verifies that the LLM's designated `correctOptionId` or `explanation` is factually correct. The only compensating control is the model's own self-reported `confidence` flag (`question-schema.ts:31`), surfaced as a soft warning banner ("These questions may be less accurate...", `PracticeGenerator.tsx:190-195`) — an honesty signal from the same model being trusted, not an independent check.

### D. `ExamProgress` (aggregate over a user's sessions, grouped by exam)

- **Invariant:** "exams are NEVER blended" — `src/lib/practice/progress.ts:9-10` comment, resolving PRD Open Question #2: "the trend averages only same-exam sessions (never blends different exams/providers)" — `prd.md:166`.
  - **Status: enforced for the grouping logic itself** — `groupByExam()` partitions strictly by the `exam` string key (`progress.ts:14-25`); tested at `progress.test.ts:46` ("groups by exam without blending").
  - **Latent risk:** the grouping key is the raw free-text `exam` string, not a normalized `Exam` identity (see Step 4, drift #3). Two sessions for the same real-world exam typed differently (`"SAA-C03"` vs `"AWS SAA-C03"` vs `"Solutions Architect Associate"`) will silently produce two separate, un-blended trend lines — the invariant "holds" by construction but the concept it's supposed to protect (one trend per exam) can still be defeated by input variance, because there is no canonical `Exam` to key on.

## Step 4 — Model vs Code drift table

| # | Document says | Code does | Evidence |
|---|---|---|---|
| 1 | Progress view (FR-010) appears "on the home page" — PRD: "a personal progress view... on the home page" (`prd.md:112`); roadmap S-04: "a progress trend... across all sessions on the home page" (`roadmap.md:117`); archived change note repeats it: "Home page (FR-010) defaults to the most-recently-practiced exam's trend" (`context/archive/2026-06-19-progress-dashboard/change.md:17`). | The actual home page (`/`, `src/pages/index.astro:1-9`) renders `Welcome.astro` — a signed-out marketing/landing hero with Sign In/Sign Up CTAs. The progress trend lives at a *different* route, `/dashboard` (`src/pages/dashboard.astro:1-42`), reachable only after sign-in via nav. | `src/pages/index.astro:1-9`, `src/components/Welcome.astro:1-127`, `src/pages/dashboard.astro:1-42` |
| 2 | FR-001: sign-in "via email + password or OAuth" (`prd.md:82`); README repeats: "Sign in with email/password (or OAuth)" (`README.md:13`). | Only email+password is implemented. No `signInWithOAuth` call or OAuth UI exists anywhere in `src/` (verified by grep for `oauth`/`OAuth`/`signInWithOAuth` across `src/` — zero matches outside an unrelated docs URL). | `src/pages/api/auth/signin.ts:1-20`, `src/pages/api/auth/signup.ts:1-21`, `src/components/auth/SignInForm.tsx:1-88` (no OAuth button) |
| 3 | FR-003: "User can find an exam by its code or name" (`prd.md:89`), with the Socratic resolution explicitly framing it as "search by code or name is how developers locate their exam" (`prd.md:90`) — implying a lookup against known exams. | There is no exam catalog anywhere in the codebase (grep for `catalog`/`examList`/`EXAM_` in `src/` returns no matches). "Finding an exam" is a free-text `<input>` whose value is concatenated directly into the LLM prompt with no validation that the exam exists. | `src/components/practice/PracticeGenerator.tsx:319-333` (free-text field), `src/pages/api/practice/generate.ts:55` (`exam: \`${provider} ${exam}\``, unvalidated string) |
| 4 | Guardrail: "Once a session is saved, it remains retrievable — saved sessions are never lost." (`prd.md:58`). | A complete, tested delete path exists: RLS delete policy, a `DELETE` API route, and a UI trash-can button with a confirm dialog. | `supabase/migrations/20260619111103_create_practice_sessions.sql:30-31`, `src/pages/api/practice/sessions/[id].ts:18-38`, `src/components/practice/HistoryList.tsx:29-46,89-97` |
| 5 | The migration's own comment calls the table's rows "immutable (no UPDATE policy)" (`supabase/migrations/...sql:3`). | True for UPDATE, but the same rows are deletable — "immutable" is only half-true, and the half that's false is the half the PRD guardrail (#4 above) actually cares about. | Same migration file, lines 3 vs 30-31 |
| 6 | Guardrail: "Generated questions never present a wrong answer as 'correct' — answer/explanation accuracy is the product's trust anchor" (`prd.md:56-57`). | Code enforces only that `correctOptionId` matches one of the four option ids (structural, not factual correctness). The only accuracy signal is the model's own self-reported `confidence` flag, surfaced as an optional soft warning — not a block, not a re-generation trigger. | `src/lib/services/question-schema.ts:26-28`, `src/components/practice/PracticeGenerator.tsx:190-195` |
| 7 | FR-008: "a breakdown by exam domain/topic" (`prd.md:105`) — PRD's own wording pairs "domain" and "topic" as if potentially distinct. | Schema and code carry a single `topic` field only; "domain" never appears as a schema field, only in prose/comments (e.g. `session.ts:126` "Per-topic/domain breakdown"). Minor vocabulary compression, not a functional gap. | `src/lib/services/question-schema.ts:24`, `src/types.ts:67-72` |
| 8 | PRD's Business Logic section describes generation as consuming exactly "three user-facing inputs: the cloud provider, the specific exam..., and how many questions" (`prd.md:131-133`), written before S-05 existed. | `GenerateQuestionsInput` now carries a fourth field, `topics?: string[]` (added for the S-05 weak-topic retry, FR-011), which the PRD's Business Logic prose was never updated to mention. | `src/types.ts:10-17`, comment "Optional topics/domains to focus the questions on (S-05 weak-topic retry)" |
| 9 | `prd.md` never names or discusses a "confidence" concept anywhere in its text. | The code has a first-class `GenerationConfidence` ("high"/"low") threaded from the LLM prompt through the schema to a dedicated UI warning state — a real domain concept the PRD's vocabulary never caught up to. | `src/types.ts:8`, `src/lib/services/question-schema.ts:31`, `src/components/practice/PracticeGenerator.tsx:57,190-195` |

## Step 5 — Refactor ranking

Ranked by **value** (how core the invariant is to the product) × **risk** (how weakly/wrongly it's enforced today):

| Rank | Aggregate | Value | Risk | Why |
|---|---|---|---|---|
| **1** | **Saved session (`practice_sessions` / `SavedSession`)** | High — protects one of only four named PRD Guardrails (`prd.md:58`), and is the entire basis of the "revisitable study record" promise (FR-009, US-01). | Highest — not merely under-enforced but **actively inverted**: a complete, tested delete path exists and green tests certify the contradiction as correct behavior. Nobody will get a CI signal that this guardrail is broken. | This is the textbook case DDD aggregate design exists to prevent: the "can this record be destroyed?" decision was made independently and differently in three layers (SQL migration comment says immutable, RLS explicitly allows delete, UI ships a delete button) instead of once, at the aggregate boundary. It is also the cheapest of the top risks to actually fix — it's a scoped policy decision (remove delete, or replace it with an owner-only soft-archive that keeps the row queryable/undoable, or formally revise the PRD guardrail to permit deletion), not a research problem. |
| 2 | Generated `Question` / question set (answer-accuracy guardrail) | Highest — explicitly named "the product's trust anchor" (`prd.md:57`) and the PRD's own stated reason the product exists at all (`prd.md:26-30`). | High, but of a different character — the invariant isn't contradicted, it's honestly *un-checked*; the team already added a partial mitigation (the `confidence` self-report). Fixing it further is a genuine research/engineering investment (e.g., a golden-question eval set, a second-pass verifier model), not a quick aggregate-boundary fix. | Ranked #2, not #1, because a modeling refactor alone can't close this gap the way it can for #1 — semantic truth isn't something a schema or an aggregate boundary can enforce. It deserves the loudest long-term warning in this report even though it isn't "refactor #1." |
| 3 | `Exam` (missing entity) | Medium-high — it's the identity every other aggregate keys on (generation target, `ExamProgress` grouping key, weak-topic targeting), and FR-003's own Socratic resolution implies a "search," not a free-text box. | Medium — no incident yet, and the PRD's acceptance criteria don't strictly mandate a catalog. But it is the *root cause* of drift #3 and the latent fragility noted under `ExamProgress` (Step 3-D): typos/case/format variants of the same real exam silently fragment a user's trend. | Worth promoting to a real value object (canonical id/code/provider/name) before the "never blended" invariant (Step 3-D) is trusted at any scale beyond a handful of users typing consistently. |
| 4 | `PracticeSession` (in-flight) | High (it's half the core loop) | Low — invariants are explicit, guarded in code, and unit-tested. | Included as the baseline "this is what good looks like" — no action needed; useful contrast for why #1 stands out. |

**#1 recommendation: the saved-session aggregate's mutability contract.** Of everything surfaced in this distillation, it is the one place where the PRD states an explicit guardrail, the codebase ships tested code that does the opposite, and the fix is a bounded, well-understood modeling decision rather than an open research problem — which is exactly the kind of drift a DDD pass is supposed to catch before it becomes an incident (a user permanently loses a "never lost" study record) rather than after.
