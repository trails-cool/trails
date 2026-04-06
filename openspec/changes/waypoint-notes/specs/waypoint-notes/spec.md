## ADDED Requirements

### Requirement: Per-waypoint text notes
Each waypoint SHALL support an optional plain-text note synced via Yjs.

#### Scenario: Add note to waypoint
- **WHEN** a user clicks the note area under a waypoint in the sidebar and types text
- **THEN** the note is stored in the waypoint's Y.Map as a `note` string field
- **AND** auto-saves on blur

#### Scenario: Note syncs to participants
- **WHEN** a user adds or edits a waypoint note
- **THEN** all other participants see the update in real-time via Yjs

### Requirement: Map note indicators
Waypoint markers with notes SHALL show a visual indicator on the map.

#### Scenario: Note icon on marker
- **WHEN** a waypoint has a note
- **THEN** its map marker shows a small note icon

#### Scenario: Note tooltip
- **WHEN** a user hovers or taps a marker with a note
- **THEN** the note text appears in a tooltip

### Requirement: Notes in GPX export
Waypoint notes SHALL be exported as `<desc>` elements in GPX output.

#### Scenario: Export notes
- **WHEN** a user exports a plan with waypoint notes
- **THEN** each waypoint's note appears as a `<desc>` element in the GPX file

### Requirement: Nearby POI display
When a waypoint is selected, nearby POIs from OpenStreetMap SHALL be shown on the map and in the sidebar.

#### Scenario: POI lookup
- **WHEN** a user selects a waypoint
- **THEN** nearby POIs are fetched from the Overpass API and displayed as small markers on the map and as a list in the sidebar

### Requirement: Snap waypoint to POI
Users SHALL be able to move a waypoint to a nearby POI's exact coordinates.

#### Scenario: Snap to POI
- **WHEN** a user clicks a nearby POI
- **THEN** the waypoint moves to the POI's coordinates
- **AND** the POI's name and type are added as a note prefix (e.g., "Campsite - Waldcamp Fichtelberg")
