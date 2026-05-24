## Purpose

Segment midpoint handles on the route polyline that allow users to reshape the route by inserting new waypoints, then dragging them to a desired position.

## Implementation note

The shipped interaction uses **permanent segment midpoint handles** — one semi-transparent circle rendered at the geometric center of each route segment — rather than a proximity-based hover ghost marker. Handles are visible at zoom ≥ 12. Clicking a handle inserts a new waypoint at the midpoint position; the user then drags that waypoint (standard Leaflet marker drag) to reshape the route.

## Requirements

### Requirement: Segment midpoint handles
The Planner SHALL render a midpoint handle at the geometric center of each route segment.

#### Scenario: Handles visible at sufficient zoom
- **WHEN** the map zoom level is 12 or above and the route has two or more waypoints
- **THEN** a semi-transparent circle is rendered at the midpoint of each segment between consecutive waypoints

#### Scenario: Handles hidden at low zoom
- **WHEN** the map zoom level is below 12
- **THEN** midpoint handles are not rendered (the map is too far out for precise editing)

#### Scenario: Handles update on waypoint change
- **WHEN** a waypoint is added, moved, or removed
- **THEN** midpoint handles reposition to reflect the updated segment geometry

### Requirement: Insert waypoint by clicking a midpoint handle
Clicking a midpoint handle SHALL insert a new waypoint at that handle's position, splitting the segment in two.

#### Scenario: Click to insert
- **WHEN** a user clicks a midpoint handle
- **THEN** a new waypoint is inserted at the geometric midpoint of that segment
- **AND** the route recomputes through the new waypoint, splitting the segment into two

#### Scenario: Inserted waypoint is immediately draggable
- **WHEN** a new waypoint is inserted via a midpoint handle
- **THEN** the user can immediately drag the new waypoint to adjust the route shape
- **AND** the route recomputes continuously as the waypoint is dragged (standard waypoint drag behaviour)

#### Scenario: Insert syncs to other participants
- **WHEN** a user inserts a waypoint via a midpoint handle
- **THEN** all other participants see the new waypoint appear in the waypoint list and on the map via Yjs sync
