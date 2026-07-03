---
title: Anti-Corruption Layer for the Supabase client boundary
created: 2026-07-03
type: refactor-plan
---

# Anti-Corruption Layer: isolating `@supabase/supabase-js` / `@supabase/ssr`

## Step 0 — Context

**Stack** (`package.json:18-40`): Astro 6 SSR (`output: "server"`, deployed to Cloudflare
Workers), React 19 islands, TypeScript 5, Tailwind 4, `zod` for validation. External
service dependencies: `@supabase/supabase-js` + `@supabase/ssr` (auth + Postgres), no
direct LLM SDK — `openrouter` is a hand-rolled `fetch` client (no npm package for it at
all — see Step 1).

**Layers actually present in this repo** (per `AGENTS.md:16` and observed structure):

| Layer | Location |
|---|---|
| UI / presentation | `src/pages/*.astro` (SSR frontmatter + markup), `src/components/**/*.tsx` (React islands) |
| API | `src/pages/api/**/*.ts` (Astro `APIRoute` handlers) |
| Cross-cutting | `src/middleware.ts` (per-request auth resolution + route gating) |
| Service / domain logic | `src/lib/services/`, `src/lib/practice/` |
| Data access | `src/lib/db/` |
| Persistence (external) | Supabase (Postgres + Auth), via `src/lib/supabase.ts` |
| Shared contract types | `src/types.ts`, `src/env.d.ts` (`App.Locals`) |

**Declared-swappable statements found** (`context/foundation/prd.md`, `README.md`,
`context/foundation/tech-stack.md` grepped for swap/replaceable/vendor/abstract — see
Step 3 for the one real hit). No document says "Supabase must be swappable." One
document *does* declare model-swappability for the LLM call — relevant context for
Step 2's comparison, quoted in Step 3.

## Step 1 — Identify leaking dependencies

Two candidates were checked with `Grep`, not assumed.

### Candidate 1: `@supabase/supabase-js` + `@supabase/ssr`

`Grep "supabase|Supabase|SupabaseClient|@/db/database.types" src/` returns 17 files.
Filtering out decorative string/comment matches (a UI label `"Supabase"` in
`src/lib/config-status.ts:18` and a doc-comment reference in
`src/lib/services/openrouter.ts:25`, neither of which import the package), the real
call sites that import the package or the raw-client wrapper and touch its shape are:

| # | File:line | Layer | What it does with the raw client |
|---|---|---|---|
| 1 | `src/lib/supabase.ts:1,4,6,10` | Persistence adapter (correct home) | `createServerClient<Database>(...)` from `@supabase/ssr` |
| 2 | `src/env.d.ts:3` | Global framework contract | `App.Locals.user: import("@supabase/supabase-js").User \| null` |
| 3 | `src/middleware.ts:2,7,9-13` | Cross-cutting | imports `createClient`, calls `supabase.auth.getUser()` |
| 4 | `src/pages/api/auth/signin.ts:2,9,13,15-16` | API | imports `createClient`, calls `supabase.auth.signInWithPassword()`, forwards raw `error.message` to the redirect URL |
| 5 | `src/pages/api/auth/signup.ts:2,9,13,15-16` | API | imports `createClient`, calls `supabase.auth.signUp()`, forwards raw `error.message` |
| 6 | `src/pages/api/auth/signout.ts:2,5,7` | API | imports `createClient`, calls `supabase.auth.signOut()` |
| 7 | `src/pages/api/practice/sessions.ts:3,67-72` | API | imports `createClient`, passes the raw client into `saveSession(supabase, ...)` |
| 8 | `src/pages/api/practice/sessions/[id].ts:2,28-31` | API | imports `createClient`, passes the raw client into `deleteSession(supabase, ...)` |
| 9 | `src/pages/history.astro:5,11,13` | UI (Astro SSR page) | imports `createClient`, passes into `listSessions(supabase, ...)` |
| 10 | `src/pages/history/[id].astro:5,12,14` | UI (Astro SSR page) | imports `createClient`, passes into `getSession(supabase, ...)` |
| 11 | `src/pages/dashboard.astro:5,12,16` | UI (Astro SSR page) | imports `createClient`, passes into `listSessionsFull(supabase, ...)` |
| 12 | `src/lib/db/sessions.ts:1,14,63-140` | Data access | `type Client = SupabaseClient<Database>`; every exported function (`saveSession`, `listSessions`, `listSessionsFull`, `getSession`, `deleteSession`) takes `client: Client` as a parameter, forcing every caller above to construct one |

That is **the same package imported directly into three different layers** — UI pages
(9, 10, 11), API routes (4-8), and cross-cutting middleware (3) — plus a fourth
crossing into the global type contract (2). This matches the task's signal list
exactly: same-package-multiple-layers, duplicated object reconstruction (Step 3),
and a vendor type in a shared contract (`App.Locals.user`).

No dangerous *client-bundle* crossing was found: `Grep "supabase" src/components/`
returns zero matches — no React island imports the package, so it never reaches the
browser bundle. The leak is entirely server-side, across SSR layers.

### Candidate 2: OpenRouter integration

`Grep "openrouter|OpenRouter" src/` shows the integration is already narrow:
`src/lib/services/openrouter.ts` exports `createOpenRouterClient(): OpenRouterClient | null`
where `OpenRouterClient` is a **narrow port**, not the raw HTTP envelope:

```12:21:src/lib/services/openrouter.ts
export interface OpenRouterClient {
  /** Send a chat completion request and return the assistant message content as raw text. */
  chat(options: ChatCompletionOptions): Promise<string>;
}
```

The raw OpenRouter JSON envelope (`{choices:[{message:{content}}]}`) is parsed and
discarded inside `chat()` (`src/lib/services/openrouter.ts:55-64`) — callers only ever
see a `string`. The only consumer is `src/lib/services/question-generator.ts:1,70,84`.
`src/lib/config-status.ts:25-28` and `src/components/practice/PracticeGenerator.tsx:29`
mention "OpenRouter" only in user-facing copy strings, never import the module or its
types. There is no npm package for OpenRouter at all — it's a hand-rolled `fetch`
client, so there is no vendor SDK shape to leak in the first place. **This candidate is
not a real leak** — it already looks like the target state Step 4 designs for Supabase.

## Step 2 — Classify and pick #1

| Factor | Supabase (`createClient` / `SupabaseClient` / `User`) | OpenRouter |
|---|---|---|
| (a) Layers/files touched | 4 layers (UI, API, middleware, global types), 9 call sites + 1 partially-ACL'd repository (12 files total) | 1 layer (service), 2 files, both already narrow |
| (b) Risk/cost of swapping today | High — every page/route/middleware would need editing; the raw client's full surface (`.auth.*`, `.from(...)`, cookies plumbing) is visible everywhere | Low — swap is already isolated to `openrouter.ts` + one constant in `question-generator.ts` |
| (c) Stated-intent-vs-code gap | The project's **own precedent**, set by `src/lib/supabase.ts` and explicitly *mirrored* by `openrouter.ts`'s docstring ("mirroring `src/lib/supabase.ts` so callers degrade gracefully" — `src/lib/services/openrouter.ts:24-27`), commits to a null-safe **factory** pattern. But the mirror (`openrouter.ts`) narrowed its factory's return type to a single-method port (`OpenRouterClient.chat()`), while the original (`supabase.ts`) hands back the **entire raw SDK object**. The precedent-setter doesn't follow the discipline its own copy does. | Docs explicitly claim swappability — "OpenRouter … model-agnostic so models can be swapped to tune accuracy/latency/cost" (`context/archive/2026-06-18-question-generation-engine/plan-brief.md:21`) and the code's own comment repeats it — "Fast, capable default; OpenRouter lets this be swapped without code changes." (`src/lib/services/question-generator.ts:5`). Code already honors this claim — no gap. |

**Verdict: Supabase is the worst leak.** It is wider (4 layers vs. 1), riskier to
change (9+ call sites vs. 2), and — while no document says "Supabase must be
swappable" — the codebase's own internal convention for how external dependencies
should be wrapped (a null-safe factory returning a *narrow* port) is violated by the
very file (`supabase.ts`) that convention is credited to, while its copy
(`openrouter.ts`) gets it right. OpenRouter was checked and ruled out: it is already
close to the design Step 4 proposes.

## Step 3 — Diagnose

### 3a. Duplicated reconstruction of the library's client object

The exact same two-argument call is repeated verbatim at every one of the 9 call
sites found in Step 1, with the argument names varying only by whether the call site
is an `APIRoute` (`context.request.headers, context.cookies`) or an `.astro` page
(`Astro.request.headers, Astro.cookies`):

```7:9:src/middleware.ts
export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);
```

```9:9:src/pages/api/auth/signin.ts
  const supabase = createClient(context.request.headers, context.cookies);
```

```9:9:src/pages/api/auth/signup.ts
  const supabase = createClient(context.request.headers, context.cookies);
```

```5:5:src/pages/api/auth/signout.ts
  const supabase = createClient(context.request.headers, context.cookies);
```

```67:67:src/pages/api/practice/sessions.ts
  const supabase = createClient(context.request.headers, context.cookies);
```

```28:28:src/pages/api/practice/sessions/[id].ts
  const supabase = createClient(context.request.headers, context.cookies);
```

```11:11:src/pages/history.astro
const supabase = createClient(Astro.request.headers, Astro.cookies);
```

```12:12:src/pages/history/[id].astro
const supabase = createClient(Astro.request.headers, Astro.cookies);
```

```12:12:src/pages/dashboard.astro
const supabase = createClient(Astro.request.headers, Astro.cookies);
```

**The dangerous form of this duplication**: on every request to a protected page
(`/dashboard`, `/history`, `/history/[id]`), `src/middleware.ts:7` *already*
constructs a Supabase client and resolves the session via `.auth.getUser()`
(`src/middleware.ts:9-13`) to populate `context.locals.user`. Then the page itself
(e.g. `src/pages/dashboard.astro:12`) constructs a **second, independent** client for
the *same request* to do its data query — re-parsing the `Cookie` header a second
time (`src/lib/supabase.ts:13`) and paying a second cookie/session-refresh setup for
work middleware already did. This is not just style duplication, it is duplicated
runtime cost per request, and it is exactly the "duplicated reconstruction of the
library's objects" signal called out in the task brief.

Six of the nine sites additionally duplicate a null-guard with a **different,
hand-written message each time** (own diagnosis of inconsistent error-shape
handling, a smaller but related smell):

- `"Supabase is not configured"` — `src/pages/api/auth/signin.ts:11`, `signup.ts:11`
- `"Storage is not configured."` — `src/pages/api/practice/sessions.ts:69`, `sessions/[id].ts:30`
- silent `if (supabase) {...}` with no message — `src/pages/api/auth/signout.ts:6`
- silent `supabase && user ? ... : []` / `: null` — `history.astro:13`, `history/[id].astro:14`, `dashboard.astro:16`

### 3b. Vendor type in the shared framework contract

```1:5:src/env.d.ts
declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
  }
}
```

Every one of the 12+ files above (and every future route) that reads
`context.locals.user` / `Astro.locals.user` is contractually bound to Supabase's
`User` shape (`id`, `email`, `user_metadata`, `app_metadata`, `identities`, …) even
though the app only ever uses `user.id` (`src/pages/api/practice/sessions.ts:72`,
`src/pages/api/practice/sessions/[id].ts:33`, `src/pages/history.astro:13`,
`src/pages/history/[id].astro:14`, `src/pages/dashboard.astro:16`). "The current
user" is a domain concept (FR-001, Access Control section of
`context/foundation/prd.md:143-149`: "every authenticated user is a learner") that is
represented app-wide by a raw vendor SDK type instead of a domain value object.

### 3c. The data-access layer's own public contract leaks the vendor type

```1:14:src/lib/db/sessions.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import type { SavedSession, SavedSessionSummary, SessionPayload, SessionScore } from "@/types";
...
type Client = SupabaseClient<Database>;
```

`saveSession`, `listSessions`, `listSessionsFull`, `getSession`, `deleteSession`
(`src/lib/db/sessions.ts:63,84,99,114,133`) all take `client: Client` as their first
parameter. This file already does real ACL work — it maps rows to DTOs
(`rowToSummary`/`rowToSaved`, `src/lib/db/sessions.ts:46-61`) and none of its *return*
types leak Supabase shapes. But its *public signature* still forces every caller to
know how to build a `SupabaseClient<Database>` — which is exactly why the leak
propagates outward into UI pages and API routes instead of stopping at this file.

### 3d. No documented swap intent for Supabase specifically — but a documented factory convention it violates

`Grep "swap|replaceable|vendor|provider-agnostic|abstract|interchangeable" -i` across
`context/foundation/*.md` and `README.md` returns **zero hits** for Supabase — the
project never promises Supabase itself is swappable, so this is not a case of
"broken promise," it's a case of an **internal convention the code sets for itself
and then breaks**. The convention is stated explicitly in the F-01 plan:

```12:12:context/archive/2026-06-18-question-generation-engine/plan.md
- **Service-factory pattern**: `src/lib/supabase.ts` exposes `createClient(...)` that returns `null` when its secrets are absent, rather than throwing ([src/lib/supabase.ts:5-8](../../../src/lib/supabase.ts#L5-L8)).
```

```80:80:context/archive/2026-06-18-question-generation-engine/plan.md
**Contract**: Export a factory (e.g. `createOpenRouterClient()`) that reads `OPENROUTER_API_KEY` from `astro:env/server`, returns `null` if missing, otherwise returns a thin object exposing a chat/completion call over `fetch` (model + messages in, raw text out). Mirrors the null-guard shape of `src/lib/supabase.ts`.
```

The plan explicitly designed `openrouter.ts` to "mirror" `supabase.ts`'s null-guard
*shape* — and delivered a **narrow port** (`OpenRouterClient.chat()`, Step 1). The
original `supabase.ts` never narrowed its own return type; it returns the full SDK
client. AGENTS.md documents `src/middleware.ts` as the place that "resolves the
user" (`AGENTS.md:16`) — establishing middleware as the intended composition point
for auth — but no such composition point exists for data access, so every route
re-derives its own client instead of reusing one.

## Step 4 — Design the Anti-Corruption Layer

Two domain concepts are introduced, each with its own port + adapter, plus one value
object. All Supabase-shaped knowledge collapses into three new files (an `auth/`
module) and one converted file (`db/sessions.ts` → its adapter), composed once per
request in `middleware.ts`.

### 4a. Domain value object — `AuthUser`

**File**: `src/lib/auth/auth-user.ts` (new)

```ts
/** The authenticated learner, in domain terms — never the vendor `User` shape. */
export interface AuthUser {
  id: string;
  email: string | null;
}

/** Sole place that knows how to read a Supabase `User` into the domain shape. */
export function toAuthUser(supabaseUser: { id: string; email?: string | null }): AuthUser {
  return { id: supabaseUser.id, email: supabaseUser.email ?? null };
}
```

Only `src/lib/auth/supabase-auth-gateway.ts` (Step 4b) imports the Supabase `User`
type and calls `toAuthUser`. Everywhere else in the app — `App.Locals`, every API
route, every `.astro` page — references only `AuthUser`.

### 4b. Port + adapter — authentication

**File**: `src/lib/auth/auth-gateway.ts` (new) — the narrow port, domain language only:

```ts
export type AuthErrorCode = "invalid-credentials" | "email-in-use" | "weak-password" | "unknown";
export type AuthOutcome = { ok: true } | { ok: false; error: AuthErrorCode; message: string };

export interface AuthGateway {
  getCurrentUser(): Promise<AuthUser | null>;
  signInWithPassword(email: string, password: string): Promise<AuthOutcome>;
  signUpWithPassword(email: string, password: string): Promise<AuthOutcome>;
  signOut(): Promise<void>;
}
```

**File**: `src/lib/auth/supabase-auth-gateway.ts` (new) — the ONLY file besides
`supabase.ts` itself that imports `@supabase/supabase-js` / `@supabase/ssr` for auth:

```ts
import type { SupabaseClient } from "@supabase/supabase-js"; // sole import site (with supabase.ts)
import type { Database } from "@/db/database.types";
import type { AuthGateway, AuthOutcome, AuthErrorCode } from "./auth-gateway";
import { toAuthUser } from "./auth-user";

/** Maps Supabase's AuthApiError.code to a domain error code + a user-safe message.
 *  Decision encoded HERE, not in any route: unknown/unexpected codes never leak the
 *  raw vendor message to the user-facing redirect URL. */
function mapAuthError(error: { code?: string; message: string }): { code: AuthErrorCode; message: string } {
  switch (error.code) {
    case "invalid_credentials":
      return { code: "invalid-credentials", message: "Incorrect email or password." };
    case "user_already_exists":
      return { code: "email-in-use", message: "An account with this email already exists." };
    case "weak_password":
      return { code: "weak-password", message: "Password is too weak." };
    default:
      return { code: "unknown", message: "Something went wrong. Please try again." };
  }
}

export function createSupabaseAuthGateway(client: SupabaseClient<Database>): AuthGateway {
  return {
    async getCurrentUser() {
      const { data } = await client.auth.getUser();
      return data.user ? toAuthUser(data.user) : null;
    },
    async signInWithPassword(email, password): Promise<AuthOutcome> {
      const { error } = await client.auth.signInWithPassword({ email, password });
      return error ? { ok: false, ...mapAuthError(error) } : { ok: true };
    },
    async signUpWithPassword(email, password): Promise<AuthOutcome> {
      const { error } = await client.auth.signUp({ email, password });
      return error ? { ok: false, ...mapAuthError(error) } : { ok: true };
    },
    async signOut() {
      await client.auth.signOut();
    },
  };
}
```

*(Supabase's `AuthApiError.code` values above — `invalid_credentials`,
`user_already_exists`, `weak_password` — are Supabase's documented stable error
codes; if a future SDK major version renames them, only this `switch` needs an
update — see Step 5's "resolve open questions" note.)*

### 4c. Port + adapter — practice-session persistence

**File**: `src/lib/db/sessions-repository.ts` (new) — the port, same operations
`sessions.ts` already has, minus the vendor parameter:

```ts
import type { SaveSessionInput, SaveResult, DeleteResult } from "./session-types"; // moved out of sessions.ts, unchanged
import type { SavedSession, SavedSessionSummary } from "@/types";

export interface PracticeSessionsRepository {
  save(userId: string, input: SaveSessionInput): Promise<SaveResult>;
  listSummaries(userId: string): Promise<SavedSessionSummary[]>;
  listFull(userId: string): Promise<SavedSession[]>;
  getById(userId: string, id: string): Promise<SavedSession | null>;
  delete(userId: string, id: string): Promise<DeleteResult>;
}
```

**File**: `src/lib/db/supabase-sessions-repository.ts` (renamed from today's
`src/lib/db/sessions.ts`) — the adapter; everything Step 3c already does
(`rowToSummary`/`rowToSaved`, the `.from("practice_sessions")` calls) stays here
verbatim, just wrapped in a factory instead of exported as free functions taking a
client parameter:

```ts
import type { SupabaseClient } from "@supabase/supabase-js"; // sole import site (with supabase.ts)
import type { Database } from "@/db/database.types";
import type { PracticeSessionsRepository } from "./sessions-repository";
// rowToSummary / rowToSaved / SUMMARY_COLUMNS / FULL_COLUMNS unchanged from today's sessions.ts

export function createSupabaseSessionsRepository(client: SupabaseClient<Database>): PracticeSessionsRepository {
  return {
    async save(userId, input) { /* body unchanged from today's saveSession, using `client` from closure */ },
    async listSummaries(userId) { /* body unchanged from today's listSessions */ },
    async listFull(userId) { /* body unchanged from today's listSessionsFull */ },
    async getById(userId, id) { /* body unchanged from today's getSession */ },
    async delete(userId, id) { /* body unchanged from today's deleteSession */ },
  };
}
```

No query logic changes — this is a reshaping of the existing, already-decent DTO
mapping into a port/adapter pair, not a rewrite.

### 4d. Composition root — `src/middleware.ts`

Middleware already builds one Supabase client per request (`src/middleware.ts:7`) to
resolve `context.locals.user`. It becomes the **single** place that does so, and
additionally builds the two adapters from that one client, so no downstream file
needs to build (or know how to build) anything:

```ts
import { createClient } from "@/lib/supabase"; // unchanged low-level factory
import { createSupabaseAuthGateway } from "@/lib/auth/supabase-auth-gateway";
import { createSupabaseSessionsRepository } from "@/lib/db/supabase-sessions-repository";

export const onRequest = defineMiddleware(async (context, next) => {
  const client = createClient(context.request.headers, context.cookies);
  const authGateway = client ? createSupabaseAuthGateway(client) : null;

  context.locals.authGateway = authGateway;
  context.locals.sessionsRepo = client ? createSupabaseSessionsRepository(client) : null;
  context.locals.user = authGateway ? await authGateway.getCurrentUser() : null;

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route)) && !context.locals.user) {
    return context.redirect("/auth/signin");
  }
  return next();
});
```

**File**: `src/env.d.ts` — the contract now names only domain/port types:

```ts
import type { AuthUser } from "@/lib/auth/auth-user";
import type { AuthGateway } from "@/lib/auth/auth-gateway";
import type { PracticeSessionsRepository } from "@/lib/db/sessions-repository";

declare namespace App {
  interface Locals {
    user: AuthUser | null;
    authGateway: AuthGateway | null;
    sessionsRepo: PracticeSessionsRepository | null;
  }
}
```

## Step 5 — Proof of isolation + before/after

### Proof: a provider swap only touches the ACL

If Supabase Auth/Postgres were replaced (e.g. with Clerk + PlanetScale), the files
that would need to change are exactly:

- `src/lib/supabase.ts` (or its replacement low-level client factory)
- `src/lib/auth/supabase-auth-gateway.ts` → a new `clerk-auth-gateway.ts` implementing the same `AuthGateway` port
- `src/lib/db/supabase-sessions-repository.ts` → a new `planetscale-sessions-repository.ts` implementing the same `PracticeSessionsRepository` port
- `src/middleware.ts` — swap two factory-function imports (still the sole composition root)
- `src/db/database.types.ts` — replaced by the new backend's generated types (consumed only by the adapter above)

Files that would need **zero** changes: every `.astro` page (`dashboard.astro`,
`history.astro`, `history/[id].astro`), every API route (`signin.ts`, `signup.ts`,
`signout.ts`, `practice/sessions.ts`, `practice/sessions/[id].ts`), `src/env.d.ts`
(names only domain types, already provider-neutral), and every table/UI component
downstream (`HistoryList.tsx`, `SavedSessionView.tsx`, `ProgressDashboard.tsx`) — none
of them ever imported a Supabase type to begin with once this lands.

### Before / after at each duplicated site

**`src/pages/dashboard.astro` — before** (`:5,12,16`):
```astro
import { createClient } from "@/lib/supabase";
import { listSessionsFull } from "@/lib/db/sessions";
...
const supabase = createClient(Astro.request.headers, Astro.cookies);
const fullSessions = supabase && user ? await listSessionsFull(supabase, user.id) : [];
```

**after** — no Supabase import, no client construction, second per-request client
gone entirely:
```astro
const { user, sessionsRepo } = Astro.locals;
const fullSessions = sessionsRepo && user ? await sessionsRepo.listFull(user.id) : [];
```

**`src/pages/api/auth/signin.ts` — before** (`:2,9,13,15-16`):
```ts
import { createClient } from "@/lib/supabase";
...
const supabase = createClient(context.request.headers, context.cookies);
if (!supabase) return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
```

**after** — no vendor error text ever reaches the URL; the "not configured" message
is written once, in the ACL, instead of retyped per route:
```ts
const { authGateway } = context.locals;
if (!authGateway) return context.redirect(`/auth/signin?error=${encodeURIComponent("Sign-in is not configured")}`);
const result = await authGateway.signInWithPassword(email, password);
if (!result.ok) return context.redirect(`/auth/signin?error=${encodeURIComponent(result.message)}`);
```

**`src/lib/db/sessions.ts` (`saveSession`) — before** (`:63-82`), signature forces
every caller to hand it a raw client:
```ts
export async function saveSession(client: Client, userId: string, input: SaveSessionInput): Promise<SaveResult>
```

**after** (`supabase-sessions-repository.ts`), the vendor type is closed over once,
inside the adapter — the port method callers see takes no client at all:
```ts
save(userId: string, input: SaveSessionInput): Promise<SaveResult> // on PracticeSessionsRepository
```

### UI receiving ready domain data, not the raw library object

`src/pages/dashboard.astro` today constructs a `SupabaseClient<Database>` in its own
frontmatter (`:12`) purely to hand it to `listSessionsFull`. After the refactor the
page never sees anything Supabase-shaped — it reads `Astro.locals.sessionsRepo`, a
port whose methods already return `SavedSession[]` DTOs (`src/types.ts:118-120`,
unchanged). The same applies to `history.astro` and `history/[id].astro`. This is the
"UI layer receiving ready domain data" the task asks to demonstrate — it is already
true for the *return* values today (Step 3c noted `sessions.ts`'s mappers are
correct); the fix is closing the *input* side, which is where the vendor type was
still crossing into the UI layer.

### Resolving the open question — auth error mapping

Supabase JS v2's `AuthApiError` exposes a stable, documented `.code` string (e.g.
`invalid_credentials`, `user_already_exists`, `weak_password`) alongside its
human-readable `.message`, which is intended for programmatic branching rather than
display. Today's code (`signin.ts:16`, `signup.ts:16`) displays `.message` directly,
coupling the sign-in page's copy to whatever wording Supabase's SDK chooses to ship.
The decision — map `.code` to a small closed domain enum with the app's own copy, and
never forward the vendor message string — is encoded in
`src/lib/auth/supabase-auth-gateway.ts`'s `mapAuthError` (Step 4b), **in the ACL**,
not in `signin.ts`/`signup.ts`. If Supabase ever adds new error codes, only that one
`switch` needs a new `case`; the `default: "unknown"` branch already keeps this safe
today (falls back to a generic, safe message instead of throwing or leaking `.message`).

## Step 6 — Verification and phased plan

### Success criterion

After the refactor, `Grep "@supabase/supabase-js|@supabase/ssr" src/` should return
matches in exactly:

- `src/lib/supabase.ts` (low-level raw-client factory — the adapter's foundation)
- `src/lib/auth/supabase-auth-gateway.ts` (new)
- `src/lib/db/supabase-sessions-repository.ts` (renamed from `sessions.ts`)

...and nowhere else. `src/db/database.types.ts` needs no change (it has no `import`
statement today — confirmed by `Grep "^import" src/db/database.types.ts` returning no
match — it is pure generated types, already adapter-only by construction).

**Files that know the dependency today** (12, per Step 1's table): `src/lib/supabase.ts`,
`src/env.d.ts`, `src/middleware.ts`, `src/pages/api/auth/signin.ts`,
`src/pages/api/auth/signup.ts`, `src/pages/api/auth/signout.ts`,
`src/pages/api/practice/sessions.ts`, `src/pages/api/practice/sessions/[id].ts`,
`src/pages/history.astro`, `src/pages/history/[id].astro`, `src/pages/dashboard.astro`,
`src/lib/db/sessions.ts`.

**Files that would stop knowing it after the refactor** (9 of the 12): `src/env.d.ts`,
`src/middleware.ts` (imports only the two adapter factory functions, not the
package), `signin.ts`, `signup.ts`, `signout.ts`, `practice/sessions.ts`,
`practice/sessions/[id].ts`, `history.astro`, `history/[id].astro`, `dashboard.astro`.

**Files that keep knowing it, by design** (3): `src/lib/supabase.ts`,
`src/lib/auth/supabase-auth-gateway.ts`, `src/lib/db/supabase-sessions-repository.ts`
— all three inside the intended ACL boundary (`src/lib/supabase.ts` at the root,
`src/lib/auth/` and the `supabase-*` adapter in `src/lib/db/`).

An automated backstop for this criterion: add a `dependency-cruiser` rule to
`.dependency-cruiser.cjs` (which today only has a `no-circular` rule,
`.dependency-cruiser.cjs:3-11`) forbidding any module outside
`^src/lib/(supabase\.ts|auth/supabase-|db/supabase-)` from matching
`to: { path: "^@supabase" }` — this turns Step 6's grep criterion into a CI-enforced
gate (`npx depcruise src --config .dependency-cruiser.cjs`), consistent with the
project's existing tooling rather than a new one.

### Phased plan

**Phase 1 — Auth port + adapter (read path only)**
- Add `src/lib/auth/auth-user.ts`, `auth-gateway.ts`, `supabase-auth-gateway.ts`.
- Update `src/env.d.ts` to type `Locals.user` as `AuthUser` and add `Locals.authGateway`.
- Update `src/middleware.ts` to build the gateway once and populate both locals.
- Leave all API routes/pages unchanged for now (they still read `context.locals.user`,
  whose *shape* now changes from vendor `User` to `AuthUser` — a compile-time check
  that every existing `.id`/`.email` access site still type-checks).
- **Automated verification**: `npm run lint` (type-checked ESLint catches any
  lingering `.user_metadata`/vendor-field access), `npm run build`, `npm run test`
  (existing route tests mock `context.locals.user` as `{id, email}` objects already —
  `sessions.test.ts:19`, `sessions/[id].test.ts:18` — so they should pass unchanged).
- **Manual verification**: sign in, confirm `/dashboard` and `/history` still gate correctly.

**Phase 2 — Auth port, write path (signin/signup/signout routes)**
- Rewrite `signin.ts`, `signup.ts`, `signout.ts` to use `context.locals.authGateway`
  instead of constructing their own client (Step 5 before/after).
- **Automated verification**: `npm run lint`, `npm run build`, `npm run test`
  (add/adjust unit tests for `mapAuthError`'s branches: known codes + `default`).
- **Manual verification**: sign-in with wrong password shows the new mapped message,
  not a raw Supabase string; sign-up with a duplicate email shows the mapped message;
  sign-out still clears the session.

**Phase 3 — Sessions repository port + adapter**
- Add `src/lib/db/sessions-repository.ts` (port); rename `src/lib/db/sessions.ts` →
  `src/lib/db/supabase-sessions-repository.ts` and convert its free functions into
  the `createSupabaseSessionsRepository(client)` factory (Step 4c) — row
  mappers/query bodies unchanged.
- Add `Locals.sessionsRepo` in `env.d.ts`; build it in `middleware.ts` from the same
  client already constructed in Phase 1.
- **Automated verification**: `npm run lint`, `npm run build`, `npm run test` — port
  existing `sessions.test.ts`/`sessions/[id].test.ts` mocks from
  `vi.mock("@/lib/supabase", ...)` to mocking `context.locals.sessionsRepo` directly
  (simpler mocks, no client stand-in needed at all).
- **Manual verification**: generate → save → dashboard/history/detail/delete flow
  end-to-end unchanged from a user's perspective (per `README.md:93-97`'s Architecture
  section and the existing `tests/e2e/practice-flow.spec.ts` golden path).

**Phase 4 — Call-site cutover (API routes + Astro pages)**
- Update `practice/sessions.ts`, `practice/sessions/[id].ts`,
  `history.astro`, `history/[id].astro`, `dashboard.astro` to use
  `context.locals.sessionsRepo` / `Astro.locals.sessionsRepo` (Step 5 before/after);
  remove their `createClient`/`@/lib/supabase` imports.
- **Automated verification**: `npm run lint`, `npm run build`, `npm run test`,
  `npm run test:e2e` (existing Playwright golden path + any negative-path specs).
- **Manual verification**: re-run the full user journey once (sign in → generate →
  answer → save → dashboard trend → history revisit → delete).

**Phase 5 — Enforcement**
- Add the `dependency-cruiser` rule described above to `.dependency-cruiser.cjs`; wire
  `npx depcruise src --config .dependency-cruiser.cjs` into CI (or the existing lint
  step) so a future PR that imports `@supabase/*` outside the ACL fails the build.
- **Automated verification**: `npx depcruise src --config .dependency-cruiser.cjs`
  passes on the refactored tree; a scratch violation (temporarily importing
  `SupabaseClient` in, say, `dashboard.astro`) is confirmed to fail the rule, then
  reverted.
- **Manual verification**: `Grep "@supabase/supabase-js|@supabase/ssr" src/` by hand
  confirms exactly the 3 files listed in the Success Criterion above.

Each phase is independently shippable and revertible; Phases 1-2 (auth) and 3-4
(sessions) are two independent verticals and could be reordered or done by different
people without blocking each other — only Phase 5 depends on all prior phases being
complete.
