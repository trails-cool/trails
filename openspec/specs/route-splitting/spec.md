## Purpose

Splitting a route segment into two by inserting a waypoint at the segment midpoint via the midpoint handle. This is the same mechanism as route-drag-reshape — the distinction is user intent: reshape moves the new waypoint to reroute, while split leaves it in place as a named stop or day-break marker.

See `route-drag-reshape` for the midpoint handle interaction model.

## Requirements

### Requirement: Insert waypoint at segment midpoint
The Planner SHALL allow users to split a segment by clicking its midpoint handle, inserting a new waypoint at the geometric midpoint of the segment.

#### Scenario: Click midpoint handle to split
- **WHEN** a user clicks a midpoint handle on the route
- **THEN** a new waypoint is inserted at the geometric midpoint of that segment between the appropriate adjacent waypoints
- **AND** the route recomputes through the new waypoint

#### Scenario: Split syncs to other participants
- **WHEN** a user splits a segment
- **THEN** all other participants see the new waypoint appear in the waypoint list and on the map via Yjs sync

#### Scenario: Split waypoint can be named
- **WHEN** a waypoint is inserted by splitting
- **THEN** the user can click the waypoint to open its editor and assign a name, type (e.g. overnight), or note

## Note on ghost marker position

The inserted waypoint is placed at the **geometric midpoint** of the segment (midpoint index = `Math.floor((startIdx + endIdx) / 2)` of the BRouter coordinate array), not at the cursor position or the closest point on the polyline to the cursor. This is a deliberate simplification of the midpoint-handle model.
