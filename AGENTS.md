# Repository Guidelines

CloudExamMatter is an Astro 6 SSR web app (React 19 islands, TypeScript 5, Tailwind 4, shadcn/ui) using Supabase for auth and deploying to Cloudflare Workers. This file holds engineering conventions; see @CLAUDE.md for the 10x build-pipeline workflow and @README.md for Supabase/Cloudflare setup.

## Hard rules

- API routes under `src/pages/api/` must export `const prerender = false` — the app runs `output: "server"` (full SSR).
- Enable RLS on every new Supabase table, with granular per-operation, per-role policies.
- Merge Tailwind classes with the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge); never concatenate class strings by hand.
- Use React components only where interactivity is needed, Astro components for static content/layout. No Next.js directives (`"use client"`).
- Never expose `SUPABASE_KEY` to the client — secrets are server-only via `astro:env/server`.
- CI triggers on `master`, but the working branch is `main` — open PRs against the branch CI watches, or fix the branch filter in @.github/workflows/ci.yml.

## Project Structure & Module Organization

`src/pages/` holds routes (`api/` for endpoints, `auth/` for sign-in/up); `src/components/` holds UI (`ui/` shadcn, `auth/`, `hooks/` for extracted React hooks); `src/layouts/` for Astro layouts; `src/lib/` for services/helpers (`supabase.ts` is the SSR client); `src/middleware.ts` resolves the user and guards `PROTECTED_ROUTES`; `src/types.ts` for shared entities/DTOs. Path alias `@/*` → `./src/*`. Supabase migrations live in `supabase/migrations/`.

## Build, Test, and Development Commands

- `npm run dev` — dev server (Cloudflare workerd runtime)
- `npm run build` — production SSR build
- `npm run lint` / `npm run lint:fix` — ESLint with type-checked rules
- `npm run format` — Prettier

Node 22.14.0 (`.nvmrc`). Pre-commit: husky + lint-staged auto-fixes staged `*.{ts,tsx,astro}` (ESLint) and `*.{json,css,md}` (Prettier).

## Coding Style & Naming Conventions

API handlers use uppercase `GET`/`POST` exports and validate input with zod. shadcn/ui components ("new-york") go in `src/components/ui/`; add via `npx shadcn@latest add <name>`. Migrations follow `YYYYMMDDHHmmss_short_description.sql`.

## Testing Guidelines

E2E follows @.claude/rules/e2e.md (Playwright: role/label/text locators, no `waitForTimeout`, `storageState` auth). No test runner is wired into the scaffold yet — add one before writing tests.

## Commit & Pull Request Guidelines

No commit history exists yet; use Conventional Commits. The CI gate is lint + build (`npm ci` → `npx astro sync` → `npm run lint` → `npm run build`) per @.github/workflows/ci.yml; the build needs `SUPABASE_URL` and `SUPABASE_KEY` repository secrets.
