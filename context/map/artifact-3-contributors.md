# Artifact 3 — Contributors (authorship signal)

Source: `git log --format="%an <%ae>"` across all 46 commits.

## Headline finding: single author

```
46  Sepcio88 <159083815+Sepcio88@users.noreply.github.com>
```

Every commit in this repo has one human author. There is no bus-factor problem to map
in the traditional "who owns which module" sense — the usual output of this lesson
(a per-area "ask this person" table) doesn't apply. What replaces it below is the
signal that *does* exist in a solo, AI-paired repo: working rhythm, and where the
paper trail lives instead of a second brain.

## Working rhythm (commit timestamps, UTC as recorded)

- Cadence: 17 commits day 1, 14 day 2 (scaffold + first roadmap slice), then 4 more
  sessions of 2–6 commits each over the following ~2 weeks — bursty, slice-at-a-time,
  not continuous small commits.
- Time-of-day: concentrated 11:00–18:00, peak 15:00–16:00 (11 commits each hour). One
  outlier at 22:00. Reads as focused daytime working sessions, not late-night patching.
- No weekend/gap pattern is meaningful yet at 2.5 weeks of history — revisit this
  after a few months.

## Where "ask the author" is replaced by "read the artifact"

This repo follows the 10xDevs `context/changes/<id>/` convention: every roadmap slice
has a `change.md` (intent), `research.md` (investigation), and `plan.md` (phased
implementation with a Progress table and per-phase commit history). That means the
onboarding question this artifact would normally answer — "who do I ask about the
practice-generation flow?" — has a better answer than a person: **read
`context/changes/question-generation-engine/` and
`context/changes/generate-first-practice-set/`**, which carry the actual design
reasoning, not just the diff.

## Bot/AI-commit filtering note

No commits are authored by a bot account or CI identity — all 46 are attributed to the
single human author even where the commit body indicates AI-assisted implementation
(this is expected under the 10xDevs workflow: the agent drafts, the human commits).
Nothing to exclude for this repo; noting the check was run as instructed by the
lesson, for repos where it would matter.
