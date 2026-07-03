---
title: "10xArchitect certification report — Module 4"
created: 2026-07-03
---

# Module 4 architectural report — CloudExamMatter

## 1. Described projects

One repository for all four artifacts: **CloudExamMatter**
(`Sepcio88/10x_cert`, commit `c2273a4`) — Astro 6 (SSR) + React 19 islands,
TypeScript 5, Supabase (Postgres/Auth/RLS), Cloudflare Workers, OpenRouter
(`gpt-4o-mini`) for on-demand cloud-certification practice questions. Scale:
solo developer, 46 commits, 2.5 weeks old (2026-06-18 → 2026-07-03), ~55
`src/` modules. L2 → `context/map/`. L3/L4 → `context/changes/practice-flow-analysis/`. L5 → `context/domain/`.

## 2. Project map (L2)

Full artifact: `context/map/repo-map.md` (+ 3 source artifacts: territory, structure, contributors).

- **Shared kernel risk**: `src/types.ts` has 15 incoming dependencies (Ca=15,
  I=0.06) — the single highest-blast-radius file in the repo.
- **Clean layering, zero cycles**: dependency-cruiser over all 55 modules
  found no circular imports; the instability gradient runs cleanly from
  `types.ts`/`utils.ts` (I≈0) through the service/db layer (I≈0.3–0.6) to
  pages/components/middleware (I=1.0) — nothing in `lib/**` imports from
  `components/**` or `pages/**`.
- **Local center**: the practice-generation-and-grading flow
  (`PracticeGenerator.tsx`, `types.ts`, `question-generator.ts`) is the
  hottest code by git churn — this is why it was chosen for L3.
- **CI/CD is actively engineered, not incidental**: `.github/workflows/ci.yml`
  is the 2nd-most-churned file in the repo (7 commits) — relevant context for
  the M5 Champion track.
- **Unknown/limitation**: 2.5 weeks of history is too short to call anything
  "legacy" yet — churn/coupling numbers are directional, and the
  single-author signal answers "how does this person work," not "who owns
  what" (no bus factor to map).

## 3. Feature analysis (L3)

Full artifact: `context/changes/practice-flow-analysis/research.md`.

**Flow analyzed**: exam/count selection → question generation (OpenRouter) →
answer with explanation-first feedback → session save → dashboard/history
read-back. Chosen because the repo map (§2) flags it as both the hottest
code path and the one touching the `types.ts` risk zone most (11 of its 15
import sites).

**Feature overview**: input arrives as a validated HTTP request (provider,
exam, count); state changes twice — once when OpenRouter returns a
`Question[]` validated against a zod schema, once when the client posts a
completed session back for a server-side regrade; the response is a saved,
scored, revisitable session row that feeds the per-exam progress trend.

**Technical debt** (top 3, one ast-grep-confirmed):
1. **Unvalidated DB read boundary** — `src/lib/db/sessions.ts` casts
   Supabase's untyped JSONB `payload` straight to app types with no
   `zod.safeParse`. Confirmed structurally: `ast-grep -p '$X as unknown as $Y' src/lib/db/sessions.ts` → exactly 3 matches (lines 73, 111, 130), matching
   the claim precisely. Every *other* boundary in this flow validates
   (LLM output, client-submitted answers) — this is the one that doesn't.
2. **`database.types.ts` drifts silently** — synced by a human running
   `supabase gen types` manually; no script, no CI check; the process is
   documented only in an *archived* plan.
3. **`openrouter.ts` has zero direct test coverage** — all generation tests
   mock at the client-factory boundary, so the actual HTTP error/timeout
   translation is unexercised.

## 4. Refactor plan (L4)

Full artifacts: `context/changes/practice-flow-analysis/plan.md` + `plan-brief.md`.

**What's being refactored**: the two debt items above that are genuine
*shape* problems (not test gaps) — (A) add a zod schema for the session
payload and validate at all three DB read call sites, dropping+logging any
row that fails; (B) add an `npm run db:types` script and a hard-failing CI
job that diffs regenerated types against the committed file.

**Explicitly NOT doing**: touching `saveSession`'s write-side cast (already
validated one layer up), adding a logging abstraction, a UI banner for
dropped sessions, RLS integration tests, or reconciling any *current* drift
(only one migration exists — none expected).

**Phases** (both single-phase, additive, fully reversible):
1. Validate the DB read boundary — auto: typecheck/lint/unit tests + new
   malformed-row tests; manual: SQL-editor-inserted bad row degrades
   gracefully, happy path unaffected.
2. Automated `database.types.ts` drift check — auto: `db:types` script
   output matches committed file, new CI job passes on a clean PR; manual:
   provision a `SUPABASE_ACCESS_TOKEN` secret (human-only step), confirm a
   drift-simulating PR fails then passes once reverted.

## 5. Domain, per DDD (L5)

Full artifacts: `context/domain/01-domain-distillation.md`,
`02-invariant-aggregate-refactor.md`, `03-anti-corruption-layer.md`.

**Ubiquitous language** (of 17 terms extracted): `Practice session`,
`Question`, `Grading`, `Saved session`, `Weak topic` are load-bearing and
map cleanly to code. Two notable **MISSING in code** terms: `Exam` has no
entity/catalog at all — it's a bare, unvalidated string threaded straight
into the LLM prompt — and the PRD's guardrail language never anticipated a
`GenerationConfidence` concept the code independently grew.

**Sharpest model-vs-code drift**: the PRD names a Guardrail —
*"Once a session is saved, it remains retrievable — saved sessions are
never lost"* (`prd.md:58`) — that a complete, unit-tested delete path
directly contradicts (RLS delete policy + `DELETE` route + a UI trash
button, `sessions/[id].test.ts:45` asserting the delete *works*). Because
the test suite certifies the contradiction as correct behavior, this will
never surface as a CI failure.

**Invariant #1 and its aggregate**: the chosen invariant is *not* the
literal "answer accuracy" guardrail (unenforceable — no code can check LLM
truthfulness) but its enforceable decomposition: **session content and
score must be server-authoritative.** Diagnosis found this declared true in
four places (code comments, README, tests, and my own L3 research above)
and false in fact — `POST /api/practice/sessions` accepts the *entire*
question array, including `correctOptionId`, straight from the client, and
grades against that same untrusted data. Any signed-in user can forge a
perfect score. The proposed guardian aggregate, `PracticeAttempt`, mints
identity at generation time and retains questions server-side, so
completion can only grade against data the server itself produced.

**Anti-Corruption Layer**: the worst leak is not the LLM client (already a
narrow, single-caller port) but `@supabase/supabase-js` — its raw client is
constructed identically at 9 call sites across 4 layers (ast-grep +
grep-confirmed count: 6 `.ts` sites via `ast-grep -p 'createClient($$$ARGS)'`
+ 3 `.astro` sites), and its vendor `User` type is baked into the global
`App.Locals` contract. The design introduces an `AuthGateway` and a
`SessionsRepository` port/adapter pair, composed once in middleware.

## 6. Decisions that are mine

I picked the practice-generation flow for L3 because the repo map's own
churn data pointed there, not because it looked easiest. For the L4 plan I
deliberately scoped out the write-side cast in `db/sessions.ts` — it's
already validated upstream, and touching it would have blurred the
boundary with the L5 aggregate work, which owns that route more
fundamentally. The DB-read-validation gap (L4) and the client-forged-score
gap (L5, INV-1) look similar at a glance; I kept them as separate plans
because L4 only guards against accidental data drift, while L5's finding is
an adversarial-input gap no amount of read-side validation would catch —
conflating them would have undersold the second one. The single highest-
value finding this cycle produced — that "server-authoritative grading" is
false for the *content* being graded, not just the correctness flag — was
missed by my own L3 research pass; I'm keeping that failure visible here
rather than quietly fixing the earlier document, because it's the clearest
evidence for why the L5 pass earns its place in this pipeline instead of
being redundant with L3/L4.
