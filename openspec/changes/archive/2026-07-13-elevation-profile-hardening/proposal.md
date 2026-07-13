## Why

Ascent/descent totals for imported and synced GPX are computed by summing every positive point-to-point elevation delta (`packages/gpx/src/parse.ts` `computeElevation`), with no noise handling. Real-world GPS/barometer traces are noisy, so the journal systematically overstates elevation gain — often by 20–50% on long activities — and single-point altitude spikes distort the elevation profile chart. Organic Maps solved both problems with two small, well-tested algorithms (slope-outlier despiking + threshold-filtered accumulation) that we reviewed and can adapt to `@trails-cool/gpx`.

## What Changes

- Add **spike removal** to elevation processing: single points whose slopes to both neighbors exceed a maximum slope and have opposite signs (peak/pit spikes) are replaced by interpolation before any totals or series are computed.
- Add **threshold-filtered ascent/descent**: accumulate gain/loss only when altitude deviates from a moving reference by more than a threshold (hysteresis), suppressing jitter. Both raw and filtered totals are computed; filtered is preferred, raw is the fallback when filtering removes everything (near-flat tracks).
- Apply the same cleaned elevation data to the **elevation profile series** (`elevationSeries`) so the chart and the headline stats agree.
- Apply filtered accumulation to **per-day ascent/descent** (`compute-days.ts`) so day totals stay consistent with the route total.
- No change to planner routing stats: planned-route ascent continues to come from BRouter (`totalAscend`).
- No backfill of stored `elevationGain`/`elevationLoss` on existing journal rows; values update when a GPX is re-parsed (new imports, syncs, edits). A backfill job is explicitly out of scope.

## Capabilities

### New Capabilities
- `elevation-computation`: How elevation series, ascent/descent totals, and per-day elevation stats are computed from GPX track points in `@trails-cool/gpx` — despiking, threshold-filtered accumulation, raw fallback, and series consistency guarantees.

### Modified Capabilities

<!-- none — journal-elevation-profile (chart UI), activity-stats (display), gpx-save (persistence flow), and multi-day-routes (per-day stats display) keep their existing requirements; only the computation behind the numbers changes, which the new capability captures -->

## Impact

- `packages/gpx/src/parse.ts` — `computeElevation` gains despike + filtered accumulation.
- `packages/gpx/src/elevation-series.ts` — series built from despiked points.
- `packages/gpx/src/compute-days.ts` — cumulative ascent/descent arrays use the filtered accumulator.
- New `packages/gpx/src/elevation-clean.ts` (despike + filter primitives) with co-located unit tests and noisy-track fixtures.
- Consumers (journal `gpx-save.server.ts`, route/activity detail loaders, planner multi-day breakdown) get corrected numbers with no API change — `GpxData["elevation"]` shape stays `{ gain, loss, profile }`.
- No DB schema change, no migration, no API contract change.
