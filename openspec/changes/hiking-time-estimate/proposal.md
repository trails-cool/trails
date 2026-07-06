## Why

The planner shows distance and ascent for a planned route but no time estimate, even though "how long will this take?" is the first question a hiker asks of a plan — and even though BRouter already returns elevation-tagged geometry that makes a good estimate cheap to compute. Tobler's hiking function (speed as a function of slope, the model Organic Maps uses for pedestrian ETA) turns the existing route geometry into a credible walking-time estimate with a small pure function. Bonus: the `multi-day-routes` spec already requires per-day "estimated duration", which was never implemented — this change closes that drift.

## What Changes

- New pure function in `@trails-cool/gpx`: Tobler-based walking time over a sequence of points with elevation (`speed = 6·e^(−3.5·|slope+0.05|)` km/h per segment, flat-ground fallback when elevation is missing).
- The planner sidebar shows **estimated walking time** alongside distance and ascent when the routing profile is the foot profile (`trekking`, labeled "Hiking" in the UI). Cycling/car profiles show no estimate (out of scope for now).
- `computeDays` gains an opt-in per-day `estimatedTimeSec` so the multi-day day breakdown shows a time per day (planner only; journal's `computeDays` call is unaffected).
- Estimates are labeled as walking time without breaks (signpost convention), localized in English and German.
- Not in scope: cycling time estimates (BRouter's `total-time` is already summed in `EnrichedRoute.totalTime` and could be surfaced later), journal route detail display, rest-break padding (DIN 33466-style), and any change to routing itself.

## Capabilities

### New Capabilities
- `hiking-time-estimate`: Tobler-based walking-time estimation for planned routes — the model, where it appears (whole-route stats, per-day stats), when it applies (foot profile), and its fallback behavior without elevation data.

### Modified Capabilities

<!-- none — multi-day-routes already requires per-day estimated duration (currently unimplemented); this change fulfills that requirement rather than changing it. The new capability spec covers the estimation model and display details. -->

## Impact

- `packages/gpx/src/hiking-time.ts` (new) + tests — the Tobler function and a cumulative variant for day splits.
- `packages/gpx/src/compute-days.ts` — optional `estimatedTimeSec` on `DayStage` behind an opt-in flag; existing callers unchanged.
- `apps/planner/app/lib/use-routing.ts` — compute `estimatedTimeSec` into route stats when the profile is `trekking`, from the enriched route's elevation-tagged coordinates.
- `apps/planner/app/components/WaypointSidebar.tsx` + `DayBreakdown.tsx` — display whole-route and per-day time.
- `packages/i18n` — new planner strings (en + de).
- No API, schema, or BRouter changes.
