# AI code review GitHub Actions workflow — Implementation Plan

## Overview

Add `.github/workflows/review.yml`: a GitHub Actions job that runs
`anthropics/claude-code-action@v1` on every pull request to `main`, scores
the diff against this repo's 5 review criteria
(`context/changes/ci-cd-code-review/requirements.md`), posts a PR comment
with the scores, and applies `ai-cr:passed`/`ai-cr:failed`.

## Current State Analysis

No AI-review workflow exists. `.github/workflows/ci.yml` is the only
workflow (lint/test/build, E2E, deploy — `context/changes/ci-cd-code-review/research.md`).
No `ANTHROPIC_API_KEY` secret exists yet. No `ai-cr:*` labels exist yet.

## Desired End State

A PR opened or updated against `main` triggers a `review` job that: checks
out full history, ensures the two labels exist, runs Claude Code Action
with the criteria as its prompt and a narrow `gh`/inline-comment tool
allowlist, and the agent itself posts one PR comment (per-criterion scores
+ overall verdict) and applies the matching label.

Verification: open a real PR (or run `workflow_dispatch`) once
`ANTHROPIC_API_KEY` is provisioned; confirm the job appears in the PR's
checks, its logs show the review running, and the PR gets both a comment
and a label.

### Key Discoveries:

- Confirmed externally (action's own docs) and internally (M5L3 lesson):
  automatic (non-`@claude`-mention) PR review is a supported, documented
  mode of `claude-code-action@v1` — no custom SDK agent needed.
- `gh pr edit --add-label` requires the label to pre-exist — needs an
  idempotent `gh label create ... --force` step before the review step.
- The existing `e2e` job already excludes Dependabot
  (`if: github.actor != 'dependabot[bot]'`, `ci.yml:36`) because Dependabot
  PRs can't read repo secrets. The same constraint applies here
  (`ANTHROPIC_API_KEY` wouldn't be available) — this plan mirrors that
  existing precedent rather than inventing a new one.

## What We're NOT Doing

- Not gating merge on the review score — informational only for the MVP,
  per `requirements.md`'s "Parked for later."
- Not building a composite action — single-repo project, no sibling repo to
  share it with (see `research.md` Architecture Insights); a plain job
  matches this repo's existing single-file `ci.yml` style.
- Not adding `promptfoo` model-comparison evals — that's a documented
  follow-up in the M5L3 lesson (`Testowanie zmian w Agentach z promptfoo`),
  not required for the MVP loop or for the Champion certification evidence.
- Not giving the agent write access beyond PR comments/labels (no direct
  code edits, no merge rights) — matches requirements.md's narrow MVP scope
  ("diff wchodzi, werdykt i etykieta wychodzą").
- Not provisioning the `ANTHROPIC_API_KEY` secret — that's a manual,
  human-only step (Settings → Secrets and variables → Actions), called out
  explicitly in Manual Verification below.

## Implementation Approach

Single phase, additive only (one new file). Low risk: the workflow can't
run to completion without the secret, so there's no risk of an unexpected
charge before the human deliberately provisions it and opens a test PR.

## Phase 1: Add the review workflow

### Changes Required:

#### 1. New workflow file

**File**: `.github/workflows/review.yml` (new)

**Intent**: Trigger on PRs to `main` (and manually via `workflow_dispatch`
for testing without waiting on a real PR); skip Dependabot PRs (no secret
access, mirrors `ci.yml:36`); ensure the two labels exist; run the review.

**Contract**:
```yaml
name: AI Code Review

on:
  pull_request:
    branches: [main]
    types: [opened, synchronize]
  workflow_dispatch:

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    name: AI Code Review
    if: github.actor != 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Ensure review labels exist
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh label create "ai-cr:passed" --color 2ea44f --force
          gh label create "ai-cr:failed" --color d73a4a --force

      - name: Claude Code Review
        uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          claude_args: |
            --allowedTools "Bash(gh pr comment:*),Bash(gh pr edit:*),Bash(gh pr diff:*),Bash(gh pr view:*)"
          prompt: |
            REPO: ${{ github.repository }}
            PR NUMBER: ${{ github.event.pull_request.number }}

            You are reviewing this pull request for CloudExamMatter.
            Read the PR diff with `gh pr diff`. Score it 1-10 on each of
            these 5 criteria (1=worst, 10=best) — definitions below are
            this repo's own conventions, not generic advice:

            1. Trust-boundary correctness — every external input is
               zod-validated at the API boundary; authoritative/computed
               values (score, ownership, correctness) are derived
               server-side only, never re-trusted from a client-echoed
               payload.
            2. Convention adherence — AGENTS.md hard rules: API routes
               export `const prerender = false`; new Supabase tables have
               RLS with granular per-operation policies; Tailwind classes
               merge via `cn()`; React only for interactive UI (Astro for
               static); no client-exposed secrets; Conventional Commits.
            3. Test coverage — new/changed logic has Vitest unit coverage;
               user-facing flows have Playwright E2E coverage using
               role/label/text locators only (no CSS/XPath, no
               `waitForTimeout`), per .claude/rules/e2e.md.
            4. Type safety — no new `as unknown as`/`as any` without an
               inline justification; prefers a zod schema + `z.infer` over
               a hand-written interface for externally-sourced/persisted
               shapes.
            5. Scope & readability — diff matches its stated PR intent, is
               proportional, doesn't bundle unrelated changes, is
               understandable without the author present.

            Post ONE PR comment via `gh pr comment` with: a one-line
            summary, a table of the 5 scores, and 2-4 sentences of the
            most important findings (cite file:line for anything
            structural). Then apply a label via `gh pr edit --add-label`:
            `ai-cr:failed` if ANY criterion scores <=3 OR the average is
            <6, otherwise `ai-cr:passed`.
```

### Success Criteria:

#### Automated Verification:

- [ ] Workflow YAML is valid: `npx actionlint .github/workflows/review.yml` (or GitHub's own syntax check on push, if `actionlint` isn't available locally)
- [ ] Triggering the job via `workflow_dispatch` on a branch with a small diff completes without a workflow-syntax error

#### Manual Verification:

- [ ] Add `ANTHROPIC_API_KEY` as a repository secret (Settings → Secrets and
      variables → Actions) — human-only step, requires an Anthropic API key
- [ ] Open a real PR with a small, representative diff; confirm the `AI Code
      Review` job appears in the PR's checks with a visible `review` job
- [ ] Confirm the job's logs show the review running (screenshot for
      Champion evidence: "logs from the pipeline/job during the code review
      operation")
- [ ] Confirm the PR receives a comment with the 5 scores + summary, and
      the correct `ai-cr:passed`/`ai-cr:failed` label is applied
      (screenshot for Champion evidence: "PR with a code-review comment
      from the agent")
- [ ] Confirm a Dependabot PR (if/when one opens) is skipped, not failed

**Implementation Note**: After this phase's automated verification passes,
pause for the manual secret-provisioning + real-PR test before considering
this change done — the automated checks alone can't prove the agent
actually reviews correctly, only that the YAML is well-formed.

---

## Testing Strategy

### Manual Testing Steps:

1. Provision `ANTHROPIC_API_KEY`.
2. Open a small test PR (e.g. a trivial doc tweak) against `main`.
3. Confirm the `AI Code Review` check appears and goes green/completes.
4. Read the posted comment; confirm scores are present and cite real
   file:line references for the diff.
5. Confirm the label matches the stated threshold logic.
6. Push a second commit to the same PR; confirm `synchronize` re-triggers
   the review (not just `opened`).

## Performance Considerations

One Claude Code Action run per PR open/update — matches the M5L3 lesson's
explicit warning to keep agent step-count bounded; the action's own default
step limits apply since this plan doesn't override `stopWhen`/step-count
inputs.

## Migration Notes

None — new file only, no existing workflow behavior changes.

## References

- Requirements: `context/changes/ci-cd-code-review/requirements.md`
- Research: `context/changes/ci-cd-code-review/research.md`
- Existing CI precedent: `.github/workflows/ci.yml` (Dependabot exclusion pattern, `:36`)
- Review criteria source: `AGENTS.md:5-12`, `.claude/rules/e2e.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Add the review workflow

#### Automated

- [x] 1.1 Workflow YAML validates
- [ ] 1.2 `workflow_dispatch` run completes without a syntax error

#### Manual

- [ ] 1.3 `ANTHROPIC_API_KEY` secret provisioned
- [ ] 1.4 Real PR shows the `AI Code Review` job in its checks
- [ ] 1.5 Job logs show the review running (Champion evidence screenshot)
- [ ] 1.6 PR comment + correct label posted (Champion evidence screenshot)
- [ ] 1.7 Dependabot PR confirmed skipped, not failed
