---
project: CloudExamMatter
checked_at: 2026-07-03
health: needs-attention
test_runner: vitest + playwright
ci_provider: github-actions
audit: { critical: 0, high: 6, moderate: 9, low: 2 }
verdict: ready-for-demo (address the direct astro advisory deliberately, post-submission)
---

## Overall health: needs-attention

Operationally the project is in strong shape — reproducible builds, a working unit +
E2E test stack, a full CI/CD pipeline, strict typing, and complete local tooling. The
one item that keeps it off "healthy" is the dependency audit: 6 HIGH advisories. Only
**one** (`astro`, a direct dep) actually reaches the deployed runtime, and its practical
exposure for this app is low. The rest are dev/build-only transitive packages that never
ship in the Cloudflare Worker.

## Dependency health

`npm audit`: **0 critical · 6 high · 9 moderate · 2 low**.

| Package     | Sev  | Direct? | Ships to Worker runtime?                    | Advisory (short)                                        |
| ----------- | ---- | ------- | ------------------------------------------- | ------------------------------------------------------- |
| `astro`     | HIGH | ✅ yes  | **yes**                                     | Reflected XSS (slot name), XSS (spread attr names), Host-header SSRF in prerendered error page |
| `undici`    | HIGH | no      | no (Node/dev only; Workers use native fetch) | TLS bypass / header injection / cache poisoning (many)  |
| `ws`        | HIGH | no      | no (dev/build via miniflare)                | uninitialized memory disclosure; DoS                    |
| `vite`      | HIGH | no      | no (build/dev)                              | `server.fs.deny` bypass on Windows; NTLM disclosure     |
| `miniflare` | HIGH | no      | no (local dev runtime)                      | pulls vulnerable undici/ws                              |
| `devalue`   | HIGH | no      | only if deserializing untrusted input       | DoS via sparse-array deserialization                    |

**Exposure note (astro):** the three advisories require dynamic/user-controlled **slot
names**, spreading user-controlled **attribute names**, or **prerendered** error pages.
This app uses none of those patterns (SSR `output: "server"`, no dynamic slot names, no
spread of user attribute names), so real exposure is low — but it is still the only HIGH
that touches production, so it's the one to fix deliberately.

**Fix scope:** there is no patched 6.x — the fix is `astro@7`, which cascades to
`@astrojs/cloudflare@14` and `@astrojs/react@6`. That is a coordinated **major** upgrade,
not a patch.

### Outdated (major gaps)

`astro` 6→7, `@astrojs/cloudflare` 13→14, `@astrojs/react` 5→6, `eslint` 9→10,
`typescript` 5→6, `lint-staged` 16→17. None are urgent; the astro cluster is the only one
tied to a security advisory.

## Test infrastructure

- **Unit:** Vitest — 67 tests passing (`src/**/*.test.ts`).
- **E2E:** Playwright — the key flow (generate → answer with feedback → progress update),
  green locally and in CI, with admin-API user provisioning + teardown cleanup.
- Both are wired into CI. The agent can verify its own changes end to end. ✅

## CI/CD coverage

GitHub Actions (`.github/workflows/ci.yml`):

| Stage       | Present | Notes                                                              |
| ----------- | ------- | ----------------------------------------------------------------- |
| Lint        | ✅      | `eslint .` with type-checked rules                                |
| Type-check  | ✅*     | Covered by type-aware ESLint + `astro build`; no standalone `tsc` |
| Test        | ✅      | `vitest run`                                                      |
| E2E         | ✅      | Separate Playwright job (needs: ci)                               |
| Build       | ✅      | `astro build`                                                     |
| Deploy      | ✅      | Cloudflare Workers, gated on green ci (push to main)              |
| Security    | ❌      | No `npm audit` / Dependabot / CodeQL step                         |

## Configuration completeness

Present: `.prettierrc.json`, `eslint.config.js`, `tsconfig.json` (extends `astro/tsconfigs/strict`),
`.gitignore`, `.env.example`, `.nvmrc`, `AGENTS.md`, `CLAUDE.md`, lockfile. **Missing:**
`.editorconfig` (low).

## Prioritized fixes

### Fix before / around submission

1. **`astro` HIGH advisory (direct, runtime).** Impact: XSS/SSRF classes in the framework,
   though low practical exposure here. Action: a **coordinated major upgrade** —
   `astro@7` + `@astrojs/cloudflare@14` + `@astrojs/react@6` — then run the full suite
   (lint, unit, **E2E**) and a live smoke test before merging. Effort: significant (>1h).
   **Recommendation:** do NOT rush this in the final 2 days before the 2026-07-05 deadline
   for a low-exposure advisory; schedule it immediately after submission, on a branch, with
   E2E as the gate. Accept the low-exposure risk for the demo.

2. **Add a security step to CI.** Impact: advisories currently surface only on manual audit.
   Action: enable **Dependabot** (`.github/dependabot.yml`) and/or add a non-blocking
   `npm audit --audit-level=high` step. Effort: quick.

3. **`.editorconfig`.** Impact: minor formatting consistency across editors. Action: add a
   small `.editorconfig`. Effort: quick.

### Optional now (low-risk hygiene)

4. **Non-breaking `npm audit fix`.** Clears the `ws` HIGH and several moderates without a
   major bump (leaves the `astro` direct advisory, which needs `--force`). Re-run the full
   suite afterward. Effort: quick–moderate.

## Verdict

**Ready to demo / submit.** No critical vulnerabilities, a working unit + E2E test stack, a
complete CI/CD pipeline, and strong local tooling. The single production-facing HIGH
(`astro`) is a known, low-exposure item with a deliberate post-submission upgrade path —
not a blocker for the certification deadline.
