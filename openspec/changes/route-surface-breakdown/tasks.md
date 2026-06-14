## 1. Shared derivation + shape

- [ ] 1.1 Pure `surfaceBreakdown(coordinates, surfaces, highways)` helper: haversine-weight each segment into per-surface + per-waytype buckets → `{ surface: Record<string, number>, highway: Record<string, number> }` (metres). Unit-test.
- [ ] 1.2 `SurfaceBreakdownSchema` (Zod) in `@trails-cool/api` (record of category → metres ≥ 0, surface + highway).

## 2. Schema

- [ ] 2.1 Nullable `surfaceBreakdown` jsonb on `journal.routes` **and** `journal.activities`; `pnpm db:push`.

## 3. Path 1 — synchronous (Planner routes)

- [ ] 3.1 `apps/planner/.../api.save-to-journal`: compute the breakdown from the session `EnrichedRoute` (coords + surfaces + highways) and add `surfaceBreakdown` to the POST body.
- [ ] 3.2 Journal route callback validates the optional field and persists it (overwrite on re-save).

## 4. Render

- [ ] 4.1 Route + activity detail loaders expose `surfaceBreakdown`.
- [ ] 4.2 `SurfaceBreakdown` component: stacked bar per dimension (surface, waytype), `map-core` `SURFACE_COLORS`/`HIGHWAY_COLORS` (DEFAULT → "other"), legend category · km · % (largest first), hidden when empty. Mount on `routes.$id.tsx` and `activities.$id.tsx`.
- [ ] 4.3 i18n `journal.surface.*` (label + category names + "other") en + de.

## 5. Path 2 — async backfill + SSE

- [ ] 5.1 Journal-side Overpass client: `way[highway]` in bbox + parse (mirror the planner's `buildQuery`/`parseResponse` + rate-limit handling; route via the `/api/overpass` proxy).
- [ ] 5.2 Map-match helper: nearest OSM way per route segment → surface/highway; unmatched → unknown. Unit-test the matcher on a small fixture.
- [ ] 5.3 Typed `surface-backfill` pg-boss job (`{ kind, id }`): load geometry → skip if breakdown exists → Overpass → map-match → store. Idempotent, retry-safe, best-effort.
- [ ] 5.4 Enqueue the job after GPX import (Komoot/Garmin) and manual upload; add a one-off sweep entrypoint for pre-existing rows.
- [ ] 5.5 Emit a `surface_breakdown` SSE event (`{ kind, id }`) on completion; detail page subscribes (EventSource hook) and re-fetches the breakdown when it matches; optional "computing…" state.

## 6. Privacy

- [ ] 6.1 Document the backfill's Overpass lookup in the privacy manifest; route via the proxy (self-hostable Overpass is the long-term answer — see `docs/ideas/self-host-overpass`).

## 7. Tests & checks

- [ ] 7.1 Unit: `surfaceBreakdown` weighting; map-matcher nearest-way + unknown bucket.
- [ ] 7.2 Component (jsdom): bars/proportions, "other" bucket, hidden when empty.
- [ ] 7.3 E2E: a route/activity with a stored breakdown shows the bars (seed the breakdown to avoid a live Overpass call in CI).
- [ ] 7.4 `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green.
