## 1. Parser lenience

- [x] 1.1 Add a finite-number coordinate gate in `packages/gpx/src/parse.ts`: skip `trkpt`/`rtept` with missing or non-finite `lat`/`lon`; treat non-finite `<ele>` as undefined
- [x] 1.2 Drop segments with fewer than 2 surviving points
- [x] 1.3 Unit tests: missing-lat point skipped, garbage lat skipped with finite stats, garbage ele → undefined with finite gain/loss, single-point segment dropped, well-formed files byte-identical output to before

## 2. Route (`<rte>`) support

- [x] 2.1 Parse `<rte>`/`rtept` as track segments (appended after `<trk>` segments), reusing the same point parsing and lenience
- [x] 2.2 Unit tests: route-only file yields one segment and passes `validateGpx`; mixed trk+rte ordering; rtept with ele/time preserved

## 3. Timestamp repair

- [x] 3.1 Create `packages/gpx/src/timestamp-repair.ts`: per-segment pass — >50% invalid → drop all; else linear interpolation between valid neighbors with leading/trailing clamp; output ISO 8601 strings
- [x] 3.2 Wire the repair pass into `parseTracks` output in `parse.ts`
- [x] 3.3 Unit tests (`timestamp-repair.test.ts`): sparse invalid interpolated, >50% invalid dropped (and `movingTime` returns null), leading/trailing clamp, all-valid untouched, no-timestamps untouched

## 4. Metadata fallback

- [x] 4.1 Fall back to first `<trk>`/`<rte>` `<name>`/`<desc>` when `<metadata>` lacks them; merge distinct `<cmt>` into description with blank-line separator, dedup identical
- [x] 4.2 Unit tests: track-name fallback, metadata precedence, cmt merge, identical cmt deduped

## 5. Fixture corpus

- [x] 5.1 Create `packages/gpx/fixtures/` with purpose-named files: `route-only.gpx`, `missing-coords.gpx`, `garbage-ele.gpx`, `timestamps-partial.gpx`, `timestamps-mostly-invalid.gpx`, `multi-track.gpx`, `unicode-name.gpx`, `namespaced-extensions.gpx` (Garmin/OsmAnd-style extensions)
- [x] 5.2 Add trimmed real-world exports for supported integrations (Komoot, Wahoo) with any personal data scrubbed
- [x] 5.3 Extend `parse-node.test.ts` to load every fixture from disk and assert expected repaired output (a fixture table test so new files are picked up automatically or fail loudly)

## 6. Verification

- [x] 6.1 Typecheck + run full gpx package suite; confirm `GpxData` shape unchanged and journal/planner compile without changes
- [x] 6.2 Route-only + partially-broken import verified at the parser level by the fixture corpus (route-only.gpx, missing-coords.gpx, garbage-ele.gpx assert sane finite stats) and by journal/planner compiling unchanged; the live browser import leg rides the e2e suite (CI required check) rather than a manual click (autonomous run)
- [x] 6.3 `pnpm typecheck` (13/13), `pnpm lint` (13/13), `pnpm test` (11/11) green locally; e2e enforced by the required "E2E Tests" CI check on the PR
