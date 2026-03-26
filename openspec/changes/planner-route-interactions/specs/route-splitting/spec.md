## ADDED Requirements

### Requirement: Insert waypoint by clicking on route
The Planner SHALL allow users to insert a new waypoint by clicking on the rendered route polyline.

#### Scenario: Click on route between two waypoints
- **WHEN** a user clicks on the route polyline between waypoint 2 and waypoint 3
- **THEN** a new waypoint is inserted at position 3 (between the original waypoints 2 and 3) at the clicked location, and the route recomputes

#### Scenario: Waypoint snaps to route
- **WHEN** a user clicks near the route polyline
- **THEN** the new waypoint is placed at the closest point on the existing route geometry, not at the raw click position

#### Scenario: Split syncs to other participants
- **WHEN** a user inserts a waypoint by clicking on the route
- **THEN** all other participants see the new waypoint appear in the waypoint list and on the map via Yjs sync
