# Question-Generation Engine (F-01) Implementation Plan

## Overview

Build the server-side question-generation engine for CloudExamMatter: a module that, given an exam identifier (code or name) and a question count, returns validated, exam-representative multiple-choice questions — each with a correct answer, an explanation, and a topic/domain tag — by calling an LLM through OpenRouter. This is the foundation (roadmap F-01) that unlocks the north star S-01 and the retry slice S-05. It is not user-visible; S-01 wraps it in the exam-selection UI later.

## Current State Analysis

The repo is a freshly bootstrapped 10x Astro Starter (Astro 6 SSR, React 19, Tailwind 4, Supabase auth, Cloudflare Workers deploy). Relevant existing conventions:

- **Server secrets** are declared in `astro.config.mjs` under `env.schema` via `envField.string({ context: "server", access: "secret", optional: true })` ([astro.config.mjs:17-22](../../../astro.config.mjs#L17-L22)). They are read with `import { X } from "astro:env/server"`.
- **Service-factory pattern**: `src/lib/supabase.ts` exposes `createClient(...)` that returns `null` when its secrets are absent, rather than throwing ([src/lib/supabase.ts:5-8](../../../src/lib/supabase.ts#L5-L8)).
- **Config-status surfacing**: `src/lib/config-status.ts` lists each integration's configured/unconfigured state for the UI ([src/lib/config-status.ts](../../../src/lib/config-status.ts)).
- **API routes** export typed handlers (`export const POST: APIRoute = async (context) => {...}`) and use `context.request`/`context.cookies` ([src/pages/api/auth/signin.ts](../../../src/pages/api/auth/signin.ts)). API routes in an SSR app must export `const prerender = false`.
- **Conventions** (AGENTS.md): validate input with zod; services in `src/lib/` (or `src/lib/services/`); shared types in `src/types.ts`; path alias `@/*` → `./src/*`.
- **No test runner is wired** (no vitest/jest config in `package.json`).
- **Constraint**: the app runs on Cloudflare Workers; long-running CPU is limited, so generation must complete within the request lifecycle. An awaited `fetch` to the LLM is I/O and is allowed; total wall-clock must stay within the <10s target.

## Desired End State

A `generateQuestions({ exam, count })` call exists in `src/lib/services/`, configured via an `OPENROUTER_API_KEY` server secret, that:

- returns a typed result — either `{ ok: true, questions, confidence }` or `{ ok: false, error }` — never throws to the caller;
- validates every question against a zod schema (the contract S-01/S-02/S-04 depend on);
- enforces a hard count cap of 20;
- retries once on JSON-parse/schema-validation failure, then fails cleanly;
- flags low confidence for exams the model doesn't recognize;
- is covered by mocked-provider unit tests (validation, cap, retry, error mapping);
- is exercisable end-to-end against the real API via a dev-only internal route, with a documented manual accuracy spot-check.

**Verification**: `npm run lint` and `npm run build` pass; `npm run test` passes the new unit suite; hitting the internal route with a configured key returns a valid, schema-conforming set for a real exam (e.g. "AWS SAA-C03") within ~10s, and a manual spot-check confirms the marked-correct answers are actually correct.

### Key Discoveries:

- Mirror `supabase.ts`'s null-when-unconfigured factory for the OpenRouter client ([src/lib/supabase.ts:5-8](../../../src/lib/supabase.ts#L5-L8)).
- Add the new secret beside the existing ones in `astro.config.mjs` ([astro.config.mjs:17-22](../../../astro.config.mjs#L17-L22)) and extend `config-status.ts` so the UI can later show "AI generation not configured".
- OpenRouter is a plain HTTPS JSON API — call it with `fetch`, which is Workers-compatible (no SDK edge-compat risk).
- Accuracy cannot be asserted in CI; it is human-verified via the internal route. The automated suite covers only the deterministic, provider-independent logic.

## What We're NOT Doing

- No user-facing exam-selection UI, answering flow, scoring, persistence, or dashboard — those are S-01 through S-04.
- No second-pass LLM verifier or self-consistency voting (latency/cost; deferred to a possible later hardening slice).
- No streaming or batched generation (single synchronous call for the MVP; streaming deferred).
- No curated exam catalog or seed domain map — exams are an open set grounded by the model's own knowledge.
- No live-API tests in CI (flaky, costly, needs secrets); real-API checks are manual.
- No retry/backoff beyond a single re-attempt on malformed output.

## Implementation Approach

Build bottom-up in dependency order: configuration and a null-safe provider client first, then the zod contract and the generator logic on top of it, then the test runner and unit coverage of that logic, and finally a throwaway-ish internal route to exercise the real API and spot-check accuracy. Each layer is independently verifiable; the engine stays a pure module that S-01 can later import without touching the route.

## Critical Implementation Details

- **Timing & lifecycle**: the whole set is generated in one awaited `fetch` inside the request; keep the model fast and the count capped (20) so total latency stays under the ~10s budget on Workers. A second LLM round-trip (verifier) would risk the budget and is deliberately excluded.
- **Debug & observability**: accuracy is not machine-checkable. The internal verification route is the designated manual-review surface — it must return the full structured set (including the marked-correct answer and explanation) so a human can spot-check correctness against their own exam knowledge.

## Phase 1: Provider config & client factory

### Overview

Declare the OpenRouter secret and build a null-when-unconfigured client factory, mirroring the existing Supabase pattern, plus a config-status entry.

### Changes Required:

#### 1. Environment schema

**File**: `astro.config.mjs`

**Intent**: Register `OPENROUTER_API_KEY` as a server-only, secret, optional env var so the engine can read it via `astro:env/server` and the app still builds without it.

**Contract**: Add one entry to `env.schema` alongside the Supabase keys, using `envField.string({ context: "server", access: "secret", optional: true })`.

#### 2. OpenRouter client factory

**File**: `src/lib/services/openrouter.ts` (new)

**Intent**: Provide a single place that knows how to reach OpenRouter; return `null` when the key is absent so callers degrade gracefully instead of throwing.

**Contract**: Export a factory (e.g. `createOpenRouterClient()`) that reads `OPENROUTER_API_KEY` from `astro:env/server`, returns `null` if missing, otherwise returns a thin object exposing a chat/completion call over `fetch` (model + messages in, raw text out). Mirrors the null-guard shape of `src/lib/supabase.ts`.

#### 3. Config-status entry

**File**: `src/lib/config-status.ts`

**Intent**: Surface AI-generation configured/unconfigured state so the UI (later) can warn when generation is unavailable.

**Contract**: Append a `ConfigStatus` entry for the generation provider, `configured` based on the presence of the key.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Production build succeeds without the key set: `npm run build`

#### Manual Verification:

- With no key set, the app still builds and runs; config-status reports AI generation as not configured.

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 2.

---

## Phase 2: Generation engine (schemas, types, generator)

### Overview

Define the question contract as zod schemas + TypeScript types, then implement the generator: build the prompt from the exam identifier and count, call OpenRouter once at low temperature, parse and validate the JSON, retry once on failure, enforce the count cap, and return a typed result with a confidence signal.

### Changes Required:

#### 1. Question contract (schema + types)

**File**: `src/lib/services/question-schema.ts` (new) and `src/types.ts`

**Intent**: Define the validated shape every generated question must satisfy — the contract S-01, S-02, and S-04 consume.

**Contract**: A zod schema for a question with: `id` (string), `stem` (string), `options` (array of exactly 4 `{ id, text }`), `correctOptionId` (must match one option id), `explanation` (string), `topic` (string). Export the inferred TS types from `src/types.ts`. Include a schema for the full generation response (array of questions + a `confidence` enum/flag).

#### 2. Generator

**File**: `src/lib/services/question-generator.ts` (new)

**Intent**: The engine entry point. Turn `{ exam, count }` into validated questions or a typed error, honoring cap, retry, latency, and accuracy guardrails.

**Contract**: Export `generateQuestions(input: { exam: string; count: number }): Promise<GenerationResult>` where `GenerationResult` is a discriminated union `{ ok: true; questions: Question[]; confidence: "high" | "low" } | { ok: false; error: GenerationError }`. Behavior: reject `count` outside 1–20 with a typed error before any call; if the client factory returns `null`, return a `not-configured` error; build a prompt instructing exam-representative questions grounded in the named exam's domains, explanation-first rationale, per-question topic tag, and a self-reported confidence for unknown exams; call at low temperature; parse JSON and validate with the Phase-2 schema; on parse/validation failure retry exactly once, then return a typed `invalid-output` error; map provider/network failures to a typed `provider-error`. Never throw to the caller.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Code review confirms the result type is a discriminated union and no path throws to the caller.
- Count-cap, not-configured, and error branches are reachable by inspection.

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 3.

---

## Phase 3: Test infrastructure + unit tests

### Overview

Wire Vitest (the repo's first test runner) and cover the generator's deterministic, provider-independent logic against a mocked OpenRouter client.

### Changes Required:

#### 1. Test runner

**File**: `package.json`, `vitest.config.ts` (new)

**Intent**: Establish automated testing on the highest-risk module; add a `test` script.

**Contract**: Add Vitest as a dev dependency, a `vitest.config.ts`, and a `"test": "vitest run"` script (plus a watch variant if desired). Configure path alias `@/*` resolution to match `tsconfig`.

#### 2. Generator unit tests

**File**: `src/lib/services/question-generator.test.ts` (new)

**Intent**: Lock the engine's contract and guardrails so S-01 can depend on them.

**Contract**: With the OpenRouter client mocked, cover: valid output → `ok: true` with schema-conforming questions; count > 20 and count < 1 → `count` error with no provider call; missing key (factory returns null) → `not-configured`; malformed JSON on first call then valid on retry → `ok: true` (retry works); malformed/invalid twice → `invalid-output`; provider/network throw → `provider-error`; low model confidence → `confidence: "low"`.

### Success Criteria:

#### Automated Verification:

- Test suite passes: `npm run test`
- Type checking passes: `npm run lint`
- CI lint+build still pass: `npm run build`

#### Manual Verification:

- Review confirms tests assert behavior (result shape, guardrails), not implementation details, per `.claude/rules/e2e.md` spirit.

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 4.

---

## Phase 4: Internal verification route + accuracy spot-check

### Overview

Add a dev-only API route to exercise the engine against the real OpenRouter API, and perform a documented manual accuracy spot-check — the only way to validate the generation-quality risk F-01 exists to retire.

### Changes Required:

#### 1. Internal generation route

**File**: `src/pages/api/dev/generate.ts` (new)

**Intent**: Provide a minimal surface to call the real engine and inspect the full structured output (including correct answers + explanations) for manual review. Not part of the user-facing product.

**Contract**: An `APIRoute` with `export const prerender = false` that reads `exam` and `count` from the query/body, calls `generateQuestions`, and returns the typed result as JSON. Gate it to non-production (e.g. refuse when running in production / behind an explicit dev flag) so it never ships as a public endpoint.

#### 2. Spot-check documentation

**File**: `context/changes/question-generation-engine/accuracy-spot-check.md` (new)

**Intent**: Record the manual accuracy review so the foundation's risk-retirement is auditable.

**Contract**: A short checklist: exam(s) tested, count, observed latency, and a per-question correct/incorrect judgment for a sampled set, plus a pass/fail verdict against the accuracy guardrail.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Production build succeeds: `npm run build`
- Existing unit suite still passes: `npm run test`

#### Manual Verification:

- With a real `OPENROUTER_API_KEY` set, hitting the dev route for "AWS SAA-C03" with count 10 returns 10 schema-valid questions within ~10s.
- An out-of-range count and a missing-key scenario return the expected typed errors.
- Manual accuracy spot-check: the marked-correct answers are actually correct for a sampled subset; results recorded in `accuracy-spot-check.md` with a pass/fail verdict.
- The dev route is confirmed unreachable in a production build.

**Implementation Note**: This is the final phase. The accuracy spot-check verdict is the human gate that retires F-01's generation-feasibility risk before S-01 is planned.

---

## Testing Strategy

### Unit Tests:

- Generator result shape (ok/error discriminated union) across all branches.
- Count cap (reject <1 and >20 before any provider call).
- Retry-once-then-fail on malformed/invalid output.
- Error mapping: not-configured, invalid-output, provider-error.
- Confidence flag propagation.

### Integration Tests:

- None automated (live-API tests excluded by decision). The internal dev route serves as the manual integration surface.

### Manual Testing Steps:

1. Set a real `OPENROUTER_API_KEY`; run the dev route for a well-known exam (e.g. "AWS SAA-C03") with count 10; confirm 10 valid questions within ~10s.
2. Spot-check the marked-correct answers for correctness; record in `accuracy-spot-check.md`.
3. Try count 25 → expect a typed count error; unset the key → expect not-configured.
4. Try an obscure/unknown exam string → expect `confidence: "low"`.
5. Confirm the dev route is gated out of production.

## Performance Considerations

Single synchronous LLM call per generation; latency is dominated by the model. Keep the model fast and the count capped at 20 to hold the <10s target on Cloudflare Workers. No caching in the MVP. If latency proves marginal, a faster model or streaming (deferred) are the levers.

## Migration Notes

No data migrations. Adds one optional env secret (`OPENROUTER_API_KEY`); the app builds and runs without it (generation simply reports not-configured).

## References

- Roadmap: `context/foundation/roadmap.md` (F-01)
- PRD: `context/foundation/prd.md` (FR-005, NFR generation <10s, accuracy guardrail)
- Tech stack: `context/foundation/tech-stack.md`
- Secret pattern: `astro.config.mjs:17-22`
- Service-factory pattern: `src/lib/supabase.ts:5-8`
- Config-status pattern: `src/lib/config-status.ts`
- API route pattern: `src/pages/api/auth/signin.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Provider config & client factory

#### Automated

- [x] 1.1 Type checking passes: `npm run lint` — a4ca4cc
- [x] 1.2 Production build succeeds without the key set: `npm run build` — a4ca4cc

#### Manual

- [x] 1.3 App builds/runs with no key; config-status reports AI generation not configured

### Phase 2: Generation engine (schemas, types, generator)

#### Automated

- [x] 2.1 Type checking passes: `npm run lint` — a4ca4cc
- [x] 2.2 Production build succeeds: `npm run build` — a4ca4cc

#### Manual

- [x] 2.3 Code review confirms discriminated-union result; no path throws to the caller
- [x] 2.4 Count-cap, not-configured, and error branches reachable by inspection

### Phase 3: Test infrastructure + unit tests

#### Automated

- [x] 3.1 Test suite passes: `npm run test` — a4ca4cc
- [x] 3.2 Type checking passes: `npm run lint` — a4ca4cc
- [x] 3.3 CI lint+build still pass: `npm run build` — a4ca4cc

#### Manual

- [x] 3.4 Review confirms tests assert behavior, not implementation details

### Phase 4: Internal verification route + accuracy spot-check

#### Automated

- [x] 4.1 Type checking passes: `npm run lint` — a4ca4cc
- [x] 4.2 Production build succeeds: `npm run build` — a4ca4cc
- [x] 4.3 Existing unit suite still passes: `npm run test` — a4ca4cc

#### Manual

- [x] 4.4 Dev route returns 10 schema-valid questions for "AWS SAA-C03" (count 10) within ~10s
- [x] 4.5 Out-of-range count and missing-key return the expected typed errors
- [x] 4.6 Accuracy spot-check recorded with a pass/fail verdict in `accuracy-spot-check.md`
- [x] 4.7 Dev route confirmed unreachable in a production build
