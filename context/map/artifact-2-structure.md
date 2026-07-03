# Artifact 2 — Structure (dependency-graph signal)

Source: `dependency-cruiser` (`.dependency-cruiser.cjs`) run against `src/`, TS-aware,
55 modules resolved. Full raw graph: `context/map/_depcruise-raw.json` (git-ignored
scratch, not part of the submitted artifact set — regenerate with
`npx depcruise src --config .dependency-cruiser.cjs --output-type json`).

## Cycles

**None.** 0 of 55 modules participate in a circular dependency. For a 2.5-week-old
codebase this is expected, not yet a signal of discipline under pressure — re-run this
check after the codebase has had a few refactors.

## Folder-level dependency edges (weight = number of import edges)

```
src/components/practice → src/types.ts                 (6)
src/pages/api           → src/lib/supabase.ts           (5)
src/lib/practice        → src/types.ts                  (4)
src/pages/api           → src/lib/services              (4)
src/components/practice → src/lib/practice               (3)
src/components/practice → src/components/ui              (2)
src/components/practice → src/lib/utils.ts               (2)
src/lib/db              → src/types.ts                   (2)
src/pages/api           → src/lib/db                     (2)
src/components/auth     → src/lib/utils.ts / src/components/ui  (1 each)
src/components/dashboard → src/lib/practice / src/types.ts       (1 each)
src/middleware.ts       → src/lib/supabase.ts             (1)
```

## Coupling metrics (Ca = afferent/incoming, Ce = efferent/outgoing, I = Ce/(Ca+Ce))

| Module/folder | Ca | Ce | Instability | Reading |
|---|---|---|---|---|
| `src/types.ts` | 15 | 1 | 0.06 | **Shared kernel.** Almost everything depends on it, it depends on almost nothing. Highest-risk file to change carelessly — one bad edit ripples everywhere. |
| `src/lib/supabase.ts` | 6 | 2 | 0.25 | Stable data-access hub (pages/api and middleware both route through it). |
| `src/lib/utils.ts` | 4 | 0 | 0.00 | Pure-leaf utility, safe to depend on. |
| `src/lib/services` | 5 | 2 | 0.29 | Stable-ish service layer, consumed by API routes. |
| `src/lib/practice` | 5 | 4 | 0.44 | Mixed — both depended-on and depends on `types.ts`; the practice domain's core logic. |
| `src/lib/db` | 2 | 3 | 0.60 | Leans toward the unstable side — depends on generated `database.types.ts` + `types.ts`. |
| `src/components/ui` | 3 | 1 | 0.25 | Stable-ish shared UI primitives. |
| `src/components/practice` | 0 | 14 | 1.00 | Fully unstable leaf, as expected for a UI layer — nothing depends on it, it depends on the domain below. |
| `src/pages/api` | 0 | 13 | 1.00 | Fully unstable leaf — API routes are the outermost layer, correctly depending inward. |
| `src/middleware.ts` | 0 | 2 | 1.00 | Leaf, as expected for framework-invoked entrypoints. |

## Layer-boundary read

The instability gradient is textbook-clean: `types.ts` / `utils.ts` (I≈0) → service/db
layer (I≈0.3–0.6) → components/pages/middleware (I=1.0). Nothing in `src/lib/**`
imports from `src/components/**` or `src/pages/**` — the dependency arrows all point
inward, toward the stable core. **No layering violation found.**

## Risk reading for the map

`src/types.ts` is the one file where "small change, big blast radius" is real (Ca=15).
Any refactor plan touching shared types should budget extra verification time there —
this feeds directly into the risk-zones section of the repo map.
