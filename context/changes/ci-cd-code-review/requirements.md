## Overall concept

- GHA workflow, runs on every pull request to `main` (this repo's CI branch — see `.github/workflows/ci.yml`, not `master`)
- Use `anthropics/claude-code-action@v1` (the ready-made agent) rather than a hand-rolled Vercel AI SDK agent — this repo already runs entirely on Claude Code + the 10x-toolkit, so the review agent should inherit the same conventions (`AGENTS.md`, `.claude/rules/e2e.md`) the same way an interactive session would, without us re-implementing a diff-fetch/JSON-schema/PR-comment loop by hand
- Independent job — does not gate merge for the MVP (informational review, not a blocking status check); a future iteration can add a hard gate once the criteria have been evaluated over a few real PRs

## Input parameters

- pull request title + body (from `github.event.pull_request.*`)
- full `git diff` against the PR's base branch
- this repo's own conventions, read directly from the checked-out repo: `AGENTS.md`, `.claude/rules/e2e.md`, `context/foundation/lessons.md` — Claude Code Action can read these itself once given repo access, no separate plumbing needed

## Code Review Criteria

Each criterion is scored on a 1-10 scale, where 1 is the worst outcome and 10 is the best. Derived from this repo's own `AGENTS.md` hard rules, `.claude/rules/e2e.md`, and the trust-boundary gap found during the M4 DDD pass (`context/domain/02-invariant-aggregate-refactor.md`) — not generic best-practice boilerplate.

1. **Trust-boundary correctness** — every external input is zod-validated at the API boundary, and any authoritative/computed value (score, ownership, correctness) is derived from data the server itself controls, never re-trusted from a client-echoed payload. 1 = accepts unvalidated or client-echoed authoritative data; 10 = every boundary validated, no re-trust.
2. **Convention adherence** — follows `AGENTS.md` hard rules: `export const prerender = false` on API routes, RLS + granular per-operation policies on new Supabase tables, `cn()` for Tailwind merges, React only for interactive UI (Astro for static), no client-exposed secrets, Conventional Commits. 1 = violates multiple hard rules; 10 = fully conformant.
3. **Test coverage** — new/changed logic has Vitest unit coverage; user-facing flows get Playwright E2E coverage using role/label/text locators only (no CSS/XPath, no `waitForTimeout`, business-outcome assertions) per `.claude/rules/e2e.md`. 1 = no tests for new logic; 10 = thorough coverage including edge/failure cases, matching existing test-file conventions.
4. **Type safety** — no new `as unknown as`/`as any` escapes without an inline justification; prefers a zod schema + `z.infer` over a hand-written interface for any externally-sourced or persisted shape. 1 = new unjustified unchecked casts; 10 = fully type-safe.
5. **Scope & readability** — the diff matches its stated PR intent, is proportional to the problem, doesn't bundle unrelated changes, and is understandable without the author present. 1 = scope creep / unreadable / mixed concerns; 10 = tight, single-purpose, self-explanatory.

## Parked for later

- business alignment (requires broader context than a diff)
- architectural fit against `context/foundation/prd.md`/`roadmap.md` (requires broader context)
- hard merge gate on the score (start informational; revisit once criteria are validated on real PRs)

## Expected side-effects

- PR comment with a per-criterion score + overall summary
- labels: `ai-cr:passed` (green) or `ai-cr:failed` (red) — threshold: fail if any criterion scores ≤3, or overall average <6

## Expected behavior

- runs automatically on `pull_request: [opened, synchronize]`
- also runnable on demand via `workflow_dispatch` for manual testing without opening a new PR
