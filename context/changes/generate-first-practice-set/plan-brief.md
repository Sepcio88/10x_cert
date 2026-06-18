# Generate a Practice Set for a Chosen Exam (S-01) — Plan Brief

> Full plan: `context/changes/generate-first-practice-set/plan.md`

## What & Why

The north star slice: let a signed-in developer pick a cloud provider, type an exam code/name, choose a count, and see a freshly generated question set. It's the first user-facing surface for the F-01 engine and proves the core product hypothesis — fresh, exam-relevant generation — through the real UI, not just a dev route.

## Starting Point

The F-01 question-generation engine is built and archived: `generateQuestions({ exam, count })` returns a typed `GenerationResult`, is server-only (imports `astro:env/server`), and self-bounds at a 9s timeout. The app has Supabase auth with a `PROTECTED_ROUTES` middleware, a React-island + API-route UI pattern, reusable form primitives, and Vitest wired.

## Desired End State

A `/practice` page (sign-in required) shows a form (provider dropdown, exam text, count 1–20). Submitting calls a new auth-gated API route with a live loading state; results render as a vertical list of question cards (stem + 4 options + topic, no answers) below the form, with a low-confidence warning banner when applicable and friendly per-error-code messages + Retry on failure.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Client→engine call | Dedicated API route + client `fetch` | Matches the starter pattern; the fetch gives a loading state for the <10s guardrail | Plan |
| What S-01 shows | Questions only (stem + 4 options + topic), no answers | Keeps the slice vertical-thin; answering/feedback is S-02 | Plan |
| Auth | Gate `/practice` + protect the API route | Satisfies FR-001; keeps the paid call behind sign-in | Plan |
| Provider input | Fixed dropdown AWS/Azure/GCP | Matches the PRD's named scope; no typos | Plan |
| Exam input | Free-text code/name | Matches FR-003; no catalog (engine grounds on the string) | Plan |
| Count input | Number field 1–20, default 10 | Mirrors the engine cap; avoids guaranteed invalid-count | Plan |
| Loading UX | Disabled form + spinner + status message | Satisfies the never-blank-screen guardrail, minimal work | Plan |
| Errors | Friendly per-code message + Retry | Turns the typed error contract into good UX | Plan |
| Low confidence | Show questions + warning banner | Honest about accuracy without blocking a useful set | Plan |
| Results layout | Vertical list of cards | Simple, scannable, matches existing card styling | Plan |
| Post-generate flow | Form stays; results below | Easy regenerate loop for the validation use case | Plan |
| Testing | API-route unit tests (engine mocked) + manual UI | Deterministic coverage of new server logic on existing Vitest | Plan |

## Scope

**In scope:** auth-gated `POST /api/practice/generate`; `/practice` route protection; a React island (form + loading + results + errors + confidence banner); question cards; a nav link; API unit tests.

**Out of scope:** answering / feedback / revealing answers (S-02); persistence / history / score / breakdown (S-02–S-04); exam catalog/autocomplete; streaming; new providers; component-test infra.

## Architecture / Approach

Bottom-up: (1) the server API route wraps the engine — auth-gated, zod-validated, composes the `"<provider> <exam>"` identifier, returns `GenerationResult` JSON — plus middleware protection and unit tests; (2) a React island drives the form, the loading state, results rendering, and per-code error/confidence UX, talking only to the API route; (3) the `.astro` page mounts the island and a nav link reaches it. The engine is untouched.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. API route + protection | Auth-gated, validated `POST /api/practice/generate` + middleware + unit tests | Composing the exam identifier; auth-gate correctness |
| 2. React island | Form + loading + question cards + error/confidence UX | Keeping the engine out of the client; loading-state correctness |
| 3. Page + navigation | `/practice` page mounting the island + nav link; e2e verify | End-to-end wiring; real-API latency within ~10s |

**Prerequisites:** F-01 engine (done); a real `OPENROUTER_API_KEY` and Supabase configured (both in `.dev.vars`) for the manual e2e check.
**Estimated effort:** ~1–2 focused sessions across three phases.

## Open Risks & Assumptions

- Assumes the engine's `"<provider> <exam>"` composed string grounds generation well; if provider+name confuses the model, the exam-input format may need tuning.
- Real-API latency must stay within ~10s at count ≤ 20 for the manual check (already bounded by the engine's 9s timeout).
- Requires Supabase configured to exercise the gated page (it is, locally).

## Success Criteria (Summary)

- Signed in, generating for a known exam shows the right number of question cards within ~10s with a visible loading state.
- The page is unreachable signed out (redirects to sign-in); the API returns 401 unauthenticated.
- Low-confidence results warn but still render; errors show a friendly message + Retry, never a blank screen.
