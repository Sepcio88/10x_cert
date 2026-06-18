---
bootstrapped_at: 2026-06-17T14:00:44Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: cloud-exam-matter
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

Verbatim hand-off from `context/foundation/tech-stack.md`:

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: cloud-exam-matter
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

**Why this stack** (from hand-off body): A solo developer shipping a multi-user
cloud-cert practice app in a tight 2-week after-hours window needs an agent-friendly
starter that hands over auth, a Postgres database, and edge deploy without assembly.
The 10x Astro Starter is the recommended default for a web app in JavaScript/TypeScript
and clears all four agent-friendly gates. Auth and AI feature flags are set: the starter
covers email + OAuth auth and per-user data out of the box, while the on-demand
question-generation core is built on top. Deployment is Cloudflare Pages; CI runs on
GitHub Actions with auto-deploy on merge. Scaffolding confidence is first-class.

## Pre-scaffold verification

| Signal      | Value   | Severity | Notes                                             |
| ----------- | ------- | -------- | ------------------------------------------------- |
| npm package | not run | n/a      | cmd_template is `git clone` — no npm CLI to check |
| GitHub repo | not run | n/a      | `gh` CLI not installed; recency check unavailable |

Pre-scaffold recency is educational and never gating. No signal was available this run
(no `gh` CLI; the starter is cloned, not an npm `create-*` CLI). Proceeded regardless.

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 19
**Conflicts (.scaffold siblings)**: CLAUDE.md.scaffold (cwd CLAUDE.md preserved; starter copy sidelined)
**.gitignore handling**: moved silently (absent in cwd before scaffold)
**.bootstrap-scaffold cleanup**: deleted (cloned .git stripped before move-up)

Entries moved up into cwd: .env.example, .github, .gitignore, .husky, .nvmrc,
.prettierrc.json, .vscode, README.md, astro.config.mjs, components.json,
eslint.config.js, node_modules, package-lock.json, package.json, public, src,
supabase, tsconfig.json, wrangler.jsonc. Preserved verbatim in cwd: context/,
.claude/, .git/, knowledge/, CLAUDE.md.

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 8 HIGH, 9 MODERATE, 1 LOW
**Direct vs transitive**: 0/3/2/0 direct of total 0/8/9/1 (CRITICAL/HIGH/MODERATE/LOW)

#### CRITICAL findings

None.

#### HIGH findings

Direct:

- `astro` [high] — range <=7.0.0-alpha.1
- `@astrojs/cloudflare` [high] — range <=0.0.0-cf-no-prerender-chunks-... || >=10.0.0
- `wrangler` [high] — range <=0.0.0-kickoff-demo || >=3.7.0

Transitive:

- `@cloudflare/vite-plugin` [high]
- `devalue` [high] — range 5.6.3 - 5.8.0
- `esbuild` [high] — range 0.17.0 - 0.28.0
- `vite` [high] — range 4.2.0-beta.0 - 8.0.3
- `ws` [high] — range 8.0.0 - 8.20.1

#### MODERATE findings

Direct:

- `@astrojs/check` [moderate] — range >=0.9.3
- `supabase` [moderate] — range 1.1.6 - 2.98.2

Transitive:

- `@astrojs/language-server`, `js-yaml`, `miniflare`, `tar`, `volar-service-yaml`,
  `yaml`, `yaml-language-server` [all moderate]

#### LOW / INFO findings

Transitive:

- `@babel/core` [low] — range <=7.29.0

Note: findings are advisory, not gating. Most HIGH findings are transitive dev-tooling
(esbuild/vite/ws) common to fresh Astro + Cloudflare scaffolds. `npm audit fix` addresses
many; review before applying `--force` (breaking changes). Bootstrapper does not auto-fix.

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | true                 |
| has_background_jobs     | false                |

v1 surfaces these but takes no compensating action. CI/CD scaffolding, agent-context
generation, and feature-flag-driven scaffold changes are deferred to a future skill.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `git init` is not needed — this cwd already has a `.git/` repo; the cloned starter's history was stripped before move-up, so your existing repo is intact.
- Review `CLAUDE.md.scaffold` against your existing `CLAUDE.md` and decide which guidance to keep.
- The starter expects Supabase credentials and Cloudflare config — copy `.env.example` to `.env` and fill in values before running.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
