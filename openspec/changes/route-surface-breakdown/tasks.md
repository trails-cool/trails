## 1. Breakdown derivation (shared, pure)

- [ ] 1.1 Add a pure `surfaceBreakdown(coordinates, surfaces, highways)` helper (in `@trails-cool/map-core` or a planner lib): sum haversine segment lengths into per-surface and per-waytype buckets → `{ surface: Record<string, number>, highway: Record<string, number> }` (metres). Unit-test it.
- [ ] 1.2 Define the shared wire shape (Zod) for the breakdown in `@trails-cool/api` (`SurfaceBreakdownSchema`, all values ≥ 0).

## 2. Capture at save (Planner → Journal)

- [ ] 2.1 In `apps/planner/.../api.save-to-journal`, read the session `EnrichedRoute` (coordinates + surfaces + highways), compute the breakdown, and add `surfaceBreakdown` to the POST body.
- [ ] 2.2 Journal callback (`api.routes.$id.callback`) validates the optional `surfaceBreakdown` and persists it; re-save overwrites.

## 3. Schema

- [ ] 3.1 Add nullable `surfaceBreakdown` jsonb to `journal.routes`; `pnpm db:push`.

## 4. Render

- [ ] 4.1 Route detail loader exposes `surfaceBreakdown`.
- [ ] 4.2 `SurfaceBreakdown` component: stacked proportion bar per dimension (surface, waytype), segments coloured via `SURFACE_COLORS`/`HIGHWAY_COLORS` (DEFAULT for unknown), legend with category · km · % (largest first), unknown → "other"; hidden when empty. Mount on `routes.$id.tsx`.
- [ ] 4.3 i18n `journal.surface.*` (label + category names + "other") en + de.

## 5. Tests & checks

- [ ] 5.1 Unit: `surfaceBreakdown` (distance weighting, multiple surfaces, unknown bucket).
- [ ] 5.2 Component (jsdom): bars render with correct proportions; "other" for unknowns; hidden when empty.
- [ ] 5.3 E2E: a Planner-saved route with waytags shows the breakdown bars on its detail page (or assert via a seeded route if the planner round-trip is too heavy for e2e).
- [ ] 5.4 `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green.
