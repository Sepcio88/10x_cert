---
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
---

## Why this stack

A solo developer shipping a multi-user cloud-cert practice app in a tight 2-week
after-hours window needs an agent-friendly starter that hands over auth, a
Postgres database, and edge deploy without assembly. The 10x Astro Starter is the
recommended default for a web app in JavaScript/TypeScript and clears all four
agent-friendly gates (typed, convention-based, popular in training, well
documented), so an agent can work in it confidently. Auth and AI feature flags are
set: the starter covers email + OAuth auth and per-user data out of the box, while
the on-demand question-generation core (the product's differentiator) is built on
top — the Cloudflare edge runtime suits LLM API calls and streaming, though its
long-running-task limit is worth watching against the <10s generation target.
Payments, realtime, and background jobs are out of scope per the PRD. Deployment
is Cloudflare Pages (the starter default); CI runs on GitHub Actions with
auto-deploy on merge. Scaffolding confidence is first-class.
