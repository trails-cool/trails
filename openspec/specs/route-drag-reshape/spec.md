## Requirements

### Requirement: Ghost marker on route hover
The Planner SHALL display a transient ghost marker when the cursor is near the route polyline, allowing users to reshape the route by dragging.

#### Scenario: Ghost marker appears on hover
- **WHEN** the cursor moves within 15 pixels of the route polyline
- **THEN** a ghost marker (small blue circle) appears at the nearest route coordinate point

#### Scenario: Ghost marker disappears on leave
- **WHEN** the cursor moves more than 15 pixels away from the route polyline
- **THEN** the ghost marker disappears

#### Scenario: Drag ghost marker to reshape
- **WHEN** a user drags the ghost marker to a new position
- **THEN** a new waypoint is inserted between the two adjacent waypoints of the hovered segment, and the route recomputes through the new point

#### Scenario: Trailer lines during drag
- **WHEN** a user is dragging the ghost marker
- **THEN** dashed guide lines are shown connecting the ghost marker to the adjacent waypoints

#### Scenario: No text selection during drag
- **WHEN** a user drags the ghost marker
- **THEN** text selection is disabled on the page (via Leaflet's built-in L.Draggable)

#### Scenario: Reshape syncs to other participants
- **WHEN** a user reshapes the route by dragging the ghost marker
- **THEN** all other participants see the new waypoint and recomputed route via Yjs sync
