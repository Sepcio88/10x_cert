---
project: CloudExamMatter
researched_at: 2026-06-25
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 (SSR, output: server)
  runtime: Cloudflare Workers (workerd) via @astrojs/cloudflare v13
---

## Recommendation

**Deploy on Cloudflare Workers.**

The project is already wired for it — `@astrojs/cloudflare` v13.5.0, `wrangler` v4.90.0,
a committed `wrangler.jsonc` (Workers entrypoint + assets binding + `nodejs_compat`), and
`output: "server"` in `astro.config.mjs`. Cloudflare also wins the two interview drivers:
**lowest cost** (100k requests/day free, no "non-commercial only" clause) and **no prior
familiarity required** since the toolchain is committed and reproducible. Critically, its
billing meters *CPU time* (not wall-clock), so a <10s LLM generation call — mostly time
spent awaiting the OpenRouter `fetch` — does **not** burn against the request limit, unlike
Netlify's hard 10s function timeout on the free tier, which would directly threaten the
PRD's <10s generation NFR.

## Platform Comparison

| Platform           | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total       |
| ------------------ | --------- | ------------------ | ------------------- | ----------------- | ----------------- | ----------- |
| Cloudflare Workers | Pass      | Pass               | Pass                | Partial           | Pass              | **4.5 / 5** |
| Vercel             | Pass      | Pass               | Pass                | Pass              | Partial           | 4 / 5       |
| Netlify            | Pass      | Pass               | Pass                | Partial           | Partial           | 3 / 5       |

- **Cloudflare Workers** — `wrangler deploy` / `wrangler tail` / `wrangler rollback` cover the
  full ops loop; docs are published as markdown + `llms.txt`; an official Cloudflare MCP server
  exists. The one *Partial* is the deploy API: the platform is mid-migration from "Pages" to
  "Workers static assets / Workers Builds" (Pages support dropped in `@astrojs/cloudflare` v13,
  early 2026; Cloudflare acquired Astro Jan 2026), so older tutorials are misleading even though
  the current path is stable and exactly what this repo already targets.
- **Vercel** — best-in-class DX and instant rollback (`vercel rollback`), 20 compute regions /
  126 PoPs, 1M free function invocations. Loses on cost intent: the **Hobby tier is
  non-commercial/personal-use only** — a cert demo qualifies, but it's a policy risk, and any
  growth pushes to Pro at $20/mo. Astro 6 SSR on Vercel also has open issues (server-island 404s,
  esbuild chunk errors) as of mid-2026.
- **Netlify** — solid adapter and deploy previews, but the post-Sept-2025 **credit model caps the
  free tier at ~15GB bandwidth/month** and, decisively, **serverless functions time out at 10s on
  free** — too tight against a <10s generation budget with no headroom. Single-region functions
  also weaken global latency.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Already the committed target; cheapest with no commercial clause; CPU-time billing model is the
right shape for I/O-bound LLM calls; global edge by default; first-class CLI and docs.

#### 2. Vercel

Smoothest DX and the most mature instant-rollback story. Held back only by the Hobby
non-commercial clause and the $20/mo step-up, plus a couple of open Astro-6 SSR issues. The
fallback if Cloudflare's workerd/Node-compat edges become a recurring tax.

#### 3. Netlify

Comparable feature set and clean GitHub integration, but the new credit caps and the free-tier
10s function timeout make it the weakest fit for this specific generation-latency requirement.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **Pages-vs-Workers documentation rot.** A large share of "deploy Astro to Cloudflare" guides
   describe the deprecated Pages flow (dashboard Git integration, `functions/` dir). Following one
   by mistake produces a broken or duplicated deploy. The repo's `wrangler.jsonc` is the source of
   truth, not the internet.
2. **`nodejs_compat` gaps under workerd.** `@supabase/ssr` cookie/crypto handling and any
   incidental Node API use can behave differently than on Node — failures that don't appear in
   `astro dev` and only surface on the deployed Worker.
3. **Known dev-only island error.** `astro.config.mjs` itself documents a workerd SSR "null
   dispatcher" React-island error in dev — a sign the React-on-workerd path has sharp edges.
4. **Worker size / CPU ceilings.** React + deps must stay under the compressed Worker size limit,
   and heavy synchronous JSON parsing/grading of LLM output counts as CPU time even though the
   `fetch` wait does not.
5. **Two competing deploy paths.** "Workers Builds" (Cloudflare-side Git integration) and a
   GitHub-Actions `wrangler deploy` can both fire on a push to `main`, causing double deploys if
   both are enabled. Pick one (this plan uses GitHub Actions).

### Pre-Mortem — How This Could Fail

Six months out, the deploy is "done" but fragile. Early on, the team enabled Cloudflare's
dashboard Git integration *and* a GitHub Actions deploy job — every merge shipped twice, racing
each other, and an occasional stale build won. Secrets were the next trap: `SUPABASE_KEY` and
`OPENROUTER_API_KEY` were set as build-time env in CI but never `wrangler secret put` for runtime,
so the first real generation request 500'd in production while everything passed locally under
`astro dev`. Debugging was slow because nobody had wired `wrangler tail`, and the workerd-only
Supabase cookie quirk meant auth sessions silently dropped for a subset of users. By the time the
root causes (dual deploy + missing runtime secrets + Node-compat cookie handling) were understood,
the demo had already shown a blank generation screen — the exact failure the PRD's
visible-feedback guardrail was meant to prevent. None of it was Cloudflare being "wrong"; it was
trusting `astro dev` as production-fidelity and skipping the runtime-secret and single-deploy-path
disciplines.

### Unknown Unknowns

- **Astro-under-Cloudflare moves fast post-acquisition.** Cloudflare acquired Astro (Jan 2026);
  expect breaking changes across `@astrojs/cloudflare` minors — pin versions and read changelogs
  before bumping.
- **Build-time vs runtime secrets are different stores.** Astro `envField(... access: "secret")`
  vars must exist as Worker *runtime* secrets (`wrangler secret put`), separate from the
  GitHub-Actions build env. Setting one is not setting the other.
- **`astro dev` ≠ workerd in all cases.** For binding-accurate local testing you may still need
  `wrangler dev`; dev-server green does not guarantee deployed-Worker green.
- **`compatibility_date` is load-bearing.** Bumping it (currently `2026-05-08`) can change
  Node-compat semantics; treat it as a deliberate, tested change.

## Operational Story

- **Preview deploys**: PRs can get preview URLs via `wrangler versions upload` (or a preview
  GitHub Actions job). Keep production deploys gated to `main` only; preview URLs are
  Cloudflare-hosted and unauthenticated unless Cloudflare Access is added.
- **Secrets**: Two places. **Build-time** (`npm run build` in CI) reads `SUPABASE_URL` /
  `SUPABASE_KEY` from **GitHub Actions secrets**. **Runtime** (the live Worker) reads
  `SUPABASE_URL`, `SUPABASE_KEY`, `OPENROUTER_API_KEY` from **Worker secrets** set via
  `wrangler secret put <NAME>` (or `--var`/`secrets` in the deploy action). Rotate by re-running
  `wrangler secret put`.
- **Rollback**: `wrangler rollback [version-id]` reverts to a prior Worker version in seconds.
  Caveat: it reverts code only — Supabase schema/data migrations do **not** roll back with it.
- **Approval**: Production publish to `main` runs unattended after green CI. A human gates:
  rotating the primary Supabase/OpenRouter keys, changing `compatibility_date`/`compatibility_flags`,
  and any Supabase migration. An agent may deploy, tail logs, and roll back.
- **Logs**: `wrangler tail` streams live runtime logs; `observability.enabled` is on in
  `wrangler.jsonc`, so logs are also queryable in the Cloudflare dashboard. Build/CI logs are in
  the GitHub Actions run.

## Risk Register

| Risk                                              | Source             | Likelihood | Impact | Mitigation                                                                                          |
| ------------------------------------------------- | ------------------ | ---------- | ------ | -------------------------------------------------------------------------------------------------- |
| Missing runtime secrets → prod generation 500s    | Pre-mortem         | M          | H      | `wrangler secret put` for all three keys before first deploy; smoke-test a real generation post-deploy. |
| Dual deploy (Workers Builds + GitHub Actions)     | Devil's advocate   | M          | M      | Use GitHub Actions deploy only; leave Cloudflare dashboard Git integration disabled.               |
| workerd Node-compat breaks Supabase auth cookies  | Devil's advocate   | L          | H      | Verify auth flow on the deployed URL (not just `astro dev`); keep `nodejs_compat` + tested `compatibility_date`. |
| Following deprecated Pages tutorials              | Unknown unknowns   | M          | L      | Treat committed `wrangler.jsonc` as source of truth; ignore `functions/`-based Pages guides.        |
| Adapter breaking change on version bump            | Unknown unknowns   | M          | M      | Pin `@astrojs/cloudflare`/`wrangler`; read changelog before upgrading.                              |
| LLM grading CPU time near free-tier ceiling        | Research finding   | L          | M      | Keep post-generation parsing lean; the `fetch` wait itself is not billed CPU.                       |

## Getting Started

The repo is already Cloudflare-ready (adapter + `wrangler.jsonc` committed), so the path is short:

1. **Authenticate**: `npx wrangler login` (one-time; opens browser) — or set a `CLOUDFLARE_API_TOKEN`
   for CI.
2. **Set runtime secrets** (production Worker): `npx wrangler secret put SUPABASE_URL`,
   `... SUPABASE_KEY`, `... OPENROUTER_API_KEY`.
3. **First manual deploy**: `npm run build && npx wrangler deploy` → returns the public
   `*.workers.dev` URL.
4. **Smoke-test on the live URL**: sign in, run one generation, confirm feedback + progress update.
5. **Wire CD**: add a deploy job to `.github/workflows/ci.yml` that runs `wrangler deploy` (via
   `cloudflare/wrangler-action`) only on push to `main`, after lint→test→build is green, using
   `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` GitHub secrets.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup (handled next, in KROK 1's CD step)
- Production-scale architecture (multi-region, HA, DR)
