## Context

POI queries flow: browser (`lib/overpass.ts`, bbox quantized to a 0.01° grid) → `/api/overpass` proxy (same-origin + session checks, per-IP rate limit, response cache with coalescing, Grafana metrics) → `overpass.private.coffee`. All nine categories (`packages/map-core/src/poi.ts`) are unions of `nwr["key"="value"]` selectors with `out center qt 100` — tag equality in a bbox, capped at 100 results, ways/relations reduced to center points. Nearby-POI lookup and snap-to-POI reuse the same path with a small bbox.

Two prior artifacts inform this change: the parked `docs/ideas/self-host-overpass/` plan (full Overpass instance on the maintainer's dedicated box; heavy: regional DB, diff replication, ~23 GB RAM ceiling limits it to a DACH extract) and our Organic Maps review (2026-07-05), whose generator pipeline demonstrates the lighter pattern adopted here: batch-filter OSM data offline into a compact owned index, serve reads from that.

Relevant infra already in place: the BRouter host has 1.8 TB free disk, a Caddy sidecar, and a vSwitch link to the flagship (`10.0.0.2`); the flagship runs PostGIS and the planner already has a DB connection (`planner.*` schema, sessions).

## Goals / Non-Goals

**Goals:**
- Zero third-party dependency for POI data; viewport coordinates never leave trails.cool infrastructure.
- Planet-wide coverage (the current upstream is planet-wide; a regional index would be a regression).
- Identical user-facing behavior: same categories, marker data, popups, caps, and degradation UI.
- Boring operations: a monthly batch job with an atomic swap and a freshness metric — no replication daemon.

**Non-Goals:**
- Overpass QL compatibility (nothing uses it; the parked self-host-Overpass plan covers that path if ever needed).
- POI name search, additional categories, journal consumption, or OSM editing — all possible later on top of the same table.
- Minute-fresh data. POIs of these kinds churn slowly; monthly is enough (Organic Maps ships roughly monthly map data too).

## Decisions

### 1. Data model: one flat `planner.pois` table, centroid-only

`planner.pois`: `osm_type` (`n`/`w`/`r`), `osm_id`, `category`, `name` (nullable), `geom` (`geometry(Point, 4326)` — centroid for ways/relations, matching today's `out center`), `tags` (`jsonb`, the element's full tag set for popups: opening hours, website, OSM link), `imported_at`. Primary key `(osm_type, osm_id, category)` — an element matching two categories appears once per category, which is how the client already treats results. Indexes: GiST on `geom`, btree on `category`. Serving query: `WHERE category = ANY($cats) AND geom && ST_MakeEnvelope($bbox)` with the existing 100-result cap.

*Alternative:* normalized category join table — rejected; the categories are a small fixed set and the flat table keeps the import a single `COPY`.

### 2. Category selectors move to structured data in `map-core`

`poiCategories` entries change from Overpass QL strings to `selectors: Array<{key, value}>`. Three consumers derive from this one definition: the pipeline's osmium filter expression, the importer's category classification, and (no longer) any client-side query building. This keeps "what is a shelter" defined in exactly one place — the same property the QL strings had, preserved across the migration.

### 3. Pipeline topology: filter where the disk is, load where the database is

- **BRouter host (monthly systemd timer)**: download planet PBF (~80 GB, kept only transiently), `osmium tag-filter` to our selectors (output: a few hundred MB), `osmium export` with centroid geometry to a gzipped NDJSON artifact `{osm_type, osm_id, category[], name, lat, lon, tags}`, publish it at a vSwitch-only path via the existing Caddy sidecar alongside a checksum + timestamp manifest.
- **Flagship (systemd timer, offset a day)**: fetch manifest + artifact over the vSwitch, `COPY` into `planner.pois_staging`, build indexes, then swap inside one transaction (`ALTER TABLE ... RENAME`).
- **Sanity guard**: the importer aborts (no swap, loud log + metric) if the staging row count is < 70% of the live table's — a truncated download or broken filter can never blank the map. First import bootstraps with the guard disabled via flag.

*Alternatives:* streaming the planet through CI — GitHub runners lack the disk; importing directly from the BRouter host into flagship Postgres — rejected to avoid exposing Postgres on the vSwitch; a pg-boss job on the flagship — rejected because the heavy half (planet download/filter) can't run there anyway, and two small systemd timers are simpler than splitting one job across pg-boss and cron.

### 4. Serving route `/api/pois`, client keeps its shape

New `apps/planner/app/routes/api.pois.ts` (GET, `bbox` + `categories` params): same-origin + session checks, 120/IP/min rate limit (unchanged number — it now protects our DB), result cap 100, short `Cache-Control` so repeated identical viewport requests can be browser-cached. `lib/overpass.ts` is renamed/rewritten as a thin client keeping `quantizeBbox` (still valuable for client-cache hits), the `Poi` type, and the error mapping — so `use-pois`, `use-nearby-pois`, `poi-cache`, snap-to-POI, markers, and popups need no changes. The server-side response cache + coalescing from the proxy are dropped: a GiST-indexed point lookup is single-digit milliseconds and no upstream needs protecting.

### 5. Hard cutover, no dual-source period

`/api/overpass` and its private.coffee upstream are deleted in the same PR that lands `/api/pois`. Rollback for code problems is a git revert; the plausible non-code failure (import breaks later) degrades to *stale* POIs — objectively better than today's failure mode (no POIs during upstream flaps) — and is caught by the freshness metric. Keeping both paths alive would double the test surface for no benefit given the guard + metric.

### 6. Observability

New metrics replacing `overpass_upstream_*`: `poi_index_rows{category}`, `poi_index_age_seconds` (from the manifest timestamp), `poi_api_requests_total{status}`, import job success/failure. Grafana planner dashboard: upstream panels replaced by index freshness + serving panels; alert when index age exceeds ~6 weeks (one missed monthly run).

## Risks / Trade-offs

- [Planet download monthly on the BRouter host uses bandwidth/disk on a shared box] → ~80 GB transient monthly, scoped under `~trails/`; the box has 1.8 TB free and the download can use a Geofabrik mirror at off-peak hours. If it becomes unwelcome, per-continent Geofabrik extracts halve the footprint.
- [Data staleness up to a month (+ alert window)] → Acceptable for these categories; cadence is a timer setting if users report pain.
- [Row estimate off / table larger than expected on the 40 GB flagship SSD] → Measured before cutover in task order (filter first, count, then size the table); 9 categories ≈ 10M rows ≈ low single-digit GB with indexes. If planet-wide jsonb tags blow the budget, store a tag allowlist (popup fields only).
- [Self-hosters inherit a pipeline] → Documented as optional: the compose stack works with an empty/absent POI table (overlays show "unavailable"), and the import script accepts any Geofabrik extract URL so a small instance can index just its region cheaply.
- [Federated/self-host story diverges from flagship topology (no second host)] → The pipeline is two scripts; on a single-host instance both run on that host with a regional extract. Called out in the docs task.

## Migration Plan

1. Land schema + pipeline + route behind no user-visible change (client still on proxy).
2. Run the first import end-to-end on production data; verify counts, spot-check categories against the live Overpass results for sample viewports.
3. Switch the client to `/api/pois`, delete the proxy, swap dashboards — one PR.
4. Update `docs/architecture.md`, the privacy notes, and the parked idea README (superseded pointer).

Rollback: revert step-3 PR (proxy code returns, upstream still exists); the index table is additive and harmless to leave in place.

## Open Questions

- None blocking. Whether small self-hosted instances should get a prebuilt regional artifact from trails.cool (so they skip osmium entirely) is a nice-to-have to decide when someone asks.
