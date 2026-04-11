## Purpose

GPX file import in the Planner via home page file picker and in-session drag-and-drop, with client-side parsing and waypoint extraction.

## Requirements

### Requirement: Import GPX from home page
Users SHALL be able to import a GPX file from the planner home page to start a new planning session.

#### Scenario: Upload GPX via file picker
- **WHEN** a user clicks the "Import GPX" button on the home page and selects a GPX file
- **THEN** the file is parsed client-side using `parseGpxAsync`
- **AND** waypoints are extracted via `extractWaypoints` (Douglas-Peucker for single-segment tracks)
- **AND** no-go areas are extracted from GPX extensions if present
- **AND** a new session is created with the extracted data
- **AND** the user is redirected to the new session

#### Scenario: Invalid GPX file
- **WHEN** a user uploads a file that is not valid GPX
- **THEN** an error message is shown
- **AND** no session is created

### Requirement: Import GPX via drag-and-drop
Users SHALL be able to drag a GPX file onto the map in an existing session.

#### Scenario: Drop GPX on map
- **WHEN** a user drags a `.gpx` file onto the map area
- **THEN** a visual drop zone indicator appears
- **AND** on drop, the file is parsed client-side
- **AND** a confirmation dialog asks whether to replace the current route
- **AND** on confirm, the session's waypoints and no-go areas are replaced with the imported data

#### Scenario: Cancel import
- **WHEN** a user drops a GPX file and the confirmation dialog appears
- **THEN** clicking "Cancel" leaves the session unchanged

### Requirement: Non-GPX file rejection
The Planner SHALL reject non-GPX files dropped on the map.

#### Scenario: Drop non-GPX file
- **WHEN** a user drops a non-GPX file on the map
- **THEN** the file is ignored with a brief error toast

### Requirement: Day break preservation
GPX import SHALL preserve overnight waypoint metadata for multi-day routes.

#### Scenario: Import GPX with overnight waypoints
- **WHEN** a GPX file contains waypoints with `<type>overnight</type>`
- **THEN** the imported waypoints have their `isDayBreak` / `overnight` flag set in Yjs
- **AND** the day breakdown appears in the sidebar

#### Scenario: Import GPX with POI metadata
- **WHEN** a GPX file contains waypoints imported from POI snap (with name)
- **THEN** the waypoint name is preserved on import
