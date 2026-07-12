## 1. Category selectors (single source of truth)

- [x] 1.1 Refactor `packages/map-core/src/poi.ts`: replace Overpass QL `query` strings with structured `selectors: Array<{key, value}>` per category; update `poi.test.ts`
- [x] 1.2 Add a helper that renders the selectors as an osmium tag-filter expression list (used by the pipeline; unit-tested against the nine categories)

## 2. Schema

- [x] 2.1 Add `planner.pois` to `packages/db` (osm_type, osm_id, category, name, geom Point 4326, tags jsonb, imported_at; PK (osm_type, osm_id, category); GiST on geom, btree on category) + migration
- [x] 2.2 `pnpm db:push` locally and verify bbox+category query plans use the indexes _(verified: serving query drives off `pois_geom_idx` for the bbox; `pois_category_idx` used for category filter; PK created as `pois_pkey`)_

## 3. Extract pipeline (BRouter host)

- [x] 3.1 Create `infrastructure/brouter-host/poi-extract/`: script that downloads the configured PBF (`POI_PBF_URL`, planet by default), runs `osmium tags-filter` + `osmium export` (centroids) into gzipped NDJSON, writes a manifest (sha256 + timestamp + row count), and cleans up working files _(NDJSON is `{osm_type, osm_id, name, lat, lon, tags}`; the importer derives `categories` from tags via map-core, so selector logic isn't duplicated on the Node-free host)_
- [x] 3.2 Publish artifact + manifest via the existing Caddy sidecar at a vSwitch-only address (`/poi/*` on `:17777`, same `X-BRouter-Auth` gate) _(public-unreachability follows from the existing vSwitch-only bind + UFW; verify on the host)_
- [x] 3.3 Add a monthly systemd timer under the `trails` user; document disk/bandwidth footprint in `infrastructure/brouter-host/poi-extract/README.md`
- [ ] 3.4 Dry-run on a small Geofabrik extract first; then a full planet run — record row counts per category and artifact size _(operational: run on the BRouter host)_

## 4. Import job (flagship)

- [x] 4.1 Create the import script: fetch manifest + artifact over the vSwitch, verify checksum, COPY into `planner.pois_staging`, build indexes, atomic rename swap in one transaction
- [x] 4.2 Implement the 70% row-count guard with a `--bootstrap` override; abort loudly (log + metric) when tripped
- [x] 4.3 Schedule via systemd timer (`poi-import.timer`, offset a day after the extract); wire into `cd-infra.yml` deploy sources (`infrastructure/scripts` added to the SCP list)
- [ ] 4.4 First production import with `--bootstrap`; spot-check several viewports against live Overpass results for category parity _(operational: run on the flagship)_

## 5. Serving route

- [x] 5.1 Create `apps/planner/app/routes/api.pois.ts` (GET bbox + categories): same-origin + session checks, 120/IP/min rate limit (no DB query on rejection), 100-result cap, short Cache-Control; register in `apps/planner/app/routes.ts`
- [x] 5.2 Unit tests: happy path, invalid bbox/categories 400, 429 path, empty-table graceful response

## 6. Client switch

- [x] 6.1 Rewrite `apps/planner/app/lib/overpass.ts` as the `/api/pois` client (keep `Poi` shape, `quantizeBbox`, error mapping; drop QL building); rename file to `pois.ts` and update imports (`use-pois`, `use-nearby-pois`, snap-to-poi)
- [x] 6.2 Update client tests; verify the existing rate-limit banner and unavailable message fire on 429/5xx from `/api/pois`
- [x] 6.3 Delete `apps/planner/app/routes/api.overpass.ts` and its tests; remove the route registration and the private.coffee configuration (`OVERPASS_URLS` kept for the Journal surface backfill; removed from the planner service in both compose files)

## 7. Observability

- [x] 7.1 Add `poi_index_rows{category}`, `poi_index_age_seconds`, import outcome, and `poi_api_requests_total{status}` metrics; remove `overpass_upstream_*` metrics from `metrics.server.ts` (planner exposes rows/age via scrape-time DB collect + `poi_api_requests_total`; import outcome is emitted by the import job via node_exporter textfile — see Task 4)
- [x] 7.2 Update the Grafana planner dashboard: replace Overpass upstream panels with index freshness + serving panels; add the stale-index alert (~6 weeks) (`poi-index-stale` in alerts.yml)

## 8. Docs & cleanup

- [x] 8.1 Update `docs/architecture.md` (POI data flow) and the privacy documentation (Overpass now Journal-surface-backfill-only; Planner POIs served same-origin)
- [x] 8.2 Document the self-hoster story: optional pipeline, regional extract URL, graceful behavior with an empty index (poi-extract README)
- [x] 8.3 Update `docs/ideas/self-host-overpass/README.md`: superseded by `poi-index`, with the revive-criteria note kept for the QL-compatibility case (+ roadmap pointer)

## 9. Verification

- [x] 9.1 E2E: POI overlay flow (enable category → markers appear) — `e2e/planner-overlays.test.ts` + nearby-snap in `planner-routing.test.ts` now mock `/api/pois` (network-mock is the house pattern; a DB-seeded variant is possible but the route's SQL path is covered by `api.pois.test.ts`)
- [ ] 9.2 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` _(typecheck + lint + unit all green; e2e needs the local stack — run before merge)_
- [ ] 9.3 Post-cutover production check: enable each of the nine categories on a busy viewport and a rural viewport; confirm results and dashboard metrics _(operational: after the first production import)_
