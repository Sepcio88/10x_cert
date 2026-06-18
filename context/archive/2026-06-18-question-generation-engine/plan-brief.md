# Question-Generation Engine (F-01) — Plan Brief

> Full plan: `context/changes/question-generation-engine/plan.md`

## What & Why

Build the server-side engine that turns an exam identifier + question count into validated, exam-representative questions — each with a correct answer, an explanation, and a topic tag — via OpenRouter. This is the foundation (roadmap F-01) and the product's riskiest assumption: if on-demand generation can't produce accurate, exam-relevant questions within the latency budget, the whole premise fails. Proving it first is the point.

## Starting Point

A freshly bootstrapped 10x Astro Starter (Astro 6 SSR on Cloudflare Workers, Supabase auth present). It has a server-secret pattern (`astro:env/server`), a null-when-unconfigured service factory (`src/lib/supabase.ts`), a config-status surface, and zod as the validation convention — but no LLM integration and no test runner.

## Desired End State

A `generateQuestions({ exam, count })` module returns a typed result (validated questions + confidence, or a typed error — never throws), enforces a count cap of 20, retries once on bad output, and is covered by mocked unit tests plus a dev-only route for a real-API accuracy spot-check. S-01 later imports this module unchanged.

## Key Decisions Made

| Decision          | Choice                                                       | Why (1 sentence)                                                                                   | Source |
| ----------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------ |
| LLM provider      | OpenRouter                                                   | Pure `fetch` (Workers-safe), model-agnostic so models can be swapped to tune accuracy/latency/cost | Plan   |
| Structured output | JSON + zod validation                                        | Provider-agnostic, matches the repo's stated validation tool, yields a typed contract              | Plan   |
| Foundation scope  | Engine module + types + config + internal verification route | Stays minimal but exercisable end-to-end before any UI                                             | Plan   |
| Question contract | id, stem, 4 options, correctOptionId, explanation, topic     | Covers FR-005/007/008 with nothing speculative                                                     | Plan   |
| Exam grounding    | Pass exam code/name; rely on model knowledge                 | No catalog to build; works for any well-known cert                                                 | Plan   |
| Exam set          | Open set + soft confidence flag                              | Broad coverage with an honest low-confidence signal for unknown exams                              | Plan   |
| Accuracy          | Single low-temp pass + zod + manual spot-check               | Fits <10s/one call; accuracy is human-verified for the MVP                                         | Plan   |
| Latency           | One synchronous call, fast model, capped count               | Simplest contract for S-01; awaited fetch is fine on Workers                                       | Plan   |
| Max count         | Hard cap 20                                                  | Protects the <10s budget and cost (resolves PRD open question)                                     | Plan   |
| Failure handling  | Typed result + one retry, then safe error                    | Gives S-01 a clean contract for the "never blank screen" guardrail                                 | Plan   |
| Verification      | Mocked unit tests + real-API manual spot-check               | Deterministic CI for mechanics + honest human check for accuracy                                   | Plan   |
| Test scope        | Add Vitest; cover pure logic                                 | First test infra lands on the highest-risk module                                                  | Plan   |

## Scope

**In scope:** OpenRouter config + null-safe client factory; zod question contract + types; the generator (prompt, validate, retry, cap, typed errors, confidence); Vitest + unit tests; a dev-only verification route; a recorded accuracy spot-check.

**Out of scope:** any user-facing UI/answering/scoring/persistence/dashboard (S-01–S-04); second-pass verifier or self-consistency; streaming/batching; curated exam catalog; live-API tests in CI.

## Architecture / Approach

Bottom-up, in dependency order: (1) config + a `fetch`-based OpenRouter client that returns `null` when unconfigured; (2) zod schemas/types + the `generateQuestions` generator built on the client; (3) Vitest + mocked-provider unit tests of the generator's logic; (4) a gated dev route that calls the real API for the manual accuracy spot-check. The engine stays a pure module so S-01 imports it without touching the route.

## Phases at a Glance

| Phase                                   | What it delivers                                                                  | Key risk                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. Provider config & client factory     | `OPENROUTER_API_KEY` secret + null-safe OpenRouter client + config-status entry   | Mismatched env wiring; build must still pass without the key       |
| 2. Generation engine                    | zod contract + types + `generateQuestions` (retry, cap, typed result, confidence) | Getting reliable JSON from the model; clean error contract         |
| 3. Test infra + unit tests              | Vitest wired + coverage of validation/cap/retry/errors                            | First runner setup; alias resolution in tests                      |
| 4. Internal route + accuracy spot-check | Dev-only route + recorded manual accuracy review                                  | The real risk: are generated answers actually correct within <10s? |

**Prerequisites:** none in-repo (auth/deploy present); a real `OPENROUTER_API_KEY` is needed for Phase 4's manual check.
**Estimated effort:** ~2–3 focused sessions across the four phases.

## Open Risks & Assumptions

- Generation accuracy is human-verified, not gated in CI — the spot-check verdict (Phase 4) is the gate that retires F-01's risk.
- Assumes a fast OpenRouter model holds the full set under ~10s at count ≤ 20; if marginal, the levers are a faster model or (deferred) streaming.
- Assumes the model knows the requested exam's domains; obscure exams degrade and should surface `confidence: "low"`.
- Edge runtime limits long-running CPU — generation is a single awaited I/O call by design.

## Success Criteria (Summary)

- `generateQuestions` returns validated, schema-conforming questions (or a typed error) and never throws; cap/retry/error branches covered by passing unit tests.
- A real-API run for a known exam returns valid questions within ~10s, and a manual spot-check confirms the marked-correct answers are correct (recorded with a verdict).
- The dev verification route is unreachable in production.
