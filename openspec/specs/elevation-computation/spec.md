# elevation-computation Specification

## Purpose
Noise-robust elevation stats in `@trails-cool/gpx`. Real GPS/barometric traces jitter a few metres per point and carry occasional single-point spikes, so naively summing every positive delta overstated ascent by 20–50% and distorted the profile chart. Elevation is despiked (isolated opposite-sign slope outliers interpolated out, per segment) and ascent/descent accumulate via hysteresis above a noise threshold, with the same cleaned data feeding the headline totals, the profile chart, and per-day splits so they always agree.

## Requirements
### Requirement: Elevation spike removal
The GPX package SHALL remove single-point elevation spikes before computing elevation totals or the elevation profile series. A point is a spike when the slopes to both its neighbors exceed the maximum-slope constant and have opposite signs; spike elevations SHALL be replaced by linear interpolation between the neighboring points. Track segment boundaries SHALL NOT be interpolated across.

#### Scenario: Isolated spike is interpolated out
- **WHEN** a track contains a point whose elevation jumps 30 m above both neighbors over a few metres of distance
- **THEN** the computed series replaces that point's elevation with the interpolation of its neighbors
- **AND** ascent/descent totals do not include the spike

#### Scenario: Steep but real climb is preserved
- **WHEN** a track climbs steeply and monotonically (successive slopes share the same sign)
- **THEN** no point on the climb is altered

#### Scenario: No interpolation across segment gaps
- **WHEN** a spike-like pattern spans the boundary between two track segments
- **THEN** points are not interpolated across the segment boundary

### Requirement: Threshold-filtered ascent and descent totals
The GPX package SHALL compute ascent and descent using hysteresis accumulation: elevation change is accumulated only when altitude deviates from a moving reference by more than the noise-threshold constant. Both raw (unfiltered) and filtered totals SHALL be computed; the reported `gain`/`loss` SHALL be the filtered values, except when both filtered totals are zero and raw totals are non-zero, in which case the raw values SHALL be reported. Raw totals SHALL remain available to callers alongside the reported values.

#### Scenario: Jitter does not inflate ascent
- **WHEN** a track's elevation oscillates by ±2 m around a constant altitude over many points
- **THEN** the reported ascent and descent are 0 m

#### Scenario: Real climbs are fully counted
- **WHEN** a track climbs 400 m, descends 100 m, and climbs 200 m, each leg exceeding the noise threshold
- **THEN** the reported ascent is approximately 600 m and descent approximately 100 m

#### Scenario: Near-flat track falls back to raw totals
- **WHEN** every elevation variation in a track is below the noise threshold so filtered totals are zero
- **THEN** the raw totals are reported instead of 0 m

### Requirement: Consistent cleaned data across totals, series, and per-day stats
The elevation profile series, the ascent/descent totals, and the per-day elevation statistics SHALL all be derived from the same despiked elevation data, and per-day ascent/descent SHALL use the same filtered accumulation such that the per-day values sum to the whole-track totals.

#### Scenario: Chart and headline stats agree
- **WHEN** a GPX with elevation spikes is parsed and rendered on a detail page
- **THEN** the elevation chart and the ascent/descent stats reflect the same despiked data

#### Scenario: Day totals sum to route total
- **WHEN** a multi-day route with day breaks is processed
- **THEN** the sum of per-day ascent values equals the route's total ascent

### Requirement: Unchanged public data shape
The elevation hardening SHALL NOT change the existing `GpxData["elevation"]` fields (`gain`, `loss`, `profile`) or the `ElevationSample` series shape consumed by the apps; raw totals SHALL be exposed as additional fields only.

#### Scenario: Existing consumers compile and run unchanged
- **WHEN** the journal save path and detail loaders run against the updated package
- **THEN** they persist and render gain/loss and the elevation series without code changes

