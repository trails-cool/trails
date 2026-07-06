## 1. Geocode package

- [ ] 1.1 Create `packages/geocode`: build script converting GeoNames `cities500` TSV → compact artifact (name, admin1, country, lat, lon), checked in with CC-BY attribution/license file
- [ ] 1.2 Implement `nearestPlace(lat, lon)` with a 1°-grid index + neighbor scan; distance thresholds (30 km place / 200 km country) as constants; measure load time + resident memory and record in the package README
- [ ] 1.3 Unit tests: city center, border town, mid-ocean (country-only/none), poles/antimeridian edge cells

## 2. Schema & derivation

- [ ] 2.1 Add `location_name` + `location_country` to `activities` and `routes` + migration
- [ ] 2.2 Derive in the gpx-save shared step from the first geometry point for all local creation paths; skip remote/federated ingest
- [ ] 2.3 One-shot idempotent pg-boss backfill job over rows with geometry and null label

## 3. Display

- [ ] 3.1 Detail pages + feed/list cards render the label (place + localized country name via i18n); null renders nothing
- [ ] 3.2 Masking: render the label only where the viewer can see the geometry (shared visibility path); coordinate with `activity-privacy-controls` flag if landed
- [ ] 3.3 Add GeoNames attribution to the journal credits alongside OSM attribution; update the privacy manifest (derived on-instance, no third parties)

## 4. Verification

- [ ] 4.1 E2E: import a fixture GPX → label appears on detail + feed; private activity's label invisible to another user
- [ ] 4.2 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`
