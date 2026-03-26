## MODIFIED Requirements

### Requirement: Route visualization
The map SHALL display the computed route as an interactive, optionally color-coded polyline on the map.

#### Scenario: Display route
- **WHEN** BRouter returns a route GeoJSON
- **THEN** the route is rendered as a polyline on the map, colored according to the active color mode

#### Scenario: Route updates on waypoint change
- **WHEN** a waypoint is added, moved, or deleted
- **THEN** the route polyline updates after BRouter recomputes the route

#### Scenario: Ghost marker on hover
- **WHEN** the cursor is within 15 pixels of the route polyline
- **THEN** a transient ghost marker appears at the nearest route point, which can be clicked or dragged to insert a waypoint (see route-splitting and route-drag-reshape specs)
