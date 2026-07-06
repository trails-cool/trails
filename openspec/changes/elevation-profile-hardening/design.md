## Context

`@trails-cool/gpx` computes elevation stats in three places, all naive:

- `parse.ts` `computeElevation()` sums every positive/negative point-to-point delta into `gain`/`loss`. GPS and barometric traces jitter by a few metres per point, so every wobble counts as ascent — long activities overstate gain badly.
- `elevation-series.ts` `elevationSeries()` builds the chart series from raw points (stride-downsampled); single-point altitude spikes survive into the chart.
- `compute-days.ts` builds cumulative ascent/descent arrays (same naive delta sum) to derive per-day totals.

Consumers: journal `gpx-save.server.ts` persists `parsed.elevation.gain/loss` to route/activity rows; route and activity detail loaders call `elevationSeries()`; the planner's multi-day sidebar uses `computeDays`. Planner *planned-route* ascent comes from BRouter's `totalAscend` and is not touched by this change.

Organic Maps (`libs/map/elevation_info.cpp`, reviewed 2026-07-05) handles the same problems with two algorithms we adapt here: opposite-sign slope-outlier despiking, and threshold (hysteresis) filtered accumulation with a raw fallback.

## Goals / Non-Goals

**Goals:**
- Ascent/descent totals that are stable under GPS/barometer noise and close to what users see on other platforms (Garmin, Komoot).
- A despiked elevation series so chart, totals, and per-day stats are all computed from the same cleaned data and agree with each other.
- Pure, unit-testable primitives in `@trails-cool/gpx` with no API-shape change for consumers.

**Non-Goals:**
- No backfill of stored `elevationGain`/`elevationLoss` on existing journal rows (values refresh on the next parse: re-import, sync, edit).
- No DEM-based elevation correction (replacing recorded altitude with terrain-model altitude) — separate, much larger feature.
- No change to BRouter-derived planner stats, no smoothing of route *geometry* (lat/lng untouched), no difficulty rating (possible follow-up).

## Decisions

### 1. New module `elevation-clean.ts` with two pure primitives

`despike(points)` and `filteredTotals(points)` operate on the `{ distance, elevation }` sequence that already exists internally (`ElevationProfile[]`). Both `computeElevation` and `elevationSeries` call `despike` first, then derive totals/series from the cleaned sequence. One cleaning pass, consistent numbers everywhere.

*Alternative considered:* cleaning inside each consumer (parse, series, days) independently — rejected; the chart and the headline stats would disagree whenever thresholds drift apart.

### 2. Despiking: opposite-sign slope outliers, interpolated out

A point is a spike iff the slope to its previous neighbor and the slope to its next neighbor both exceed `MAX_SLOPE_PERCENT` **and** have opposite signs (an isolated peak or pit). Spikes are replaced by linear interpolation between neighbors. This is Organic Maps' `SmoothSlopeOutliers`. The opposite-sign condition is the safety property: genuinely steep terrain climbs monotonically (same-sign slopes) and is never altered.

Default `MAX_SLOPE_PERCENT = 100` (45°). Segment boundaries are respected — no interpolation across `trkseg` gaps.

*Alternative considered:* moving-average smoothing — rejected; it flattens real terrain (summits, cols) and shifts totals everywhere instead of only where data is broken.

### 3. Ascent/descent: hysteresis accumulation with raw fallback

Maintain a reference altitude; accumulate ascent (or descent) only once the current altitude deviates from the reference by more than `NOISE_THRESHOLD_M`, then move the reference. This suppresses sub-threshold jitter while capturing every real climb larger than the threshold. Compute **both** raw and filtered totals; report filtered unless it is zero while raw is non-zero (near-flat tracks where all variation is sub-threshold — report raw so short flat walks don't show 0 m against a technically non-zero trace). This mirrors Organic Maps' dual `m_ascent`/`m_lowestPassedAltitude`-style bookkeeping and its `GetTotalAscent()` preference order.

Default `NOISE_THRESHOLD_M = 5` (typical barometric jitter; GPS-only altitude is worse, but 5 m already removes the bulk of the inflation). Constants exported and overridable via an options argument for tests and future tuning.

*Alternative considered:* distance-binned resampling (sum deltas over N-metre bins) — simpler but conflates horizontal point density with vertical noise; hysteresis is independent of point spacing.

### 4. Per-day totals: cumulative filtered arrays

`compute-days.ts` keeps its cumulative-array design (day total = cumulative[end] − cumulative[start]) but the arrays are produced by running the hysteresis accumulator once over the despiked full track, recording the running filtered ascent/descent at every point index. Day totals therefore sum exactly to the route total by construction.

### 5. Chart series: despiked input, keep stride downsampling

`elevationSeries()` consumes despiked points. The existing stride downsample stays — Douglas-Peucker on the distance/elevation polyline (Organic Maps' `Simplify`) would preserve shape better at 400 points, but stride is adequate for current chart sizes and DP is an isolated follow-up, not a dependency of correctness.

## Risks / Trade-offs

- [Filtered totals change displayed numbers on re-parse while old rows keep naive values] → Accepted; documented in proposal. Mixed old/new values coexist until rows are re-parsed. A backfill job is possible later since GPX blobs are retained.
- [Threshold too aggressive for genuinely rolling terrain (many real 3–4 m undulations)] → 5 m is conservative versus the 10 m+ some platforms use; raw totals remain available in the return shape (`gainRaw`/`lossRaw` added alongside `gain`/`loss`) so we can compare in the field before tuning.
- [Despiking legitimate data (e.g. real cliff-edge out-and-back)] → Opposite-sign + both-slopes-exceed condition makes false positives require a physically implausible single-point spike; fixture tests pin the behavior.
- [`elevationSeries` flattens across segments while despiking is per-segment] → Keep the flattening behavior; despike runs before flattening so no cross-segment interpolation occurs.

## Migration Plan

Pure library change: ship `@trails-cool/gpx` update, both apps pick it up in the same deploy. No schema, API, or config changes. Rollback = revert the PR.

## Open Questions

- None blocking. Threshold tuning (5 m default) may warrant revisiting once real re-parsed activities can be compared against Garmin/Komoot numbers for the same tracks.
