---
title: "Guardian aggregate refactor plan — session content/score must be server-authoritative"
created: 2026-07-03
type: refactor-plan
---

# Invariant & aggregate refactor plan: `PracticeAttempt`

> Scope note: this document is a PLAN. No production code was modified while producing
> it. All file:line citations below were read directly from the repository at commit
> `c2273a4` (branch `main`) before being quoted.

## STEP 0 — Context

**Product**: CloudExamMatter (`context/foundation/prd.md`) — a signed-in developer picks
a cloud provider + exam + question count, the app generates fresh exam-representative
multiple-choice questions on demand (OpenRouter, `openai/gpt-4o-mini`), grades answers
with explanation-first feedback, and persists a revisitable, scored session that feeds a
per-exam progress trend.

**Stack** (`context/foundation/tech-stack.md`, `README.md`): Astro 6 SSR + React 19
islands, TypeScript 5, Supabase (Postgres + Auth + RLS), Cloudflare Workers runtime,
OpenRouter for generation. No ORM — direct `@supabase/supabase-js` queries.

**Layers**:
- API routes — `src/pages/api/**` (thin, zod-validated, auth-gated)
- Domain/business logic — `src/lib/practice/*.ts` (pure functions, no I/O — `session.ts`,
  `progress.ts`)
- External-service integration — `src/lib/services/*.ts` (OpenRouter client, question
  generator, question zod schema)
- Persistence — `src/lib/db/*.ts` + `supabase/migrations/*.sql`
- UI — `src/components/practice/*.tsx`, holds all in-progress session state client-side
  (no server-side session state exists today outside the final saved row)

**PRD passages that matter most for this analysis** (`context/foundation/prd.md`):
- Guardrails, lines 56–61: *"Generated questions never present a wrong answer as
  'correct' — answer/explanation accuracy is the product's trust anchor; a misleading
  explanation actively harms prep."* / *"Once a session is saved, it remains
  retrievable — saved sessions are never lost."* / *"A user's sessions and scores are
  visible only to their own account."*
- Business Logic, lines 137–141: *"the rule judges each response against the correct
  answer and surfaces the explanation, then aggregates the results into an overall score
  and a per-topic/domain breakdown for the completed session."*

---

## STEP 1 — Identified business invariants

| # | Invariant (must always be true) | Source(s) |
|---|---|---|
| INV-1 | A saved session's questions (stem, options, **which option is correct**, explanation) and its resulting score must be the server's own record of what it generated for that request — never data re-supplied by the client at save time. | PRD Guardrail `prd.md:56-57` ("trust anchor"); `src/lib/practice/session.ts:94-97`; `src/pages/api/practice/sessions.ts:31-35`; `README.md:96` |
| INV-2 | Once a session is saved, it remains retrievable — never lost (except by explicit owner action). | PRD Guardrail `prd.md:58` |
| INV-3 | A user's sessions/scores are visible only to their own account. | PRD Access Control `prd.md:143-149` |
| INV-4 | The number of questions generated equals the user-chosen count. | PRD FR-004/AC `prd.md:73,91-93` |
| INV-5 | Every question has exactly 4 options and exactly one of them is `correctOptionId`. | `src/lib/services/question-schema.ts:17-29` (zod `.refine`) |
| INV-6 | The option marked correct really is correct, and the explanation is truthful (semantic accuracy of generated content). | PRD Guardrail `prd.md:56-57` |
| INV-7 | A question set is ready within 10s, with visible progress, never a blank screen. | PRD NFR `prd.md:119-121`, Guardrail `prd.md:60-61` |
| INV-8 | Data read back from the DB is validated before being trusted as a typed domain object. | `src/lib/db/sessions.ts:96,111,130` (currently unchecked `as unknown as ...` casts) |

---

## STEP 2 — Classification and choice

Scored on **Core** (1–5, tie to PRD vision/guardrails), **Spread** (1–5, how many
files/layers touch it), **Enforcement** (Enforced / Declared-only / Violable).

| # | Invariant | Core | Spread | Enforcement today |
|---|---|:-:|:-:|---|
| **INV-1** | **Session content/score is server-authoritative** | **5** | **5** — `generate.ts`, `question-generator.ts`, `session.ts`, `sessions.ts` route, `db/sessions.ts`, migration, `PracticeGenerator.tsx`, README, and a prior audit (`context/changes/practice-flow-analysis/research.md`) all touch or *claim* this rule | **Declared in 4 separate places, violable today** — see STEP 3 |
| INV-2 | Saved sessions never lost | 4 | 2 | Enforced — no `UPDATE` RLS policy (immutable rows); `DELETE` is an explicit, confirm-gated owner action (`HistoryList.tsx:29-30`), which reads as compatible with "never *involuntarily* lost," not a violation |
| INV-3 | Per-user data isolation | 5 | 3 | Strongly enforced, **doubled up**: RLS policies (`supabase/migrations/20260619111103_create_practice_sessions.sql:24-31`) *and* explicit `.eq("user_id", userId)` at every call site (`db/sessions.ts:88,104,119,134`) |
| INV-4 | Generated count == requested count | 4 | 3 | Enforced — retried until it matches or fails loud (`question-generator.ts:105-108`), plus zod bounds (`question-schema.ts:9-10`) and UI clamp (`PracticeGenerator.tsx:25-26`) |
| INV-5 | Question structural well-formedness | 3 | 2 | Enforced — zod `.refine` (`question-schema.ts:26-29`), applied at the generation-output boundary |
| INV-6 | Generated content is semantically true | **5** | 1 | **Not enforceable in code** — no computable precondition exists for "is this explanation true"; the only real lever is prompt quality + the dev-only manual spot-check endpoint (`src/pages/api/dev/generate.ts:7-10`) |
| INV-7 | <10s generation, visible progress | 3 | 2 | Enforced — 9s `AbortController` timeout (`openrouter.ts:5,37-39`) + count cap (`question-schema.ts:5-10`), already tuned once (`context/foundation/lessons.md`) |
| INV-8 | DB reads are validated before trust | 3 | 1 | Not enforced today, **but already scoped** into an in-flight sibling plan (see below) |

### Choice: INV-1

**Why not INV-6** (the PRD's literally-named "trust anchor," and the highest-scoring
"core" axis of all eight): it cannot be turned into a domain-object precondition. An
aggregate method can validate *shape* (`options.length === 4`, `correctOptionId` exists
among the options — already done, INV-5) but it cannot validate *truth* — there is no
`isActuallyCorrect(explanation)` function to call. STEP 4 requires "domain methods with
explicit preconditions" — INV-6 has none that are computable. INV-1 is the closest
**enforceable** decomposition of the same guardrail: it can't guarantee the LLM was
right, but it *can* guarantee that whatever the LLM said is exactly what gets graded,
shown, and persisted — with no substitution possible in between. That is the part of
"trust anchor" that is a legitimate software invariant, and it is the part currently
unenforced.

**Why not INV-8** (DB read validation — the "obvious-looking" candidate, since it's
already written up as a concrete gap): a fully-worked plan for it already exists at
`context/changes/practice-flow-analysis/plan.md` (status: `planned`, not yet
implemented) — re-proposing it here would duplicate live work. More importantly, even
fully fixed, INV-8 only guards against *accidental* schema drift on read — a **well-formed
but entirely fabricated** row (any stem, any `correctOptionId`, any explanation, all
internally consistent) sails through a `safeParse` untouched, because it validates
*shape*, not *provenance*. INV-1 is the deeper gap that the very research feeding that
sibling plan walked past: it labeled `gradeSubmission` "the trust anchor" and closed its
"never trust the client" investigation there (`research.md:82,233-237`), never noticing
that `gradeSubmission`'s own `questions` parameter is itself 100% client-supplied at the
one call site that matters. This is exactly the STEP 2 instruction in practice — the
invariant chosen here is the one a prior, thorough audit *missed*, not the one it already
found.

**Why not INV-2/INV-3/INV-4/INV-5/INV-7**: all are meaningfully enforced today, several
redundantly (2–3 layers). None qualifies as "weakly enforced."

**INV-1 wins on both axes simultaneously**: tied for the highest core score (5) and the
only invariant among the eight that is actively violable in production today with zero
enforcement, despite being *declared* as solved in four independent places. That
combination — high centrality, wide blast radius, confidently-asserted-but-false — is
the target this refactor is built to close.

---

## STEP 3 — Diagnosis of INV-1

### What is claimed (declared)

1. `src/lib/practice/session.ts:94-97` (JSDoc on `gradeSubmission`):
   > "Recompute authoritative answers + score from a raw client submission, ignoring any
   > client-sent correctness... the persisted score must never trust a client-supplied
   > flag (**the product's trust anchor**)."
2. `src/pages/api/practice/sessions.ts:31-35` (route JSDoc):
   > "Persist a COMPLETED practice session (save-on-complete)... recomputes the score
   > server-side (**never trusts the client's correctness**) before inserting."
3. `README.md:96`:
   > "The server recomputes the score on save (**never trusting the client**)."
4. `context/changes/practice-flow-analysis/research.md:82`:
   > "`sessions.ts:62-65` → `gradeSubmission(questions, answers)` (`session.ts:98-123`) —
   > **server-authoritative regrade, the trust anchor**."
   and `research.md:233-237` frames this as one half of a "deliberate 'never trust the
   client, never trust the model' pattern, consistently applied."
5. Tests reinforce the same framing: `session.test.ts:150` — *"recomputes correctness
   from the question set, **ignoring any client-sent flag**"*; `sessions.test.ts:108` —
   *"Persisted answers carry server-derived correctness, **not a client-sent flag**."*

### What actually happens (violable)

- `src/pages/api/practice/sessions.ts:8-14` — the route's own zod schema accepts the
  **entire question set from the request body**, unchanged:
  ```
  const requestSchema = z.object({
    provider: z.enum(["AWS", "Azure", "GCP"]),
    exam: z.string().trim().min(1),
    questions: z.array(questionSchema).min(1),   // ← includes correctOptionId + explanation
    answers: z.array(z.object({ questionId: z.string().min(1), selectedOptionId: z.string().min(1) })).min(1),
  });
  ```
  `questionSchema` (`question-schema.ts:17-29`) validates *shape* only — 4 options, one
  of them referenced by `correctOptionId` — not that this is the question, or the
  correct answer, the server actually generated.
- `sessions.ts:54,62` — `const { provider, exam, questions, answers } = parsed.data;`
  then `const graded = gradeSubmission(questions, answers);` — `questions` here is the
  client-submitted value from the line above, full stop.
- `src/lib/practice/session.ts:98-123`, specifically line 118:
  `correct: raw.selectedOptionId === question.correctOptionId` — **both operands of this
  comparison originate from the same untrusted request body.** The function only guards
  against a client sending a `correct: true` flag directly (a much narrower attack than
  the one that's actually open); it never questioned where `question.correctOptionId`
  itself came from.
- `src/pages/api/practice/generate.ts:1-58` — the endpoint that actually produces
  trustworthy content (`generateQuestions`, validated via `generationResponseSchema` at
  `question-generator.ts:100-108`) returns its result **straight to the client and
  retains nothing server-side** — no cache, no DB row, no token, no import of
  `@/lib/supabase` anywhere in the file. There is nothing later saved-session data could
  even be checked against.
- `src/lib/db/sessions.ts:63-82` (`saveSession`) persists `input.payload` verbatim into
  the `payload` JSONB column with **no linkage to any prior generation event** —
  confirmed against the migration (`supabase/migrations/20260619111103_create_practice_sessions.sql:5-15`)
  and the generated types (`src/db/database.types.ts:47-82`): the `practice_sessions`
  table has no `generation_id`/foreign-key column of any kind.
- `src/components/practice/PracticeGenerator.tsx:110-131`, specifically line 119
  (`questions: completed.questions,`) — the client holds the full `Question[]` (with
  `correctOptionId`/`explanation`) in React state after generation and re-sends the
  **entire object graph** back to the server at save time. This is necessary today only
  because the server has no other way to know what the session's content was.

### Net effect

Any authenticated user can call `POST /api/practice/sessions` directly — bypassing the
UI and even bypassing OpenRouter generation entirely — with a hand-crafted `questions`
array (any stem/options/`correctOptionId`/`explanation`, so long as it is structurally
well-formed) and an `answers` array engineered to score however they like. The server
will accept it as a 200, persist it as a genuine session, and it will silently feed:
- the per-exam progress trend (`progress.ts:14-37`, `ProgressDashboard.tsx`) — fabricated
  trend data,
- weak-topic detection (`progress.ts:55-97`) — invertible to suppress or fake "weak"
  topics feeding the FR-011 retry loop,
- the history/revisit view (`SavedSessionView.tsx`) — showing attacker-controlled
  "explanation" text with no LLM guardrail applied at all, directly defeating the PRD's
  named trust anchor for that record.

Because RLS + the explicit `user_id` filters (INV-3) are solid, this is a **self-forgery**
integrity gap, not a cross-user confidentiality breach — but it fully defeats the
product's central premise for FR-007/FR-008/FR-010 (explanation-first feedback and a
*meaningful* progress record) for the account that does it, and, more subtly, gives a
buggy client, a stale/cached tab, or a browser extension the same power *unintentionally*
against an honest user's own history.

**Which layer is the sole guard?** None, structurally — the client is the *only* thing
that currently produces a `questions` payload that matches a real generation, but that's
an accident of the happy-path UI flow, not an enforced constraint. No layer checks it.

**Is it "silently swallowed"?** Not exactly — nothing catches and suppresses an error.
It's worse in one sense: **no code path exists to even recognize the violation**, so the
operation runs to a clean `200 { ok: true, id }`. The four "trust anchor" claims quoted
above are all true of the narrower thing they each individually check (a client-sent
`correct` boolean) and false of the actual boundary that matters (client-sent
`correctOptionId`/content).

---

## STEP 4 — Guardian aggregate design: `PracticeAttempt`

### Concept

Introduce a new aggregate root, **`PracticeAttempt`**, whose identity (`id`, minted at
generation time) is the single thread connecting "questions the server actually
generated" to "the score/answers a client submits." A saved `practice_sessions` row can
only ever be produced by *completing* a loaded `PracticeAttempt` — never by a freeform
insert built from request-body data.

This also fixes a structural oddity noted in the diagnosis: today there are **two
disconnected representations** of "a practice session" — an identity-less, in-memory
client struct (`PracticeSession` in `session.ts`) and an independently-created DB row
(`SavedSession`) with no link back to how it was produced. `PracticeAttempt` gives the
whole lifecycle one stable identity from generation through completion.

The client-side pure functions in `session.ts` (`createSession`, `submitAnswer`,
`advance`, `score`, `topicBreakdown`, ...) are **kept as-is** — they still drive the
interactive, instant-feedback UX (the <1s feedback NFR requires local grading; the
correct option necessarily ships to the browser at generation time regardless). What
changes is the **save boundary only**: `gradeSubmission` is retired from the public API
(its logic is absorbed into `completeAttempt` below, sourced from the aggregate's own
retained `questions`, never from a request parameter).

### Aggregate shape

```ts
// src/lib/practice/practice-attempt.ts
export const ATTEMPT_EXPIRY_HOURS = 24;

export interface PracticeAttempt {
  id: string;                      // minted server-side at generation time — the aggregate's identity
  userId: string;
  provider: "AWS" | "Azure" | "GCP";
  exam: string;
  questions: Question[];           // the server's own retained record — never re-accepted from a client
  confidence: GenerationConfidence;
  status: "pending" | "completed"; // "expired" is a *computed* condition (age-based), not a stored state
  createdAt: string;
  completedAt: string | null;
}
```

### Named domain errors (thrown, never silently returned as a modified state)

```ts
export class PracticeAttemptError extends Error {}
export class InvalidAttemptError extends PracticeAttemptError {}          // e.g. question count out of bounds at creation
export class ForbiddenAttemptAccessError extends PracticeAttemptError {}  // attempt.userId !== caller
export class AttemptAlreadyCompletedError extends PracticeAttemptError {} // status === "completed"
export class AttemptExpiredError extends PracticeAttemptError {}          // pending but past ATTEMPT_EXPIRY_HOURS
export class IncompleteAttemptError extends PracticeAttemptError {}       // answers.length !== questions.length
export class UnknownQuestionError extends PracticeAttemptError {
  constructor(public questionId: string) { super(`Unknown questionId: ${questionId}`); }
}
export class MissingAnswerError extends PracticeAttemptError {
  constructor(public questionId: string) { super(`Missing answer for questionId: ${questionId}`); }
}
```

> **Why throw, not a `{ ok:false }` result, here** — the rest of this codebase
> consistently returns discriminated results and never throws *to its caller*
> (`question-generator.ts:52-56`, `sessions.ts` route JSDoc). This plan keeps that
> contract at every I/O boundary: the aggregate's methods throw *inside a single call
> stack*, and the thin route layer (below) catches and maps to the existing
> `{ ok:false, error:{code,message} }` shape before anything crosses an HTTP boundary —
> satisfying "throws a named domain error, never silently updates state" from the domain
> layer's point of view while staying byte-for-byte consistent with this repo's
> established never-throw-to-the-client idiom.

### Domain methods (pure, pseudocode)

```ts
/** Precondition: MIN_QUESTION_COUNT <= questions.length <= MAX_QUESTION_COUNT
 *  (defense-in-depth mirror of question-generator.ts:60-68's own re-check). */
export function startAttempt(input: {
  id: string; userId: string; provider: Provider; exam: string;
  questions: Question[]; confidence: GenerationConfidence;
}): PracticeAttempt {
  if (input.questions.length < MIN_QUESTION_COUNT || input.questions.length > MAX_QUESTION_COUNT) {
    throw new InvalidAttemptError(
      `questions.length must be between ${MIN_QUESTION_COUNT} and ${MAX_QUESTION_COUNT}`,
    );
  }
  return { ...input, status: "pending", createdAt: new Date().toISOString(), completedAt: null };
}

/** Defense-in-depth ownership check, mirrors db/sessions.ts's explicit user_id filters. */
export function assertOwnedBy(attempt: PracticeAttempt, userId: string): void {
  if (attempt.userId !== userId) {
    throw new ForbiddenAttemptAccessError(`Attempt ${attempt.id} does not belong to this user`);
  }
}

/**
 * Grade a raw submission against THIS attempt's OWN retained `questions` — never
 * against caller-supplied question content. `attempt.questions` is the sole authority
 * for "what the correct answer was," fixed immutably at generation time. Absorbs the
 * former `gradeSubmission` algorithm (unknown-id / missing-answer checks, index
 * alignment) but the `questions` argument is gone from the public surface entirely.
 */
export function completeAttempt(
  attempt: PracticeAttempt,
  rawAnswers: RawAnswer[],
): { answers: AnswerRecord[]; score: SessionScore } {
  if (attempt.status === "completed") throw new AttemptAlreadyCompletedError(attempt.id);

  const ageMs = Date.now() - new Date(attempt.createdAt).getTime();
  if (ageMs > ATTEMPT_EXPIRY_HOURS * 60 * 60 * 1000) throw new AttemptExpiredError(attempt.id);

  for (const raw of rawAnswers) {
    if (!attempt.questions.some((q) => q.id === raw.questionId)) throw new UnknownQuestionError(raw.questionId);
  }
  if (rawAnswers.length !== attempt.questions.length) throw new IncompleteAttemptError(attempt.id);

  const rawById = new Map(rawAnswers.map((r) => [r.questionId, r]));
  const answers: AnswerRecord[] = attempt.questions.map((question) => {
    const raw = rawById.get(question.id);
    if (raw === undefined) throw new MissingAnswerError(question.id);
    return {
      questionId: question.id,
      selectedOptionId: raw.selectedOptionId,
      correct: raw.selectedOptionId === question.correctOptionId, // ← sourced only from attempt.questions
    };
  });

  const correct = answers.filter((a) => a.correct).length;
  const total = answers.length;
  const percentage = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { answers, score: { correct, total, percentage } };
}
```

### Repository — loads/saves the aggregate as a whole

```ts
// src/lib/db/practice-attempts.ts
export async function createAttempt(client: Client, attempt: PracticeAttempt): Promise<CreateResult> { ... }
// single INSERT into practice_attempts, status='pending'

export async function getAttempt(client: Client, userId: string, id: string): Promise<PracticeAttempt | null> {
  const { data, error } = await client.from("practice_attempts").select("*")
    .eq("id", id).eq("user_id", userId).maybeSingle();
  if (error || !data) { if (error) console.error("getAttempt failed:", error.message); return null; }
  const parsed = practiceAttemptRowSchema.safeParse(data); // read-boundary guard — see cross-reference below
  if (!parsed.success) { console.error("getAttempt: malformed row", parsed.error); return null; }
  return rowToAttempt(parsed.data);
}

/** The ONLY way a practice_sessions row is ever created. Atomic: pending→completed
 *  transition + immutable session insert happen together or not at all. */
export async function finalizeAttempt(
  client: Client, attemptId: string, result: { answers: AnswerRecord[]; score: SessionScore },
): Promise<{ ok: true; id: string } | { ok: false; error: "already-completed" | string }> {
  const { data, error } = await client.rpc("finalize_practice_attempt", {
    p_attempt_id: attemptId,
    p_answers: result.answers,
    p_correct: result.score.correct,
    p_total: result.score.total,
    p_percentage: result.score.percentage,
  });
  if (error) return { ok: false, error: error.code === "P0001" ? "already-completed" : error.message };
  return { ok: true, id: data as string };
}
```

**Why atomicity needs a Postgres function, not two client calls**: the transition
"`practice_attempts.status: pending → completed`" and "insert the immutable
`practice_sessions` row" must succeed or fail together — otherwise a race between two
concurrent completions of the same attempt (double-submit, retry-after-timeout, etc.)
could either produce two saved sessions from one generation or flip the attempt to
`completed` while losing the session write. `supabase-js`/PostgREST does not span a
transaction across two separate table calls, so this repo's existing idiom for
cross-statement atomicity is a Postgres function invoked via `.rpc(...)`. The function
performs a conditional `UPDATE ... WHERE status = 'pending' RETURNING ...` (a
compare-and-swap) — if zero rows are affected because another request already completed
it, the function raises, and the repository maps that to `"already-completed"` instead of
silently double-inserting:

```sql
-- supabase/migrations/<ts>_practice_attempts_and_finalize.sql (design, not applied)
create table public.practice_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  provider     text not null,
  exam         text not null,
  questions    jsonb not null,
  confidence   text not null,
  status       text not null default 'pending' check (status in ('pending', 'completed')),
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index practice_attempts_user_status_idx on public.practice_attempts (user_id, status, created_at);

alter table public.practice_attempts enable row level security;

create policy "own_attempts_select" on public.practice_attempts
  for select to authenticated using (auth.uid() = user_id);
create policy "own_attempts_insert" on public.practice_attempts
  for insert to authenticated with check (auth.uid() = user_id);
-- Deliberately no client-facing UPDATE policy: the pending→completed transition is
-- only reachable through the SECURITY DEFINER function below.

alter table public.practice_sessions
  add column generation_id uuid references public.practice_attempts (id);

create or replace function public.finalize_practice_attempt(
  p_attempt_id uuid, p_answers jsonb, p_correct int, p_total int, p_percentage int
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_provider text; v_exam text; v_questions jsonb; v_session_id uuid;
begin
  update practice_attempts
     set status = 'completed', completed_at = now()
   where id = p_attempt_id and user_id = auth.uid() and status = 'pending'
   returning provider, exam, questions into v_provider, v_exam, v_questions;

  if not found then
    raise exception 'attempt_not_completable' using errcode = 'P0001';
  end if;

  insert into practice_sessions (user_id, provider, exam, correct, total, percentage, payload, generation_id)
  values (auth.uid(), v_provider, v_exam, p_correct, p_total, p_percentage,
          jsonb_build_object('questions', v_questions, 'answers', p_answers), p_attempt_id)
  returning id into v_session_id;

  return v_session_id;
end;
$$;
```

Note the function reads the caller's identity from `auth.uid()` **inside** the function
body rather than accepting a `p_user_id` parameter — a `SECURITY DEFINER` function that
trusted a caller-supplied user id would reopen exactly the class of hole this plan
closes (impersonation via a forged parameter). This is the same "don't trust a value the
caller can set" principle applied one layer down, at the SQL boundary.

### Thin API layer

```ts
// src/pages/api/practice/generate.ts (tail, updated)
const result = await generateQuestions({ exam: `${provider} ${exam}`, count, topics });
if (!result.ok) return json(result, 400);

const supabase = createClient(context.request.headers, context.cookies);
if (!supabase) return json({ ok: false, error: { code: "not-configured", message: "Storage is not configured." } }, 500);

const attempt = startAttempt({
  id: crypto.randomUUID(), userId: context.locals.user.id, provider, exam,
  questions: result.questions, confidence: result.confidence,
});
const created = await createAttempt(supabase, attempt);
if (!created.ok) return json({ ok: false, error: { code: "save-failed", message: created.error } }, 500);

return json({ ok: true, attemptId: attempt.id, questions: attempt.questions, confidence: attempt.confidence }, 200);
```

```ts
// src/pages/api/practice/attempts/[id]/complete.ts (new — replaces POST /api/practice/sessions)
export const POST: APIRoute = async (context) => {
  if (!context.locals.user) return json({ ok: false, error: { code: "unauthorized", message: "..." } }, 401);

  const id = context.params.id;
  if (!id) return json({ ok: false, error: { code: "invalid-input", message: "Missing attempt id." } }, 400);

  const parsed = completeRequestSchema.safeParse(await context.request.json().catch(() => null));
  // completeRequestSchema = z.object({ answers: z.array(rawAnswerSchema).min(1) }) — NOTE: no `questions` field at all.
  if (!parsed.success) return json({ ok: false, error: { code: "invalid-input", message: "..." } }, 400);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json({ ok: false, error: { code: "not-configured", message: "..." } }, 500);

  const attempt = await getAttempt(supabase, context.locals.user.id, id);
  if (!attempt) return json({ ok: false, error: { code: "attempt-not-found", message: "..." } }, 404);

  let graded: ReturnType<typeof completeAttempt>;
  try {
    assertOwnedBy(attempt, context.locals.user.id); // redundant with getAttempt's own filter — explicit, matches db/sessions.ts style
    graded = completeAttempt(attempt, parsed.data.answers);
  } catch (err) {
    return json(mapAttemptError(err), statusForAttemptError(err)); // AlreadyCompleted/Expired→409, Forbidden→403, Incomplete/Unknown/Missing→400
  }

  const saved = await finalizeAttempt(supabase, id, graded);
  if (!saved.ok) {
    if (saved.error === "already-completed") {
      return json({ ok: false, error: { code: "already-completed", message: "This session was already saved." } }, 409);
    }
    return json({ ok: false, error: { code: "save-failed", message: saved.error } }, 500);
  }
  return json({ ok: true, id: saved.id }, 200);
};
```

This is exactly "parse input → call the aggregate's method → map the domain error to a
response," and it moves enforcement that today exists **only in the client's happy path**
(PracticeGenerator.tsx re-sending the same `questions` it just received) onto the server,
where it cannot be bypassed by calling the API directly.

---

## STEP 5 — Before/after, phased plan, tests

### Before / after by location

| Location | Before | After |
|---|---|---|
| `generate.ts` | Returns questions to the client; nothing retained server-side | Persists a `practice_attempts` row (`status: pending`) via `createAttempt`; returns `attemptId` + questions |
| `question-generator.ts` / `question-schema.ts` | Validates freshly-generated content (unchanged, correct) | Unchanged |
| `PracticeGenerator.tsx` | Holds full `Question[]` client-side; re-POSTs the entire objects (incl. `correctOptionId`/`explanation`) at save time | Holds `attemptId` + local answering state; POSTs only `{ answers }` to `/api/practice/attempts/:id/complete` |
| `sessions.ts` (`POST /api/practice/sessions`) | Accepts `questions` wholesale from the client as ground truth | **Removed** — replaced by `attempts/[id]/complete.ts`, which loads the attempt server-side |
| `session.ts` `gradeSubmission` | Public function, callable with any `questions` argument | Retired from the public surface; its logic lives inside `completeAttempt`, always fed `attempt.questions` |
| `db/sessions.ts` `saveSession` | Called directly by the route with client-echoed data; single non-transactional INSERT; no generation linkage | Called only from inside `finalizeAttempt`'s single Postgres transaction; every row carries `generation_id` |
| `supabase/migrations` | No `practice_attempts` table; `practice_sessions` has no generation linkage | New `practice_attempts` table + RLS; `practice_sessions.generation_id` FK; `finalize_practice_attempt` RPC |
| `README.md` architecture section | Claims "never trusting the client" (true only for the `correct` boolean) | Updated to describe the attempt-linkage guarantee accurately |

### Phased plan

**Phase 1 — Domain aggregate & errors (test-first / TDD).** Pure, no I/O — the same
shape as the existing `session.test.ts`/`session.ts` pair, so this is a strong TDD
candidate. Write `src/lib/practice/practice-attempt.test.ts` first (red), then
`src/lib/practice/practice-attempt.ts` (green).

Concrete test cases:
- *Legal*: `completeAttempt` on a pending, fresh attempt with a full, id-matching answer
  set → returns question-order-aligned `answers[]` + correct `score` (mirror
  `session.test.ts:150-198`'s fixtures, including out-of-order submission).
- *Legal*: `startAttempt` with `questions.length` inside `[MIN_QUESTION_COUNT, MAX_QUESTION_COUNT]`.
- *Illegal*: `completeAttempt` on `status: "completed"` → throws `AttemptAlreadyCompletedError`.
- *Illegal*: `completeAttempt` on a `pending` attempt whose `createdAt` is older than
  `ATTEMPT_EXPIRY_HOURS` → throws `AttemptExpiredError`.
- *Illegal*: `rawAnswers.length !== attempt.questions.length` → throws `IncompleteAttemptError`.
- *Illegal*: an answer references a `questionId` absent from `attempt.questions` → throws `UnknownQuestionError`.
- *Illegal*: a question in `attempt.questions` has no matching answer → throws `MissingAnswerError`.
- *Illegal*: `assertOwnedBy` with a mismatched `userId` → throws `ForbiddenAttemptAccessError`.
- *Illegal*: `startAttempt` with `questions.length` outside bounds → throws `InvalidAttemptError`.
- *Security-shaped test*: build an `attempt` whose `questions[0].correctOptionId` is
  `"b"`, then call `completeAttempt` with an `answers` array that would score 100% only
  if `correctOptionId` were `"a"` — assert the score reflects the **attempt's** data, not
  any externally-implied "correct" answer. (This is the regression guard for the exact
  gap this plan closes.)

**Phase 2 — Persistence: migration + repository.** Not strict TDD (thin plumbing over
SQL, consistent with this repo's existing precedent that `db/sessions.ts`'s query layer
is tested only at the pure-mapper level — see `context/changes/practice-flow-analysis/research.md`
Technical debt #4). Add the migration above; add `practice-attempts.ts` with
`createAttempt`/`getAttempt`/`finalizeAttempt`; add `rowToAttempt`/`practiceAttemptRowSchema`
tested with plain fixtures (mirrors `rowToSummary`/`rowToSaved` in `db/sessions.ts:46-61`).
Cross-reference: apply the same `safeParse`-on-read discipline the sibling
`practice-flow-analysis` plan is adding to `practice_sessions` reads to these new
`practice_attempts` reads too, so the new table doesn't reopen the gap that plan is
closing elsewhere.

**Phase 3 — API layer (test-first).** Existing `generate.test.ts`/`sessions.test.ts`
already establish the `vi.mock("@/lib/supabase")`/`vi.mock("@/lib/db/...")` pattern this
phase reuses. Write route tests first:
- `generate`: 401 unauthenticated; on success, asserts `createAttempt` was called and the
  response includes `attemptId`.
- `complete`: 401 unauthenticated; 400 on a body that fails zod (and assert the schema
  has **no `questions` field** — a structural regression guard, not just a behavioral one);
  404 when the attempt id doesn't belong to the caller or doesn't exist; 409 when
  already completed (assert `finalizeAttempt`/`saveSession`-equivalent is not called
  twice); 200 with `{ ok: true, id }` on success, asserting the persisted score is
  derived from the **loaded attempt's** `questions`, not from anything in the request body.
- Regression: `POST /api/practice/sessions` (old route) removed; add a test confirming
  it 404s (route file deleted) rather than silently keeping the old trusting behavior
  alive.

**Phase 4 — UI wiring.** Update `PracticeGenerator.tsx` to store `attemptId` from the
generate response and POST only `{ answers }` to
`/api/practice/attempts/:id/complete`. Implement-then-verify (not TDD — no existing
`.test.tsx` convention for this component per prior research). Manual verification: full
generate → answer → save → history/dashboard happy path; and a forged-request check
(curl/Postman a `complete` call with a stale/foreign attempt id → expect 404/409, not 200).

**Phase 5 — Cleanup.** Update `README.md:96` to describe the attempt-linkage guarantee
precisely; update the JSDoc comments cited in STEP 3 so they describe what is actually
enforced. Optional/follow-up, not required for correctness (the domain layer already
enforces expiry by age regardless of a sweep): a periodic cleanup of stale `pending`
attempts for storage hygiene — skip for now given `target_scale: small`
(`prd.md:8-11`); revisit only if attempt volume becomes a real storage concern.

### Secondary observations (not in scope for this refactor)

- `Provider` (`z.enum(["AWS","Azure","GCP"])`) is independently declared three times
  (`generate.ts:9`, `sessions.ts:11`, `PracticeGenerator.tsx:22`) and `MAX_COUNT = 5` is
  a separate hardcoded literal in `PracticeGenerator.tsx:26` alongside the canonical
  `MAX_QUESTION_COUNT` in `question-schema.ts:10`. Both are currently consistent but are
  DRY smells worth consolidating into one shared export while this area is being
  touched — not an invariant violation today, so left out of the phased plan above.

---

## Load-bearing names to register

| Name | Kind | Location |
|---|---|---|
| `PracticeAttempt` | Aggregate root (interface) | `src/lib/practice/practice-attempt.ts` |
| `startAttempt`, `completeAttempt`, `assertOwnedBy` | Domain methods | `src/lib/practice/practice-attempt.ts` |
| `PracticeAttemptError` and subclasses (`InvalidAttemptError`, `ForbiddenAttemptAccessError`, `AttemptAlreadyCompletedError`, `AttemptExpiredError`, `IncompleteAttemptError`, `UnknownQuestionError`, `MissingAnswerError`) | Named domain errors | `src/lib/practice/practice-attempt.ts` |
| `ATTEMPT_EXPIRY_HOURS` | Domain constant | `src/lib/practice/practice-attempt.ts` |
| `createAttempt`, `getAttempt`, `finalizeAttempt` | Repository functions | `src/lib/db/practice-attempts.ts` |
| `practice_attempts` | Table | `supabase/migrations/<ts>_practice_attempts_and_finalize.sql` |
| `generation_id` | FK column on `practice_sessions` | same migration |
| `finalize_practice_attempt` | Postgres RPC (atomic transition + insert) | same migration |
| `POST /api/practice/attempts/:id/complete` | New route, supersedes `POST /api/practice/sessions` | `src/pages/api/practice/attempts/[id]/complete.ts` |

---

## Summary

CloudExamMatter names "answer/explanation accuracy" as its product trust anchor and
claims in four separate places (code comments, README, tests, and a prior certification
audit) that session scoring is "server-authoritative" — but `POST /api/practice/sessions`
(`sessions.ts:8-14,54,62`) actually accepts the entire `questions` array, including
`correctOptionId` and `explanation`, straight from the client at save time, and
`gradeSubmission` (`session.ts:118`) grades against that same untrusted data. The chosen
invariant, INV-1, was picked over the PRD's literal "trust anchor" wording (INV-6,
unenforceable — no code can verify LLM truthfulness) and over the DB-read-validation gap
already owned by a sibling in-flight plan (INV-8, real but only guards accidental drift,
not adversarial fabrication) because INV-1 is simultaneously core, wide-spread across
every layer of the stack, and the one place a prior thorough audit declared victory
without noticing the actual hole. The fix introduces a `PracticeAttempt` aggregate whose
identity is minted at generation time and whose `questions` are retained server-side;
completion is only possible by loading that aggregate and grading against its own data,
with the state transition and the resulting immutable session row committed atomically
via a Postgres RPC. The plan is staged as pure-domain TDD first, persistence/repository
second, route contract TDD third, then UI wiring and cleanup — closing the gap without
weakening the sub-second local-feedback UX the NFRs require.
