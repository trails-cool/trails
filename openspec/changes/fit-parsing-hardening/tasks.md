## 1. Fixtures first

- [x] 1.1 Collect fixture FIT files — adapted: per the chosen approach, cases are driven by mocked `fit-file-parser` output in `fit.test.ts` (pause, multisession, indoor no-GPS, corrupt coords/missing-timestamp) rather than binary files. Real device binaries can be added later without changing the converter.
- [x] 1.2 Parser `events`/`sessions` shapes captured as the `FitEvent`/`FitSession` types + code comments in `fit.ts`, and exercised by the mocked-parser tests.

## 2. Converter

- [x] 2.1 Segmentation: split on timer stop/start event pairs, fallback on record gaps > 5 min (named constants)
- [x] 2.2 Session slicing: records windowed per session, one-or-more segments per session, single-session unchanged
- [x] 2.3 Validation gates: finite/in-range coordinates, timestamp required, non-finite altitude → undefined; prefer `enhanced_altitude` (speed isn't emitted to GPX so its preference is moot)
- [x] 2.4 Return `{ gpx, sport }` with the FIT→SportType mapping table; update call sites (Wahoo importer + webhook, Garmin importer) — provider-explicit type wins, FIT sport is fallback
- [x] 2.5 Unit tests over the fixtures: segment counts (pause becomes a segment boundary, which is what keeps moving time honest), corrupt-record drops, enhanced-altitude preference, sport mapping, no-GPS returns null gpx

## 3. Verification

- [x] 3.1 Re-run the Wahoo importer test suite; confirm existing single-session imports produce identical stats (14 pass; mock updated to the `{gpx, sport}` shape)
- [x] 3.2 Run `pnpm typecheck && pnpm lint && pnpm test` — all green
