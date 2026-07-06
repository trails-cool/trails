## Context

The planner's route stats (`WaypointSidebar.tsx`) show distance and ascent from `EnrichedRoute` (`route-merge.ts`), whose `coordinates` are `[lon, lat, ele]` triples from BRouter — elevation is already on every point. BRouter also returns a `total-time` (summed into `EnrichedRoute.totalTime` but displayed nowhere); it is computed by the *routing profile's* speed model. The profile the UI labels "Hiking" is BRouter's `trekking.brf` — a trekking-**bike** profile — so its `total-time` is a cycling time and unusable for hikers. A slope-aware walking model applied to the geometry is both more honest and independent of the profile mislabel.

Organic Maps uses Tobler's hiking function for pedestrian ETA (`libs/routing/edge_estimator.cpp`, reviewed 2026-07-05): walking speed `6·e^(−3.5·|dh/dx + 0.05|)` km/h — max ~6 km/h at a 5% descent, ~5 km/h flat, dropping steeply uphill. It is the standard published model (Tobler 1993) and needs only per-segment horizontal distance and elevation change.

`computeDays` (`packages/gpx/src/compute-days.ts`) splits a route into `DayStage`s for the multi-day sidebar; the `multi-day-routes` spec requires per-day "estimated duration" but `DayStage` has no time field — unimplemented spec, closed by this change. `computeDays` is also called by the journal's route detail page, so any extension must be opt-in.

## Goals / Non-Goals

**Goals:**
- A believable walking-time estimate for the whole route and per day, visible in the planner when planning on foot.
- One pure, tested model function in `@trails-cool/gpx`, reusable later by the journal.
- Honest labeling: walking time excluding breaks (mountain-signpost convention).

**Non-Goals:**
- Cycling/car time estimates (BRouter's `totalTime` exists for a later change; mixing two estimation sources in one UI needs its own design).
- Journal route/activity pages (follow-up; the primitive will be ready).
- Rest-break or pack-weight adjustments (DIN 33466, Naismith corrections), altitude penalties (OM's >2500 m model), and fixing the `trekking`-labeled-"Hiking" profile mismatch — the last is a separate routing-profile decision (e.g. adding a real foot profile to the BRouter image) that this change must not block on.

## Decisions

### 1. Model: pure Tobler, per segment, in `@trails-cool/gpx`

New `packages/gpx/src/hiking-time.ts`:
- `toblerSpeedKmh(slope)` — the bare function, exported for tests.
- `hikingTimeSeconds(points: Array<{lat, lon, ele?}>)` — haversine horizontal distance per segment; slope = Δele / horizontal distance; sum `distance / toblerSpeed`. Segments where either endpoint lacks elevation use slope 0 (flat ≈ 5.04 km/h) — a planned route without DEM data still gets a distance-based estimate rather than nothing.
- `cumulativeHikingTimeSeconds(points)` — running totals per point index, for day splitting.
- Slope clamped to ±100% before applying the formula so a data glitch can't produce a near-zero speed that dominates the total.

Lives in `@trails-cool/gpx` beside `moving-time.ts`/`compute-days.ts` because its input shape is the track-point shape and its consumers are the same. Not `map-core` (constants only, per conventions).

*Alternative:* use/patch BRouter's `total-time` — rejected: for the foot case it's a bike time today, and correcting it means maintaining a custom `.brf`; a geometry-based model is profile-independent and testable in TypeScript.

### 2. Applies to the foot profile only, keyed at the planner layer

`use-routing.ts` computes `estimatedTimeSec` from `enriched.coordinates` only when the active profile is the foot profile — `hiking` once the `hiking-foot-profile` change lands, else the UI's current "Hiking" (`trekking`) — and writes it into the route stats object next to `distance`/`elevationGain`. The gate lives in the planner, not the library — the library function is sport-agnostic; what "counts as on foot" is a planner UI concept. Profile changes already trigger a routing recompute, so the estimate stays in sync.

### 3. Per-day times via opt-in `computeDays` extension

`computeDays(waypoints, tracks, opts?)` gains `opts.estimateHikingTime`; when set, each `DayStage` includes `estimatedTimeSec` derived from the cumulative time array between the stage's track-point boundaries (same cumulative-array pattern the function already uses for ascent). Optional field + opt-in flag means the journal's existing call sites compile and behave identically, and day times sum exactly to the whole-route total by construction.

*Alternative:* compute day times in the planner component from `DayStage` waypoint indices — rejected: the track-point boundary mapping lives inside `computeDays`; re-deriving it outside duplicates logic the multi-day spec already anchors there.

### 4. Display: alongside existing stats, labeled as walking time

- Single-day: the sidebar's stat line and stats grid gain a time entry (e.g. "≈ 4 h 20 min") when `estimatedTimeSec` is present.
- Multi-day: each day section header/row in `DayBreakdown.tsx` shows its day time.
- Strings via `useTranslation` (en: "Est. walking time", de: "Gehzeit ca."), formatted h/min; no seconds. The "≈" and the label communicate estimate-without-breaks; a tooltip/help text can note "excluding breaks".

## Risks / Trade-offs

- [Estimate feels wrong to some users — Tobler models a fit walker on decent terrain] → Label as an approximation; Tobler is the same baseline OM ships and matches signpost times reasonably. Surface/terrain multipliers (BRouter gives per-point surface tags we already extract) are a natural follow-up refinement, not v1.
- [Foot profile is actually BRouter's trekking-bike profile, so the *route* may not be the path a hiker would take] → Pre-existing issue, orthogonal to the estimate; documented here so the follow-up (real foot `.brf`) is discoverable. The time estimate is correct for whatever geometry is shown.
- [Points without elevation degrade to flat-speed] → Acceptable; BRouter always supplies elevation, so this path only triggers for degraded data.
- [`DayStage` shape change ripples to journal types] → Field is optional and absent unless opted in; journal render code never sees it.

## Migration Plan

Library + planner-only UI change; ships with the normal app deploy. No schema/API changes. Rollback = revert PR.

## Open Questions

- None blocking. Whether to also surface `EnrichedRoute.totalTime` for cycling profiles, and whether to add a genuine hiking `.brf` to the BRouter image (and relabel profiles honestly), are follow-up proposals.
