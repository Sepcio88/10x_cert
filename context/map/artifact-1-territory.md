# Artifact 1 — Territory (git history signal)

Source: `git log` across all 46 commits (2026-06-18 → 2026-07-03, ~2.5 weeks). Single
contributor. No quarterly trend is meaningful yet — the whole repo is one sprint old —
so this substitutes a **within-project trend** (early scaffold vs. feature-slice era).

## Top changed files (all-time, excluding the initial scaffold commit)

| # | File | Changes |
|---|------|---------|
| 1 | `src/components/practice/PracticeGenerator.tsx` | 8 |
| 2 | `context/foundation/roadmap.md` | 8 |
| 3 | `.github/workflows/ci.yml` | 7 |
| 4 | `src/types.ts` | 6 |
| 5 | `src/lib/practice/session.test.ts` | 5 |
| 6 | `src/pages/dashboard.astro` | 4 |
| 7 | `src/pages/api/practice/generate.test.ts` | 4 |
| 8 | `src/lib/practice/session.ts` | 4 |
| 9 | `src/middleware.ts` | 3 |
| 10 | `src/lib/services/question-generator.test.ts` | 3 |

**Reading:** `PracticeGenerator.tsx` and `src/types.ts` are the hottest product code —
the practice-generation flow is the spine of the app and `types.ts` is the shared
contract everyone edits when that flow's shape changes. `ci.yml` churns almost as much
as product code (7 commits) — the CI/CD pipeline itself has been actively engineered,
not "set once."

## Commit-size distribution (files touched per commit)

The initial scaffold commit touched 139 files (one-time, excluded above). After that,
commits are feature-slice-shaped: 6–15 files for a phase of a roadmap slice
(`question-generation-engine` 15, `session-persistence-history` 12,
`progress-dashboard` 9, `retry-weak-topics` 8), tapering to 1–3 files for
fixes/chores. This matches the repo's own `context/changes/<id>/plan.md` phased
workflow — commits are phase-sized, not feature-sized.

## Co-change pairs (files that change together ≥2 commits)

| Pair | Count | Reading |
|---|---|---|
| `session.test.ts` ↔ `session.ts` | 4 | test/impl pair, changes locked together — healthy |
| `session.test.ts` / `session.ts` ↔ `types.ts` | 3 each | session logic is a heavy consumer of the shared type contract |
| `PracticeGenerator.tsx` ↔ `QuestionCard.tsx` | 3 | the two core practice-UI components evolve together |
| `ProgressDashboard.tsx` ↔ `progress.ts` / `progress.test.ts` / `dashboard.astro` | 2 each | dashboard feature is a tight vertical slice (page + component + lib + test) |
| `question-generator.test.ts` ↔ `question-generator.ts` / `generate.test.ts` | 2 each | generation logic and its API-route test move together |
| `ci.yml` ↔ `wrangler.jsonc` / `Layout.astro` | 2 each | CI changes have twice touched deploy config and the shared layout in the same commit — worth watching for scope creep |

No pathological coupling (no pair spans unrelated features). Co-change stays inside
each vertical slice, which tracks the roadmap's own slicing.

## Commit cadence

17 commits on day 1 (scaffold + first slice), 14 on day 2, then a long tail of 2–6
commits per working session (2026-06-22, 06-25, 06-26, 07-03). Reads as a solo
developer working in short, deliberate bursts aligned to roadmap slices, not
continuous small commits.
