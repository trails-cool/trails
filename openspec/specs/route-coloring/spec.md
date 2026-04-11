## Purpose

Multi-mode route visualization (plain, elevation gradient, surface type, grade) with session-synced color mode selection. Both the route polyline on the map and the elevation chart reflect the selected color mode.

## Requirements

### Requirement: Route color modes
The Planner SHALL support multiple route color modes that visualize per-point data along the route.

#### Scenario: Default plain mode
- **WHEN** a route is first displayed
- **THEN** it renders as a single-color blue polyline

#### Scenario: Elevation color mode
- **WHEN** a user selects the "Elevation" color mode
- **THEN** the route polyline is colored with a gradient from green (low) through yellow (mid) to red (high), based on the elevation at each point

#### Scenario: Surface color mode
- **WHEN** a user selects the "Surface" color mode and surface data is available from BRouter tiledesc
- **THEN** the route polyline is colored by surface type (e.g., asphalt=gray, gravel=brown, path=green, track=orange)

#### Scenario: Surface data unavailable
- **WHEN** a user selects "Surface" color mode but BRouter did not return surface data
- **THEN** the route falls back to plain color mode

#### Scenario: Grade color mode
- **WHEN** a user selects the "Grade" color mode
- **THEN** the route polyline is colored by steepness: green (<3%), yellow (<6%), orange (<10%), red (<15%), dark red (15%+)

### Requirement: Color mode toggle
The Planner SHALL provide a UI control to switch between route color modes.

#### Scenario: Toggle control location
- **WHEN** a route is displayed
- **THEN** a color mode select dropdown is visible inline with the elevation chart title

#### Scenario: Color mode persists in session
- **WHEN** a user changes the color mode
- **THEN** the selection is stored in the Yjs routeData map and synced to all participants

### Requirement: Elevation chart color sync
The elevation profile chart SHALL use the same coloring as the route for each color mode.

#### Scenario: Elevation mode chart coloring
- **WHEN** the color mode is set to "Elevation"
- **THEN** the elevation chart line and fill use the same green→yellow→red gradient as the route polyline

#### Scenario: Surface mode chart coloring
- **WHEN** the color mode is set to "Surface" and surface data is available
- **THEN** the elevation chart segments are colored by surface type, matching the route

#### Scenario: Grade mode chart coloring
- **WHEN** the color mode is set to "Grade"
- **THEN** the elevation chart segments are colored by steepness, matching the route

#### Scenario: Plain mode chart coloring
- **WHEN** the color mode is "Plain"
- **THEN** the elevation chart uses the default blue color

### Requirement: Color legends
The elevation chart SHALL display a legend matching the active color mode.

#### Scenario: Grade legend
- **WHEN** the color mode is "Grade"
- **THEN** the legend shows colored swatches with percentage thresholds (<3%, <6%, <10%, <15%, 15%+)

#### Scenario: Elevation legend
- **WHEN** the color mode is "Elevation"
- **THEN** the legend shows a gradient bar with the route's minimum and maximum elevation in meters

#### Scenario: Surface legend
- **WHEN** the color mode is "Surface"
- **THEN** the legend shows the surface types present in the route with colored swatches

### Requirement: Contextual hover information
The elevation chart hover label SHALL show mode-specific information.

#### Scenario: Grade hover
- **WHEN** hovering the chart in "Grade" mode
- **THEN** the label shows elevation, distance, and grade percentage (e.g. "340m · 12.3km · +4.2%")

#### Scenario: Surface hover
- **WHEN** hovering the chart in "Surface" mode
- **THEN** the label shows elevation, distance, and surface type name (e.g. "340m · 12.3km · asphalt")
