## MODIFIED Requirements

### Requirement: Real-time collaborative editing
The Planner SHALL synchronize waypoint edits, route options, and overlay preferences across all connected participants in real-time using Yjs CRDTs.

#### Scenario: Add waypoint
- **WHEN** participant A adds a waypoint to the map
- **THEN** participant B sees the waypoint appear within 500ms

#### Scenario: Reorder waypoints
- **WHEN** participant A drags a waypoint to reorder it
- **THEN** participant B sees the updated waypoint order within 500ms

#### Scenario: Concurrent edits
- **WHEN** participant A and B both add waypoints simultaneously
- **THEN** both waypoints appear for both participants without conflict

#### Scenario: Overlay sync
- **WHEN** participant A enables the "Hillshading" tile overlay
- **THEN** participant B sees hillshading appear on their map within 500ms

#### Scenario: POI category sync
- **WHEN** participant A enables the "Drinking water" POI category
- **THEN** participant B sees drinking water markers appear on their map
