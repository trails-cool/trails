## ADDED Requirements

### Requirement: Route color modes
The Planner SHALL support multiple route color modes that visualize per-point data along the route.

#### Scenario: Default plain mode
- **WHEN** a route is first displayed
- **THEN** it renders as a single-color blue polyline (current behavior)

#### Scenario: Elevation color mode
- **WHEN** a user selects the "Elevation" color mode
- **THEN** the route polyline is colored with a gradient from green (low) through yellow (mid) to red (high), based on the elevation at each point

#### Scenario: Surface color mode
- **WHEN** a user selects the "Surface" color mode and surface data is available
- **THEN** the route polyline is colored by surface type (e.g., asphalt=gray, gravel=brown, path=green, track=orange)

#### Scenario: Surface data unavailable
- **WHEN** a user selects "Surface" color mode but BRouter did not return surface data
- **THEN** the route falls back to plain color mode and a brief message indicates surface data is not available

### Requirement: Color mode toggle
The Planner SHALL provide a UI control to switch between route color modes.

#### Scenario: Toggle control location
- **WHEN** a route is displayed
- **THEN** a color mode selector is visible in the session header or map controls

#### Scenario: Color mode persists in session
- **WHEN** a user changes the color mode
- **THEN** the selection is stored in the Yjs routeData map and synced to all participants
