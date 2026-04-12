## ADDED Requirements

### Requirement: Map-based waypoint editing
The system SHALL allow users to add, move, and delete waypoints on a native map view.

#### Scenario: Add waypoint
- **WHEN** the user long-presses on the map
- **THEN** a new waypoint is added at that location and the route is recomputed through it

#### Scenario: Move waypoint
- **WHEN** the user drags an existing waypoint marker
- **THEN** the waypoint position updates and the route segments connected to it are recomputed

#### Scenario: Delete waypoint
- **WHEN** the user taps a waypoint and confirms deletion
- **THEN** the waypoint is removed and the route is recomputed without it

### Requirement: Overnight stops and POI snap
The system SHALL support marking waypoints as overnight stops and snapping to nearby POIs.

#### Scenario: Toggle overnight stop
- **WHEN** the user taps a waypoint and toggles "Overnight stop"
- **THEN** the waypoint is marked with an overnight icon and day segments update accordingly

#### Scenario: POI snap suggestion
- **WHEN** the user adds a waypoint near a known POI (campsite, shelter, etc.)
- **THEN** the system suggests snapping to the POI location and applying its name

### Requirement: BRouter routing
The system SHALL compute route segments between waypoints via the BRouter routing engine.

#### Scenario: Route computation
- **WHEN** two or more waypoints exist
- **THEN** the system requests a route from BRouter (proxied through the Journal API) and displays the resulting polyline on the map

#### Scenario: Routing error
- **WHEN** BRouter fails to compute a route between waypoints
- **THEN** the system shows an error and falls back to displaying a straight line between waypoints

### Requirement: Save route to Journal
The system SHALL save edited routes back to the Journal via its API.

#### Scenario: Save after editing
- **WHEN** the user taps "Save" after editing a route
- **THEN** the updated GPX is generated from current waypoints and route geometry, and saved to the Journal API as a new version

#### Scenario: Unsaved changes warning
- **WHEN** the user navigates away from the editor with unsaved changes
- **THEN** the system prompts the user to save or discard changes
