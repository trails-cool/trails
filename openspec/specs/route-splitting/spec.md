## Requirements

### Requirement: Insert waypoint by clicking on route
The Planner SHALL allow users to insert a new waypoint by clicking the ghost marker that appears when hovering near the route.

#### Scenario: Click ghost marker to split
- **WHEN** a ghost marker is visible on the route and the user clicks it
- **THEN** a new waypoint is inserted at the ghost marker position between the appropriate adjacent waypoints, and the route recomputes

#### Scenario: Waypoint snaps to route
- **WHEN** the ghost marker appears near the route
- **THEN** it is positioned at the closest coordinate point on the existing route geometry, not at the raw cursor position

#### Scenario: No duplicate waypoint from map click
- **WHEN** a user clicks the ghost marker to insert a waypoint
- **THEN** the map click handler is suppressed so only one waypoint is inserted (not an additional one appended at the end)

#### Scenario: Split syncs to other participants
- **WHEN** a user inserts a waypoint by clicking the ghost marker
- **THEN** all other participants see the new waypoint appear in the waypoint list and on the map via Yjs sync
