<!-- PHASE 1 (this PR): synchronous Planner path + bars. PHASE 2 (follow-up):
     async Overpass backfill + SSE (sections 5–6, e2e in 7.3). -->

## 1. Shared derivation + shape

- [x] 1.1 `computeSurfaceBreakdown(coordinates, surfaces, highways)` in `@trails-cool/map-core` → `{ surface, highway }` metres; unit-tested.
- [x] 1.2 `SurfaceBreakdownSchema` (Zod) in `@trails-cool/api`.

## 2. Schema

- [x] 2.1 Nullable `surfaceBreakdown` jsonb on `journal.routes` **and** `journal.activities`; pushed to dev + e2e DBs.

## 3. Path 1 — synchronous (Planner routes)

- [x] 3.1 `SaveToJournalButton` computes the breakdown from `readComputedRoute` and sends it; `api.save-to-journal` forwards it (journal is the authoritative validator — planner has no `@trails-cool/api` dep).
- [x] 3.2 Journal route callback validates the optional field with `SurfaceBreakdownSchema` and persists via `updateRoute` (overwrite on re-save).

## 4. Render

- [x] 4.1 Route + activity detail loaders expose `surfaceBreakdown`.
- [x] 4.2 `SurfaceBreakdown` component (stacked bar per dimension, `map-core` palettes, legend category · % · km largest-first, unknown → "other", hidden when empty); mounted on `routes.$id.tsx` and `activities.$id.tsx`.
- [x] 4.3 i18n `journal.surface.*` (surface/waytype labels, common categories, "other") en + de.

## 5. Path 2 — async backfill + SSE  (PHASE 2 — follow-up PR)

- [ ] 5.1 Journal-side Overpass client: `way[highway]` in bbox + parse (mirror the planner's `buildQuery`/`parseResponse` + rate-limit handling; route via the `/api/overpass` proxy).
- [ ] 5.2 Map-match helper: nearest OSM way per route segment → surface/highway; unmatched → unknown. Unit-test the matcher on a small fixture.
- [ ] 5.3 Typed `surface-backfill` pg-boss job (`{ kind, id }`): load geometry → skip if breakdown exists → Overpass → map-match → store. Idempotent, retry-safe, best-effort.
- [ ] 5.4 Enqueue the job after GPX import (Komoot/Garmin) and manual upload; add a one-off sweep entrypoint for pre-existing rows.
- [ ] 5.5 Emit a `surface_breakdown` SSE event (`{ kind, id }`) on completion; detail page subscribes (EventSource hook) and re-fetches the breakdown when it matches; optional "computing…" state.

## 6. Privacy

- [ ] 6.1 Document the backfill's Overpass lookup in the privacy manifest; route via the proxy (self-hostable Overpass is the long-term answer — see `docs/ideas/self-host-overpass`).

## 7. Tests & checks

- [x] 7.1 Unit: `computeSurfaceBreakdown` weighting + unknown bucket (map-matcher unit is Phase 2).
- [x] 7.2 Component (jsdom): bars/proportions, largest-first, hidden when empty/null.
- [ ] 7.3 E2E: a route/activity with a stored breakdown shows the bars — **Phase 2** (needs a seed path; deferred to land with the backfill that creates the data). Phase 1 render verified in the browser + component test.
- [x] 7.4 Phase 1: typecheck + lint + unit (map-core 36, journal 326) green; verified in the browser.
