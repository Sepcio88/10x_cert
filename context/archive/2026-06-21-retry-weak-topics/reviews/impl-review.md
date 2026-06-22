<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Retry Fresh Questions on Weak Topics (S-05)

- **Plan**: context/changes/retry-weak-topics/plan.md
- **Scope**: All 3 phases
- **Date**: 2026-06-22
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — Weakness threshold compares a rounded percentage

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Correctness)
- **Location**: src/lib/practice/progress.ts:70-71
- **Detail**: `weakTopics` decides weakness on `Math.round((correct/total)*100) < 70`. A topic at 69.5% rounds to 70 → not weak; 69.4% → weak. Rounding before the threshold compare introduces a boundary artifact vs. the raw ratio.
- **Fix**: Compare the raw ratio — `correct / total < threshold / 100` — instead of rounding first (display can still round).
- **Decision**: FIXED — compare raw ratio (correct/total < threshold/100), no round-before-compare

### F2 — Topics transported as a comma-joined query param

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/components/dashboard/ProgressDashboard.tsx:55-57 ; src/components/practice/PracticeGenerator.tsx:166
- **Detail**: Topics are `encodeURIComponent`'d then split on literal "," on read. A topic name containing a comma would be mis-split. Low risk (LLM domain tags); encoded, so not query-injection — just fragile transport.
- **Fix**: If desired, use repeated `topics=` params (getAll) or a JSON value. Otherwise fine for current data.
- **Decision**: SKIPPED — low risk for LLM domain tags; comma-split kept

### F3 — Endpoint test mock type omits `topics`

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/practice/generate.test.ts:5
- **Detail**: The hoisted mock's type is `(input: {exam, count})`, but a test asserts the call carries `topics`. Tests pass (vi.fn ignores declared shape) — cosmetic looseness.
- **Fix**: Add `topics?: string[]` to the mock's input type.
- **Decision**: FIXED — added topics?: string[] to the generateMock input type

### F4 — Mount-effect eslint block-disable (justified)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/components/practice/PracticeGenerator.tsx:158-174
- **Detail**: Disables `react-hooks/set-state-in-effect` + `exhaustive-deps` for the one-shot post-hydration URL read. Justification sound — Astro islands can't read the query string at SSR, and params arrive via client nav to a separate `/practice` page, so SSR prop-init isn't straightforward.
- **Fix**: None needed — recorded for traceability.
- **Decision**: ACKNOWLEDGED — justified block-disable; no action
