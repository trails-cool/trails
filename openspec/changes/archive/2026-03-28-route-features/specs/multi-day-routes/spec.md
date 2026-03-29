## ADDED Requirements

### Requirement: Day-break waypoints
Waypoints in the Planner SHALL support a day-break marker that splits the route into stages.

#### Scenario: Mark day break
- **WHEN** a user marks a waypoint as a day break in the Planner
- **THEN** the route is visually split into days at that point

#### Scenario: Per-day statistics
- **WHEN** a route has day-break markers
- **THEN** the sidebar shows distance and elevation per day/stage

#### Scenario: GPX export with day segments
- **WHEN** a multi-day route is exported as GPX
- **THEN** each day is a separate track segment in the GPX file
