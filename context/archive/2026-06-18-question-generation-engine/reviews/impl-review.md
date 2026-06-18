<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Question-Generation Engine (F-01)

- **Plan**: context/changes/question-generation-engine/plan.md
- **Scope**: Phases 1–4 of 4
- **Date**: 2026-06-18
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — No request timeout; the <10s NFR is unguarded

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (reliability)
- **Location**: src/lib/services/openrouter.ts:34 (the fetch)
- **Detail**: The OpenRouter fetch has no timeout/AbortController. The PRD makes "set ready within 10s" a guardrail and the plan flags the edge latency budget as the key constraint, but a slow/hung provider response blocks the Worker request with no client-side guard. The engine cannot bound its own latency.
- **Fix**: Add an AbortController with an ~8–9s timeout to the fetch in openrouter.ts and map an abort to a `provider-error` (or a new `timeout` reason) in the generator's catch.
  - Strength: Makes the <10s guardrail enforceable; failure becomes a typed error S-01 can render, not a hang.
  - Tradeoff: One more failure path; the timeout value is a guess until real latency data exists.
  - Confidence: HIGH — standard fetch-timeout pattern; the catch already maps throws to provider-error.
  - Blind spot: Haven't measured real p95 latency, so 8–9s is provisional.
- **Decision**: FIXED — added a 9s AbortController to openrouter.ts; aborts surface as a "timed out" message mapped to provider-error (contract unchanged).

### F2 — Dev route is unauthenticated; relies solely on the PROD gate

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (security/cost)
- **Location**: src/pages/api/dev/generate.ts:13
- **Detail**: The route's only protection is `import.meta.env.PROD` → 404. No auth, no rate limit — an open, paid LLM-call vector in any environment where PROD is false (preview deploys, misconfigured build). Fine for local dev, but the single gate is the whole defense.
- **Fix**: Keep the PROD gate but add a second guard — require a local dev secret/header, or assert the request is from localhost — so a non-prod-but-public deploy can't burn credits.
- **Decision**: FIXED — added a localhost-only guard alongside the PROD gate in generate.ts.

### F3 — Dev route returns an `elapsedMs` field not specified in the plan

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/api/dev/generate.ts:24
- **Detail**: Plan said the route "returns the typed result as JSON"; the implementation wraps it with `elapsedMs`. Benign and useful — it's how the spot-check measures the <10s criterion (4.4).
- **Fix**: None needed — keep it; it serves manual verification 4.4.
- **Decision**: SKIPPED — kept as-is (serves verification 4.4).

### F4 — Model id is hardcoded, not env-configurable

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/services/question-generator.ts:6
- **Detail**: `DEFAULT_MODEL = "openai/gpt-4o-mini"` is a constant. Fine now (plan said "fast model"), but tuning the model — the main accuracy/latency lever — requires a code change + redeploy rather than config.
- **Fix**: Optional — later, read the model from an optional env var with this as the default. Not needed for F-01.
- **Decision**: SKIPPED — out of F-01 scope; revisit when model tuning is needed.
