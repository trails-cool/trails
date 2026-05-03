## Purpose

Real-time collaborative editing sessions in the Planner using Yjs CRDTs, synchronizing waypoints, route options, and overlay preferences across all connected participants.

## Requirements

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

#### Scenario: Collaborative notes editing
- **WHEN** participant A types in the notes editor
- **THEN** participant B sees the text appear character-by-character in real-time
- **AND** participant B sees participant A's cursor position and name

#### Scenario: Notes cursor awareness
- **WHEN** participant A selects text in the notes editor
- **THEN** participant B sees participant A's selection highlighted in A's assigned color

#### Scenario: Notes persist across reload
- **WHEN** a participant reloads the session page
- **THEN** the notes content is restored from the Yjs document
- **AND** the editor displays the existing text immediately

### Requirement: Session expiry
Open sessions with no activity for 7 days SHALL be automatically deleted by a scheduled background job.

#### Scenario: Stale session cleanup
- **WHEN** the hourly `expire-sessions` cron job runs
- **THEN** all sessions with `last_activity` older than 7 days are deleted from the database
- **AND** their Yjs documents are removed from memory

#### Scenario: Active session preserved
- **WHEN** the `expire-sessions` job runs
- **THEN** sessions with `last_activity` within the last 7 days are NOT deleted

#### Scenario: Cleanup is observable
- **WHEN** the `expire-sessions` job completes
- **THEN** the job output includes the count of expired sessions
- **AND** the result is visible in the Grafana job queue dashboard
