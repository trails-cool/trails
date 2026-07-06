## Why

The planner's POI overlays depend on a third-party Overpass instance (`overpass.private.coffee` behind our `/api/overpass` proxy). Public Overpass servers flake (429s and stalls surface as 502s on our dashboard), coverage and policy are outside our control, and viewport coordinates still leave our infrastructure. Every current query is a simple tag-equality lookup within a bbox — none of Overpass QL's power is used — so we can replace the dependency entirely with our own PostGIS-backed POI index fed by periodic OSM extracts (the Organic Maps pattern: precompute at build time instead of querying a live third-party engine). This supersedes the parked `docs/ideas/self-host-overpass/` plan with something lighter: no Overpass software at all.

## What Changes

- **New POI index**: a `planner.pois` table (OSM id/type, category, name, centroid geometry, tags) holding planet-wide POIs for the planner's categories, with GiST/category indexes.
- **Refresh pipeline**: a scheduled job on the BRouter host (1.8 TB disk) downloads the OSM planet file, filters it to our category selectors with osmium, and publishes a compact artifact over the vSwitch; a flagship-side import script loads it into a staging table and atomically swaps it in, refusing to swap if the new dataset shrinks implausibly.
- **Single source of truth for categories**: `@trails-cool/map-core` POI categories change from Overpass QL strings to structured tag selectors (`{key, value}` lists) that drive both the pipeline filter and request-time classification.
- **New serving route**: planner `/api/pois` (bbox + categories) queries the index with the same result cap, same-origin/session checks, and per-IP rate limit the proxy has today; the browser client keeps its bbox quantization, client cache, debounce, and error UI.
- **BREAKING**: the `/api/overpass` proxy route and the `overpass.private.coffee` dependency are removed; no POI traffic leaves trails.cool infrastructure. Grafana's Overpass upstream panels are replaced by index freshness/serving metrics.
- The parked `docs/ideas/self-host-overpass/` README is updated to point here as superseded.
- Not in scope: POI search by name, categories beyond the current nine, journal use of the index, and editing/contributing back to OSM.

## Capabilities

### New Capabilities
- `poi-index`: The self-hosted POI dataset — import pipeline (selectors, cadence, atomic swap, sanity guard, freshness observability) and the serving contract (`/api/pois` request/response, caps, access checks).

### Modified Capabilities
- `osm-poi-overlays`: POI data comes from the instance's own index instead of the Overpass API; the "Overpass rate limit handling" requirement is replaced by source-neutral degradation handling for the planner's own POI endpoint.
- `rate-limiting`: the "Overpass API rate limit" requirement (120/IP/min on `/api/overpass`) is replaced by an equivalent limit on `/api/pois`, now protecting our own database rather than an upstream.
- `infrastructure`: adds the scheduled extract job on the BRouter host, artifact transfer over the existing vSwitch, and the flagship import job + table as operated components with freshness monitoring.

## Impact

- `packages/map-core/src/poi.ts` — QL strings → structured selectors (planner client + pipeline both consume).
- `apps/planner`: new `routes/api.pois.ts`; `lib/overpass.ts` becomes a thin `/api/pois` client (Poi shape unchanged, so `use-pois`, `use-nearby-pois`, snap-to-poi, markers, and popups are untouched); `routes/api.overpass.ts` deleted; metrics swapped.
- `packages/db` — `planner.pois` schema + migration.
- `infrastructure/brouter-host/` — extract job (osmium) + artifact publishing via the existing Caddy sidecar; flagship import script + schedule; Grafana dashboard update.
- Privacy: planner viewport coordinates no longer sent to any third party — strengthens the zero-collection posture.
- Data: planet filtered to nine categories ≈ 10M rows, single-digit GB in PostGIS — fits the flagship; the planet PBF (~80 GB) only ever lives on the BRouter host.
