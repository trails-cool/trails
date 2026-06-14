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

## 5. Path 2 — async backfill + SSE  (PHASE 2 — this PR)

- [x] 5.1 Journal-side Overpass client (`overpass-ways.server.ts`): `way[highway]` in bbox + `out tags geom`, configurable `OVERPASS_URLS` upstreams, timeout + oversized-bbox guard.
- [x] 5.2 Map-matcher (`surface-match.server.ts`, pure): nearest OSM way per segment → surface/highway; unmatched → unknown. Unit-tested.
- [x] 5.3 Typed `surface-backfill` pg-boss job: load geom → skip if breakdown exists → Overpass → match → `computeSurfaceBreakdown` → store. Idempotent, retry-safe, best-effort; registered in `server.ts`.
- [x] 5.4 Enqueued from `createActivity` (covers Komoot/Garmin imports + manual uploads) and owner-on-open in the route + activity detail loaders (covers non-Planner routes + pre-existing rows), deduped via `singletonKey`. (A dedicated sweep CLI is unneeded — on-open covers existing rows lazily.)
- [x] 5.5 Emits a `surface_breakdown` SSE event (`{ kind, id }`) to the owner; detail pages subscribe (`useSurfaceBackfillUpdates`) and `revalidate()` when it matches.

## 6. Privacy

- [x] 6.1 Documented the backfill's Overpass bbox lookup in the privacy manifest (DE + EN); `OVERPASS_URLS` can point at a self-hosted instance.

## 7. Tests & checks

- [x] 7.1 Unit: `computeSurfaceBreakdown` weighting + unknown bucket; `matchSurfaces` nearest-way + unknown bucket.
- [x] 7.2 Component (jsdom): bars/proportions, largest-first, hidden when empty/null.
- [x] 7.3 Job test (mocked Overpass/db/events): stores + emits; skips when breakdown exists or no ways. (A full live e2e is intentionally skipped — external Overpass + SSE timing are flaky; rendering is covered by the component test + browser, the job by its mocked test.)
- [x] 7.4 typecheck + lint + unit (map-core 36, journal 333) green; Phase 1 verified in the browser.
