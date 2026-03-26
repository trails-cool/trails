## MODIFIED Requirements

### Requirement: Route visualization
The map SHALL display the computed route as an interactive, optionally color-coded polyline on the map.

#### Scenario: Display route
- **WHEN** BRouter returns a route GeoJSON
- **THEN** the route is rendered as a polyline on the map, colored according to the active color mode

#### Scenario: Route updates on waypoint change
- **WHEN** a waypoint is added, moved, or deleted
- **THEN** the route polyline updates after BRouter recomputes the route

#### Scenario: Route is clickable
- **WHEN** a user clicks on the route polyline
- **THEN** a new waypoint is inserted at the clicked position (see route-splitting spec)

#### Scenario: Route has midpoint handles
- **WHEN** a route with two or more waypoints is displayed
- **THEN** draggable midpoint handles appear on each route segment (see route-drag-reshape spec)
