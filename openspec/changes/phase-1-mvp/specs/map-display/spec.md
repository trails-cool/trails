## ADDED Requirements

### Requirement: Map rendering with OSM tiles
The Planner and Journal SHALL render interactive maps using Leaflet with OpenStreetMap tiles as the default base layer.

#### Scenario: Default map view
- **WHEN** a user opens the Planner or a route view in the Journal
- **THEN** an interactive map is displayed with OpenStreetMap tiles centered on the route or a default location (Germany)

### Requirement: Base layer switching
The map SHALL support switching between multiple base tile layers.

#### Scenario: Switch to OpenTopoMap
- **WHEN** a user selects "OpenTopoMap" from the layer switcher
- **THEN** the map tiles change to topographic tiles from OpenTopoMap

#### Scenario: Available base layers
- **WHEN** a user opens the layer switcher
- **THEN** the options include OpenStreetMap, OpenTopoMap, and CyclOSM

### Requirement: Waypoint editing on map
The Planner map SHALL allow users to add, move, and delete waypoints by interacting with the map.

#### Scenario: Add waypoint by clicking
- **WHEN** a user clicks on the map
- **THEN** a new waypoint is added at the clicked location and synced via Yjs

#### Scenario: Move waypoint by dragging
- **WHEN** a user drags an existing waypoint marker
- **THEN** the waypoint coordinates update and sync via Yjs

#### Scenario: Delete waypoint
- **WHEN** a user right-clicks a waypoint and selects "Delete"
- **THEN** the waypoint is removed and the change syncs via Yjs

### Requirement: Route visualization
The map SHALL display the computed route as a polyline on the map.

#### Scenario: Display route
- **WHEN** BRouter returns a route GeoJSON
- **THEN** the route is rendered as a colored polyline on the map

#### Scenario: Route updates on waypoint change
- **WHEN** a waypoint is added, moved, or deleted
- **THEN** the route polyline updates after BRouter recomputes the route

### Requirement: Elevation profile display
The Planner SHALL display an elevation profile chart for the current route.

#### Scenario: Show elevation profile
- **WHEN** a route is computed
- **THEN** an elevation profile chart is displayed below the map showing distance vs elevation with total ascent/descent statistics
