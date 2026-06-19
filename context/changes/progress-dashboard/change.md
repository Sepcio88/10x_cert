---
change_id: progress-dashboard
title: Per-topic breakdown + per-exam progress dashboard (S-04)
status: impl_reviewed
created: 2026-06-19
updated: 2026-06-19
archived_at: null
---

## Notes

Roadmap slice S-04. PRD refs: FR-008 (per-topic/domain breakdown), FR-010 (home-page progress view). Prerequisite S-03 (session persistence) is done.

Metric decision resolved 2026-06-19 (closed PRD Open Question #2):

- **Per-exam aggregation** — the progress trend averages only same-exam sessions; never blends different exams/providers. Supported by the S-03 schema (`exam`, `percentage`, `created_at` columns on `practice_sessions`).
- **Home page (FR-010)** defaults to the most-recently-practiced exam's trend, with an exam switcher to other exams.
- **Per-topic breakdown (FR-008)** — surface a per-domain/topic breakdown for a session, computed from the `topic` already stored in each session's payload (no schema change needed).
- Thin-data case to handle in the plan: a per-exam trend with only one session is a single point — decide the UI for "not enough sessions yet."

## Known issue (dev-only, non-blocking)

Rendering a React island server-side under the **Cloudflare workerd dev runtime** (`npm run dev`)
intermittently logs `TypeError: Cannot read properties of null (reading 'useState'/'useMemo')`
from `node_modules/.vite/deps_ssr/chunk-*` — React's SSR dispatcher comes back null. Observed
when adding new island files (TopicBreakdown, ProgressDashboard); survives a full dev restart
and a `resolve.dedupe` of react/react-dom, so it is **not** stale cache nor a duplicate-React
problem. **Not blocking:** Astro recovers via client hydration, so pages render correctly in the
browser, and the **production build SSRs every page cleanly** (`npm run build` passes). Affects
islands generally, not S-04 specifically. Deferred as an environment/tooling follow-up (candidate
remedies: `vite.ssr.noExternal: ['react','react-dom']`, or an `@astrojs/react`/adapter version bump).
