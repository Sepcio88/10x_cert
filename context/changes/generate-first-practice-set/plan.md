# Generate a Practice Set for a Chosen Exam (S-01) Implementation Plan

## Overview

Deliver the north star slice: a signed-in developer selects a cloud provider (AWS / Azure / GCP), types an exam code or name, chooses a question count (1–20), and gets a freshly generated question set rendered as cards (stem + 4 options + topic tag). This is the first user-facing surface for the F-01 question-generation engine — it proves the core product hypothesis (fresh, exam-relevant generation) through the real UI. Answering, explanation-first feedback, and scoring are **S-02**; persistence is **S-03** — out of scope here.

## Current State Analysis

The F-01 engine is built, reviewed, and archived. Relevant existing surface:

- **Engine contract** ([src/types.ts:10-27](../../../src/types.ts#L10-L27)): `generateQuestions({ exam, count }): Promise<GenerationResult>`, where `GenerationResult` is `{ ok: true; questions: Question[]; confidence: "high"|"low" } | { ok: false; error: { code: GenerationErrorCode; message } }`. `GenerationErrorCode` = `invalid-count | not-configured | invalid-output | provider-error`. A `Question` has `id, stem, options[4]{id,text}, correctOptionId, explanation, topic`. The engine is **server-only** (imports `astro:env/server`) and self-bounds at a 9s timeout.
- **Auth gating** ([src/middleware.ts:4,18-22](../../../src/middleware.ts#L4)): paths in `PROTECTED_ROUTES` redirect to `/auth/signin` when `context.locals.user` is null; the middleware resolves the user on every request.
- **API route pattern** ([src/pages/api/auth/signin.ts](../../../src/pages/api/auth/signin.ts)): `export const POST: APIRoute`; SSR routes export `const prerender = false`.
- **React island pattern** ([src/components/auth/SignInForm.tsx](../../../src/components/auth/SignInForm.tsx)): default-export component mounted in an `.astro` page; reusable primitives `FormField`, `SubmitButton` (has `pendingText`), `ServerError`.
- **Page pattern** ([src/pages/dashboard.astro](../../../src/pages/dashboard.astro)): `.astro` page using `Layout`, reads `Astro.locals.user`.
- **Test infra**: Vitest is wired (from F-01); the existing mock-the-module pattern is in `src/lib/services/question-generator.test.ts`.

## Desired End State

A `/practice` page, reachable only when signed in, renders a form (provider dropdown, exam text field, count number field). Submitting calls `POST /api/practice/generate`; while it runs the form is disabled and a spinner + status message shows. On success the page renders a vertical list of question cards (stem + 4 options + topic) below the form, with the form still present for a quick regenerate; a low-confidence result shows a warning banner above the cards. On error, a friendly per-code message + Retry shows. The API route is auth-gated and zod-validated, and is covered by unit tests with the engine mocked.

**Verification**: `npm run lint`, `npm run test`, `npm run build` pass; signed in, generating for "AWS SAA-C03" × 10 shows 10 question cards within ~10s with a live loading state; an unauthenticated request to the page redirects to sign-in and to the API returns 401; an obscure exam shows the low-confidence banner; the count field is bounded 1–20.

### Key Discoveries:

- The engine takes a single `exam` string; the UI collects provider + exam separately, so the route **composes** the identifier (e.g. `"<provider> <exam>"`) before calling the engine.
- The island cannot import the engine (server-only) — it must go through the API route via `fetch`. This is also what gives the loading state for the `<10s` "never a blank screen" guardrail.
- Count must be client-bounded to 1–20 to mirror the engine cap and avoid a guaranteed `invalid-count`.

## What We're NOT Doing

- No answering, no immediate feedback, no revealing correct answers/explanations (FR-006/FR-007 → S-02).
- No session persistence, history, score, or per-topic breakdown (FR-008/009/010 → S-02/S-03/S-04).
- No exam catalog / autocomplete (generation-first, no-catalog stance).
- No streaming or per-question progressive render (deferred; single awaited call).
- No new provider beyond AWS/Azure/GCP.
- No React component-test infra (jsdom/RTL) — API-route unit tests + manual UI only.

## Implementation Approach

Bottom-up: first the auth-gated, validated API route that wraps the engine and its unit tests; then the React island that drives the form, loading, results, and error/confidence states; then the page that mounts the island and the nav link to reach it. The engine stays untouched — S-01 only consumes it.

## Critical Implementation Details

- **Server/client boundary**: the engine import (`astro:env/server`) must never reach a client island. Only the API route (server) imports `generateQuestions`; the island talks to the route over `fetch`.
- **User experience spec**: the responsiveness guardrail requires continuous feedback during the up-to-9s call — the form disables and shows a spinner + status text on submit, and re-enables on result or error. No blank screen at any point.

## Phase 1: Generation API route + route protection

### Overview

Add the auth-gated, validated server endpoint that wraps the engine, protect the `/practice` route, and cover the route logic with unit tests.

### Changes Required:

#### 1. Generation API route

**File**: `src/pages/api/practice/generate.ts` (new)

**Intent**: Expose the server-only engine to the browser behind auth + validation; compose the exam identifier from provider + exam and pass through the engine's typed result.

**Contract**: `export const prerender = false; export const POST: APIRoute`. Reject when `context.locals.user` is null with HTTP 401 and a typed error body. Parse the JSON body and validate with a zod schema: `provider` ∈ {AWS, Azure, GCP}, `exam` non-empty string, `count` integer 1–20; on failure return 400 with an `invalid-count`/validation error body. Compose `exam` for the engine as `"<provider> <exam>"`, call `generateQuestions`, and return the `GenerationResult` as JSON (200 on `ok`, 400 on engine error — mirror the dev route's shape). Never throw.

#### 2. Protect the practice route

**File**: `src/middleware.ts`

**Intent**: Require sign-in for the practice page (FR-001).

**Contract**: Add `"/practice"` to the `PROTECTED_ROUTES` array.

#### 3. API route unit tests

**File**: `src/pages/api/practice/generate.test.ts` (new)

**Intent**: Lock the route's auth gate, validation, and pass-through behavior.

**Contract**: With `generateQuestions` mocked (module mock, mirroring `question-generator.test.ts`), cover: unauthenticated → 401 and engine not called; invalid body (bad provider / empty exam / count 0 or 21) → 400 and engine not called; valid request → engine called with the composed `"<provider> <exam>"` string and count, and the `GenerationResult` returned as JSON; an engine `ok:false` result → surfaced as the error body.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Unit tests pass: `npm run test`
- Production build succeeds: `npm run build`

#### Manual Verification:

- An unauthenticated request to `/api/practice/generate` returns 401.

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 2.

---

## Phase 2: Practice React island

### Overview

Build the client island that drives the form, the loading state, results rendering, and error/confidence handling.

### Changes Required:

#### 1. Question card

**File**: `src/components/practice/QuestionCard.tsx` (new)

**Intent**: Render one generated question read-only — stem, its 4 options, and the topic tag — with no answer revealed.

**Contract**: Props are a single `Question` (from `@/types`). Renders stem, the 4 options as a plain list, and the topic. No selection/answer affordance (that's S-02).

#### 2. Practice form + results island

**File**: `src/components/practice/PracticeGenerator.tsx` (new)

**Intent**: The interactive surface — collect input, call the API with a loading state, render results or a typed error.

**Contract**: Default-export React component. State: `provider` (default AWS), `exam` (text), `count` (number, default 10, bounded 1–20), plus `status` (`idle | loading | done | error`), `result`, `errorMessage`. On submit: disable the form, show a spinner + "Generating your questions…", `fetch('/api/practice/generate', { method: 'POST', body: JSON })`, then render. Success → list of `QuestionCard`s below the form (form stays for regenerate); `confidence === "low"` → a warning banner above the cards. Error (non-2xx or `ok:false`) → a friendly message mapped per `GenerationErrorCode` (e.g. `not-configured` → "AI generation isn't set up yet"; `provider-error` → "Generation timed out or failed — try again"; `invalid-count`/validation → "Pick between 1 and 20 questions") plus a Retry action. Reuse `SubmitButton` (`pendingText`) and `ServerError` where they fit.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Production build succeeds: `npm run build`
- Existing unit suite still passes: `npm run test`

#### Manual Verification:

- The form renders with a provider dropdown, exam field, and a 1–20 count field defaulting to 10.
- Code review confirms the island never imports the engine and only calls the API route.

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 3.

---

## Phase 3: Practice page + navigation

### Overview

Add the gated page that mounts the island and a way to navigate to it, then verify the whole flow end to end.

### Changes Required:

#### 1. Practice page

**File**: `src/pages/practice.astro` (new)

**Intent**: Host the practice experience for signed-in users.

**Contract**: `.astro` page using `Layout`; mounts `PracticeGenerator` as a client island (`client:load`). Route protection comes from Phase 1's middleware entry; the page may also read `Astro.locals.user` for a greeting like dashboard.astro.

#### 2. Navigation link

**File**: `src/components/Topbar.astro` (or the existing nav surface)

**Intent**: Give signed-in users a way to reach `/practice`.

**Contract**: Add a link to `/practice` in the existing top navigation, following the current link markup. If no suitable authenticated nav exists, add the link on the dashboard page instead.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Production build succeeds: `npm run build`
- Unit suite still passes: `npm run test`

#### Manual Verification:

- Signed in, navigating to `/practice` shows the form; generating "AWS SAA-C03" × 10 displays 10 question cards within ~10s, with a visible loading state throughout.
- Signed out, visiting `/practice` redirects to `/auth/signin`.
- An obscure/unknown exam string shows the low-confidence warning banner above the cards.
- Submitting with the count at its bounds (1 and 20) works; the field prevents 0 or 21.
- An error path (e.g. unset `OPENROUTER_API_KEY`) shows the friendly per-code message + Retry, never a blank screen.

**Implementation Note**: This is the final phase. The end-to-end manual check is the proof that the north star slice works for a real user.

---

## Testing Strategy

### Unit Tests:

- API route: auth gate (401), input validation (400 on bad provider / empty exam / out-of-range count), happy path (engine called with composed exam + count, result returned), engine-error pass-through. Engine mocked.

### Integration Tests:

- None automated. The end-to-end UI check is manual (Phase 3).

### Manual Testing Steps:

1. Sign in; go to `/practice`; generate "AWS SAA-C03" × 10 → 10 cards within ~10s, loading state visible.
2. Sign out; visit `/practice` → redirected to `/auth/signin`.
3. Generate for an obscure exam → low-confidence banner shows.
4. Try count 0 and 21 → blocked client-side; 1 and 20 → allowed.
5. Unset `OPENROUTER_API_KEY`, restart, generate → friendly "not set up" error + Retry, no blank screen.

## Performance Considerations

One awaited engine call per generate; the engine self-bounds at 9s. The island's loading state covers the wait. No caching in this slice. Rendering 20 cards is trivial.

## Migration Notes

No data migrations. No new dependencies expected (zod already present from F-01; uses existing React/Astro stack).

## References

- Roadmap: `context/foundation/roadmap.md` (S-01, north star)
- PRD: `context/foundation/prd.md` (US-01, FR-001–005)
- F-01 engine: `src/lib/services/question-generator.ts`, contract in `src/types.ts`
- Auth gating: `src/middleware.ts:4`
- API route pattern: `src/pages/api/auth/signin.ts`
- Island pattern: `src/components/auth/SignInForm.tsx`
- Test pattern: `src/lib/services/question-generator.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Generation API route + route protection

#### Automated

- [x] 1.1 Type checking passes: `npm run lint`
- [x] 1.2 Unit tests pass: `npm run test`
- [x] 1.3 Production build succeeds: `npm run build`

#### Manual

- [x] 1.4 Unauthenticated request to `/api/practice/generate` returns 401

### Phase 2: Practice React island

#### Automated

- [ ] 2.1 Type checking passes: `npm run lint`
- [ ] 2.2 Production build succeeds: `npm run build`
- [ ] 2.3 Existing unit suite still passes: `npm run test`

#### Manual

- [ ] 2.4 Form renders provider dropdown, exam field, and a 1–20 count field defaulting to 10
- [ ] 2.5 Code review confirms the island never imports the engine, only calls the API route

### Phase 3: Practice page + navigation

#### Automated

- [ ] 3.1 Type checking passes: `npm run lint`
- [ ] 3.2 Production build succeeds: `npm run build`
- [ ] 3.3 Unit suite still passes: `npm run test`

#### Manual

- [ ] 3.4 Signed in, `/practice` generates "AWS SAA-C03" × 10 → 10 cards within ~10s, loading state visible
- [ ] 3.5 Signed out, `/practice` redirects to `/auth/signin`
- [ ] 3.6 Obscure exam shows the low-confidence warning banner
- [ ] 3.7 Count bounds enforced (1 and 20 allowed; 0 and 21 blocked)
- [ ] 3.8 Error path (e.g. unset key) shows friendly per-code message + Retry, never a blank screen
