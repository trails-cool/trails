## ADDED Requirements

### Requirement: Tobler-based walking time model
The GPX package SHALL provide a pure walking-time estimator that applies Tobler's hiking function (`speed = 6·e^(−3.5·|slope+0.05|)` km/h) per segment over a sequence of points, using haversine horizontal distance and elevation-derived slope. Segments lacking elevation on either endpoint SHALL be estimated at flat-ground speed. Slope SHALL be clamped to ±100% before applying the formula.

#### Scenario: Flat route baseline
- **WHEN** a 5 km route with constant elevation is estimated
- **THEN** the estimate is approximately one hour (flat Tobler speed ≈ 5 km/h)

#### Scenario: Uphill slower than downhill
- **WHEN** the same distance is estimated once at +20% slope and once at −20% slope
- **THEN** the uphill estimate is greater than the downhill estimate
- **AND** both are greater than the flat estimate

#### Scenario: Missing elevation falls back to flat speed
- **WHEN** a route's points carry no elevation values
- **THEN** an estimate is still produced using flat-ground speed for every segment

### Requirement: Whole-route estimate in the planner for the foot profile
The Planner SHALL display the estimated walking time alongside distance and ascent when the active routing profile is the foot profile, computed from the routed geometry's elevation-tagged coordinates. Other profiles SHALL NOT display a walking-time estimate. The display SHALL mark the value as approximate and use localized strings and hours/minutes formatting.

#### Scenario: Estimate shown for foot profile
- **WHEN** a route is computed with the foot ("Hiking") profile selected
- **THEN** the sidebar stats include an approximate walking time (e.g. "≈ 4 h 20 min")

#### Scenario: No estimate for cycling profiles
- **WHEN** the same route is computed with a cycling profile selected
- **THEN** no walking-time estimate is displayed

#### Scenario: Estimate updates with the route
- **WHEN** a waypoint is added and the route recomputes
- **THEN** the displayed estimate reflects the new geometry

### Requirement: Per-day estimates in the multi-day breakdown
`computeDays` SHALL support opt-in per-day walking-time estimation, populating an optional `estimatedTimeSec` on each day stage such that day estimates sum to the whole-route estimate; callers not opting in SHALL receive unchanged output. The Planner's day breakdown SHALL display each day's estimated walking time when the foot profile is active.

#### Scenario: Day times displayed and consistent
- **WHEN** a foot-profile route has overnight waypoints splitting it into days
- **THEN** each day section shows its estimated walking time
- **AND** the day estimates sum to the whole-route estimate

#### Scenario: Journal call sites unaffected
- **WHEN** `computeDays` is called without the opt-in (journal route detail)
- **THEN** day stages carry no `estimatedTimeSec` and existing behavior is unchanged
