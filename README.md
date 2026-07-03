# CloudExamMatter

**A developer studying for a cloud certification picks an exam and how many questions they want, and CloudExamMatter generates fresh, exam-representative questions on demand — grading each answer with an explanation-first rationale and tracking their score trend across sessions.**

🌐 **Live demo:** https://cloud-exam-matter.sepielak-marcin.workers.dev

Instead of memorizing a static question bank, every practice set is generated on the fly for the exam you choose (AWS / Azure / GCP), so the material is always fresh — paired with _why_ each correct answer is correct and a private, revisitable record of your progress.

---

## What it does

- **Sign in** with email/password (or OAuth) — each user's sessions and scores are private to their account.
- **Generate a set**: pick a provider, find an exam by code or name (e.g. `SAA-C03`), choose 1–5 questions.
- **Answer one at a time** with immediate, **explanation-first** feedback (the reasoning leads, the correct answer follows).
- **Finish with a saved session**: an overall score plus a per-topic breakdown you can revisit any time.
- **Track progress**: a per-exam score trend on your dashboard, and a one-click retry of the topics you got wrong.

## Tech stack

| Layer         | Choice                                                                            |
| ------------- | --------------------------------------------------------------------------------- |
| Framework     | [Astro 6](https://astro.build/) (SSR, `output: "server"`) + [React 19](https://react.dev/) islands |
| Language      | TypeScript 5                                                                       |
| Styling       | Tailwind CSS 4                                                                     |
| Auth & data   | [Supabase](https://supabase.com/) — Postgres + Auth, row-level security per user   |
| Generation    | [OpenRouter](https://openrouter.ai/) (`openai/gpt-4o-mini`), on-demand            |
| Runtime       | [Cloudflare Workers](https://workers.cloudflare.com/) (`workerd`) via `@astrojs/cloudflare` |
| CI/CD         | GitHub Actions — lint → test → build, Playwright E2E, auto-deploy on merge to `main` |

## Getting started

**Prerequisites:** Node.js `22.14.0` (see `.nvmrc`), npm, a Supabase project, and an OpenRouter API key.

```bash
git clone https://github.com/Sepcio88/10x_cert.git
cd 10x_cert
npm install
```

Create a `.dev.vars` file (gitignored) with your runtime secrets — the dev server and build read them here:

```bash
# .dev.vars
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<supabase anon / publishable key>
OPENROUTER_API_KEY=<your OpenRouter key>
```

Apply the database schema (the `practice_sessions` table + RLS policies) to your Supabase project:

```bash
npx supabase db push        # or run supabase/migrations/*.sql in the SQL editor
```

Start the dev server (Cloudflare `workerd` runtime, reads `.dev.vars`):

```bash
npm run dev                 # http://localhost:4321
```

> Secrets are declared via Astro's `astro:env` schema as **server-only** — they never reach the browser. On Cloudflare they resolve per-request, so read them inside request handlers, not at module scope.

## Scripts

| Script                     | What it does                                              |
| -------------------------- | -------------------------------------------------------- |
| `npm run dev`              | Dev server on `workerd` (loads `.dev.vars`)              |
| `npm run build`            | Production build (`@astrojs/cloudflare`)                 |
| `npm run preview`          | Preview the production build                             |
| `npm run lint`             | ESLint (type-checked)                                    |
| `npm run test`             | Unit tests (Vitest)                                      |
| `npm run test:e2e`         | End-to-end tests (Playwright)                            |
| `npm run test:e2e:install` | Install the Chromium browser for Playwright             |

### End-to-end tests

The E2E suite drives the key flow — **generate → answer with feedback → progress update** — against the dev server, following [`.claude/rules/e2e.md`](.claude/rules/e2e.md) (role/label locators, `storageState` auth, condition-based waits). It provisions a pre-confirmed test user via the Supabase **admin API** and deletes it in teardown, so it needs one extra secret in `.dev.vars`:

```bash
SUPABASE_SERVICE_ROLE_KEY=<supabase service_role key>   # server-only; E2E setup/teardown only
```

Then:

```bash
npm run test:e2e:install    # one-time
npm run test:e2e
```

## Architecture

- **Rendering** — Astro renders server-first on Cloudflare Workers; only the interactive pieces (the practice generator, the progress dashboard) hydrate as React islands.
- **Auth & routing** — `src/middleware.ts` reads the Supabase session per request and gates `PROTECTED_ROUTES` (`/practice`, `/dashboard`, `/history`), redirecting anonymous users to `/auth/signin`.
- **Generation** — `POST /api/practice/generate` calls OpenRouter with the chosen exam/count, validates the model output against a Zod schema, and returns a typed question set (capped at 5/session to stay within the ~10s budget).
- **Persistence** — completed sessions are saved to the `practice_sessions` table; row-level security ensures each user can read only their own. The server recomputes the score on save (never trusting the client).
- **Progress** — the dashboard aggregates a user's sessions per exam into a score-over-time trend and surfaces weak topics for targeted retries.

```
src/
├── pages/            # Astro routes
│   ├── api/          #   REST endpoints (auth, practice generate/sessions)
│   ├── auth/         #   sign-in / sign-up / confirm-email
│   ├── practice.astro, dashboard.astro, history/
│   └── index.astro
├── components/        # Astro + React (auth, practice, dashboard, ui)
├── lib/               # domain logic (practice/, services/ [OpenRouter], db/)
├── middleware.ts      # per-request auth + route protection
└── db/                # Supabase types
supabase/migrations/   # practice_sessions table + RLS
wrangler.jsonc         # Cloudflare Workers config
.github/workflows/     # CI: lint→test→build, E2E, deploy
```

## Deployment

Deployed to **Cloudflare Workers** and shipped automatically: on every push to `main`, GitHub Actions runs lint → test → build, and on green it deploys via `wrangler` and syncs the runtime secrets to the Worker. See [`context/foundation/infrastructure.md`](context/foundation/infrastructure.md) for the platform decision and rationale.

Manual deploy (needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`):

```bash
npm run build && npx wrangler deploy
```

## License

MIT
