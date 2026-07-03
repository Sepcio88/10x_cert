# AI code review GitHub Actions workflow — Plan Brief

> Full plan: `context/changes/ci-cd-code-review/plan.md`
> Research: `context/changes/ci-cd-code-review/research.md`

## What & Why

Add an AI code-review job that runs on every pull request, for the
10xChampion (M5) certification track — a working CI/CD pipeline where an
agent reviews PRs against this repo's own conventions and leaves visible
evidence (a comment + a label).

## Starting Point

No AI-review workflow exists; `.github/workflows/ci.yml` only runs
lint/test/build/E2E/deploy. No `ANTHROPIC_API_KEY` secret and no
`ai-cr:*` labels exist yet.

## Desired End State

Every PR to `main` gets a `review` job that posts one comment scoring the
diff on 5 repo-specific criteria and applies `ai-cr:passed`/`ai-cr:failed`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Agent implementation | `anthropics/claude-code-action@v1` (ready-made) | This repo already runs on Claude Code — the ready-made action inherits the same conventions without a hand-rolled SDK loop | Requirements |
| Review criteria | 5 criteria from `AGENTS.md` hard rules + the M4 trust-boundary finding | Repo-specific, not generic boilerplate — matches the lesson's own "your internal requirements, not the AI's" guidance | Requirements |
| Merge gate | Informational only, no hard gate | MVP scope; revisit once criteria are validated on real PRs | Requirements |
| Composite action vs plain job | Plain job in `review.yml` | Single-repo project — no sibling repo to share a composite action with | Research |
| Dependabot handling | Skip, mirroring `ci.yml`'s existing `e2e` job pattern | Dependabot PRs can't read repo secrets; same constraint already solved once in this repo | Plan |

## Scope

**In scope:** `.github/workflows/review.yml`, label auto-creation, the
5-criteria prompt, PR comment + label side-effects.

**Out of scope:** merge gate, composite action extraction, promptfoo
model-comparison evals, inline (line-level) comments, provisioning the
`ANTHROPIC_API_KEY` secret itself.

## Architecture / Approach

One new job, triggered on `pull_request` (opened/synchronize) and
`workflow_dispatch`. The action's own `gh` tool access (scoped via
`claude_args`) does the PR-commenting and labeling — no separate scripting
needed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Add the review workflow | Working `.github/workflows/review.yml` | Can't be proven end-to-end until `ANTHROPIC_API_KEY` is provisioned (human-only step) |

**Prerequisites:** an Anthropic API key, added as a GitHub Actions secret.
**Estimated effort:** ~30-60 minutes including the manual secret setup and one test PR.

## Open Risks & Assumptions

- Assumes `claude-code-action@v1`'s automatic PR-review mode behaves as
  documented externally — first real PR run is the actual proof.
- Every PR run costs Anthropic API usage; no volume cap is set beyond the
  action's own default step limits.

## Success Criteria (Summary)

- A real PR shows a visible `AI Code Review` job with logs of the review
  running, and receives both a scored comment and a pass/fail label.
