## Why

`@trails-cool/gpx`'s parser trusts its input: a `trkpt` with a missing `lat`/`lon` attribute silently becomes `0` (a Null Island point that passes journal validation), unparseable coordinates or `<ele>` produce `NaN` that survives the range check and poisons distance and gain/loss totals, and `<rte>`/`rtept` files (Garmin Connect courses and many planner exports) parse to zero track points and are rejected. Our review of Organic Maps' GPX parser (`libs/kml/serdes_gpx.cpp` and its fixture corpus, 2026-07-05) catalogued exactly these real-world failure modes plus a principled timestamp-repair policy; users importing files from other apps will keep hitting them until we harden the parser.

## What Changes

- **Invalid point handling**: track/route points with missing or unparseable `lat`/`lon` are skipped (not defaulted to 0, not propagated as `NaN`); unparseable `<ele>` is treated as absent instead of `NaN`.
- **Route support**: `<rte>`/`rtept` sequences are parsed as tracks, so route-only GPX files import like track files.
- **Timestamp repair** (Organic Maps policy): per segment, if more than half of the point timestamps are invalid, all timestamps in that segment are dropped; otherwise invalid timestamps are linearly interpolated between valid neighbors (leading/trailing runs clamp to the nearest valid value). Downstream moving time, elapsed duration, and `startTime` become reliable for files from flaky recorders.
- **Description fallback**: track-level `<name>`/`<desc>`/`<cmt>` are used when `<metadata>` has none, and `<cmt>` is merged into the description when distinct.
- **Real-world fixture corpus**: add a `fixtures/` set of small GPX files modeled on Organic Maps' test corpus (route-only, missing/garbage coordinates, mixed-validity timestamps, missing elevation, multi-track/multi-segment, namespaced extensions, Unicode names) wired into the parser test suite as regression cases.
- Not in scope: track color extensions (journal doesn't render per-track colors), GPX 1.0 support, and changes to the journal's validation thresholds (`validateGpx` still requires ≥2 valid points and in-range coordinates).

## Capabilities

### New Capabilities
- `gpx-parsing`: Behavior of the shared GPX parser — which elements are recognized (tracks, routes, waypoints, metadata), how invalid points/elevations/timestamps are repaired or discarded, and the regression fixture corpus that pins this behavior.

### Modified Capabilities

<!-- none — gpx-save's validation requirements (≥2 points, coordinate range, loud failure) are unchanged; they now operate on cleaner parser output. gpx-import's UI-level requirements are untouched. -->

## Impact

- `packages/gpx/src/parse.ts` — point/coordinate/elevation lenience, `<rte>` parsing, description fallback; new `timestamp-repair.ts` (or equivalent) for the repair pass.
- `packages/gpx/fixtures/*.gpx` + expanded `parse.test.ts`/`parse-node.test.ts` — fixture corpus and regression tests.
- Journal import/sync paths (`gpx-save.server.ts`, Komoot/Wahoo import) and planner GPX loading benefit without code changes; `GpxData` shape is unchanged.
- Files previously rejected (route-only) or corrupted (NaN stats) now import correctly — behavior change is strictly permissive.
