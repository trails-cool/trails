## ADDED Requirements

### Requirement: Midpoint drag handles on route segments
The Planner SHALL display draggable midpoint handles between consecutive waypoints on the route, allowing users to reshape the route by dragging.

#### Scenario: Midpoint handle visible
- **WHEN** a route is displayed with at least two waypoints
- **THEN** a small circular handle appears at the geographic midpoint of each route segment (using the actual route geometry, not straight-line distance)

#### Scenario: Drag midpoint to reshape
- **WHEN** a user drags a midpoint handle to a new position
- **THEN** a new waypoint is inserted at the dropped position between the two adjacent waypoints, and the route recomputes through the new point

#### Scenario: Handle visibility control
- **WHEN** the map zoom level is below 12
- **THEN** midpoint handles are hidden to reduce visual clutter

#### Scenario: Reshape syncs to other participants
- **WHEN** a user reshapes the route by dragging a midpoint
- **THEN** all other participants see the new waypoint and recomputed route via Yjs sync
