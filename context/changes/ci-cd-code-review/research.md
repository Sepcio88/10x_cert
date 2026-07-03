---
date: 2026-07-03T23:15:00+02:00
researcher: Claude Code
git_commit: a381465
branch: main
repository: Sepcio88/10x_cert (CloudExamMatter)
topic: "AI code review GitHub Actions workflow, based on requirements.md"
tags: [research, ci-cd, github-actions, claude-code-action, m5-champion]
status: complete
last_updated: 2026-07-03
last_updated_by: Claude Code
---

# Research: AI code review GitHub Actions workflow

## Research Question

Based on `context/changes/ci-cd-code-review/requirements.md`: how to wire
`anthropics/claude-code-action@v1` into this repo's GitHub Actions to review
every PR against the 5 criteria in requirements.md, post a comment, and
apply a pass/fail label — confirming the action's actual current inputs and
this repo's existing CI/secrets state first.

## Summary

`anthropics/claude-code-action@v1` supports an automatic (non-`@claude`-mention)
review mode triggered by `pull_request: [opened, synchronize]`, confirmed
against the action's own README, `docs/solutions.md`, and this course's M5L3
lesson text — all three independently show the same shape. Required
`with:` inputs: `anthropic_api_key` and `github_token`; a free-text `prompt`
carries the review instructions (this repo's 5 criteria go here verbatim,
per requirements.md). `claude_args` restricts tool access — needed here to
permit `gh pr comment` and `gh pr edit --add-label` (labels must pre-exist;
`gh pr edit --add-label` does not create them). Recommended `permissions:`
block: `contents: read`, `pull-requests: write`. This repo has no
`ANTHROPIC_API_KEY` secret today (confirmed by reading `.github/workflows/ci.yml`
in full — it only references `SUPABASE_URL`, `SUPABASE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`) — provisioning it is a manual, human-only step.

## Detailed Findings

### The action's current API (external research)

- Confirmed via `raw.githubusercontent.com/anthropics/claude-code-action/main/README.md`
  and `.../docs/solutions.md`: automatic PR review is a first-class pattern,
  not a workaround — the docs call it "Automatic PR Code Review" and show
  `on: pull_request: types: [opened, synchronize]` directly.
- Minimal working shape (cross-confirmed by 3 independent sources: the
  action's own docs, and this course's M5L3 lesson example):
  ```yaml
  permissions:
    contents: read
    pull-requests: write
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: anthropics/claude-code-action@v1
      with:
        anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
        github_token: ${{ secrets.GITHUB_TOKEN }}
        prompt: |
          ...
        claude_args: |
          --allowedTools "Bash(gh pr comment:*),Bash(gh pr edit:*),Bash(gh pr diff:*),Bash(gh pr view:*)"
  ```
- `github_token: ${{ secrets.GITHUB_TOKEN }}` is the built-in, auto-rotated
  token — no PAT needed as long as the job's `permissions:` block grants
  `pull-requests: write`.
- Labels: `gh pr edit --add-label <name>` requires the label to already
  exist in the repo (it does not auto-create). This repo has no
  `ai-cr:passed`/`ai-cr:failed` labels yet — need a one-time idempotent
  `gh label create <name> --color <hex> --force` step (safe to run every
  invocation; `--force` updates-or-creates).
- Security note (both the action's docs and the M5L3 lesson agree): pin
  third-party actions to a SHA, not a moving tag, in general — but
  `anthropics/claude-code-action@v1` is a first-party Anthropic action this
  course explicitly uses via the `@v1` tag in its own examples; this repo's
  existing `ci.yml` already pins first-party actions (`actions/checkout@v4`,
  `actions/setup-node@v4`) by major-version tag, not SHA, so `@v1` here is
  consistent with existing repo convention rather than a new risk.

### This repo's current state (internal research)

- `.github/workflows/ci.yml` (read in full) has three jobs: `ci`
  (lint/test/build), `e2e` (Playwright, skips on Dependabot), `deploy`
  (Cloudflare Workers, main-only). All triggers are `branches: [main]` — the
  repo's actual default/working branch, confirmed via `git branch --show-current`
  and `git status -sb` (`## main...origin/main`). Note: `AGENTS.md:12`
  claims "CI triggers on `master`" — this is stale; `ci.yml` already targets
  `main`. Not fixed here (out of scope for this change), but the new
  workflow should obviously also target `main`.
- Existing secrets referenced anywhere in `.github/workflows/ci.yml`:
  `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `OPENROUTER_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. No
  `ANTHROPIC_API_KEY` — this will be a net-new secret only the repo owner
  can add (Settings → Secrets and variables → Actions).
- No existing `.github/workflows/review.yml` or any Claude/AI-review
  workflow in this repo — this is a wholly new file, no conflict.
- No existing GitHub labels are visible from the repo contents (labels
  aren't stored in-repo) — treat `ai-cr:passed`/`ai-cr:failed` as needing
  first-run creation, per above.
- `context/changes/ci-cd-code-review/requirements.md` (read in full) — the
  5 review criteria, the pass/fail label threshold (fail if any criterion
  ≤3 or average <6), and the decision to keep this informational (no merge
  gate) for the MVP are all already settled there; this research doesn't
  re-litigate them.

## Code References

- `.github/workflows/ci.yml:1-136` — existing pipeline shape/conventions to match (job naming, `runs-on: ubuntu-latest`, secret-passing style)
- `AGENTS.md:5-12` — hard rules the review criteria are grounded in
- `.claude/rules/e2e.md` — E2E convention the review criteria cite
- `context/changes/ci-cd-code-review/requirements.md` — settled criteria/thresholds/scope

## Architecture Insights

This repo's existing CI is a plain, single-file, multi-job workflow with no
composite actions or reusable-workflow abstraction — appropriate for a
single-repo solo project. The M5L3 lesson's "Composite Action" pattern
exists to share a reviewer across *multiple* repos; since this is a single
repo with no sibling projects to share the action with, a composite action
would be premature abstraction here — a plain job in a new
`.github/workflows/review.yml` matches both the lesson's own "start
locally, extract later" guidance and this repo's existing style.

## Open Questions

None outstanding — requirements.md settled the substantive design
decisions; this research confirmed the external action's API is stable
enough to implement directly.
