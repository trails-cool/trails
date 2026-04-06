## Purpose

Multi-mode route visualization (plain, elevation gradient, surface type) with session-synced color mode selection.

## Requirements

### Requirement: Route color modes
The Planner SHALL support multiple route color modes that visualize per-point data along the route.

#### Scenario: Default plain mode
- **WHEN** a route is first displayed
- **THEN** it renders as a single-color blue polyline (current behavior)

#### Scenario: Elevation color mode
- **WHEN** a user selects the "Elevation" color mode
- **THEN** the route polyline is colored with a gradient from green (low) through yellow (mid) to red (high), based on the elevation at each point

#### Scenario: Surface color mode
- **WHEN** a user selects the "Surface" color mode and surface data is available from BRouter tiledesc
- **THEN** the route polyline is colored by surface type (e.g., asphalt=gray, gravel=brown, path=green, track=orange)

#### Scenario: Surface data unavailable
- **WHEN** a user selects "Surface" color mode but BRouter did not return surface data
- **THEN** the route falls back to plain color mode

### Requirement: Color mode toggle
The Planner SHALL provide a UI control to switch between route color modes.

#### Scenario: Toggle control location
- **WHEN** a route is displayed
- **THEN** a color mode select dropdown is visible in the session header

#### Scenario: Color mode persists in session
- **WHEN** a user changes the color mode
- **THEN** the selection is stored in the Yjs routeData map and synced to all participants

### Requirement: Elevation chart color sync
The elevation profile chart SHALL use the same color gradient as the route when in elevation mode.

#### Scenario: Elevation mode chart coloring
- **WHEN** the color mode is set to "Elevation"
- **THEN** the elevation chart line and fill use the same green→yellow→red gradient as the route polyline

#### Scenario: Plain mode chart coloring
- **WHEN** the color mode is "Plain" or "Surface"
- **THEN** the elevation chart uses the default blue color
