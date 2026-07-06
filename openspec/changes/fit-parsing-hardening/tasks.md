## 1. Fixtures first

- [ ] 1.1 Collect fixture FIT files under `apps/journal/app/lib/connected-services/__fixtures__/`: a real Wahoo export with a pause, a multisport (multi-session) file, an indoor no-GPS file, and a synthetic file with corrupt records (out-of-range coords, missing timestamps) — reference Endurain's `backend/tests/.../test_utils_fit.py` case list
- [ ] 1.2 Verify what `fit-file-parser` exposes for `events` and `sessions` on each fixture; note device gaps in a code comment

## 2. Converter

- [ ] 2.1 Segmentation: split on timer stop/start event pairs, fallback on record gaps > 5 min (named constants)
- [ ] 2.2 Session slicing: records windowed per session, one-or-more segments per session, single-session unchanged
- [ ] 2.3 Validation gates: finite/in-range coordinates, timestamp required, non-finite altitude → undefined; prefer `enhanced_altitude`/`enhanced_speed`
- [ ] 2.4 Return `{ gpx, sport }` with the FIT→SportType mapping table; update call sites (Wahoo importer + webhook, Garmin importer) — provider-explicit type wins, FIT sport is fallback
- [ ] 2.5 Unit tests over the fixtures: segment counts, pause exclusion from moving time (via `movingTime` on parsed output), corrupt-record drops, sport mapping, no-GPS returns null gpx

## 3. Verification

- [ ] 3.1 Re-run the Wahoo importer test suite; confirm existing single-session imports produce identical stats
- [ ] 3.2 Run `pnpm typecheck && pnpm lint && pnpm test`
