## MODIFIED Requirements

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

#### Scenario: Road type color mode
- **WHEN** a user selects the "Road Type" color mode and highway data is available from BRouter tiledesc
- **THEN** the route polyline is colored by OSM highway classification using the road type color palette

#### Scenario: Road type data unavailable
- **WHEN** a user selects "Road Type" color mode but BRouter did not return highway data
- **THEN** the route falls back to plain color mode

### Requirement: Color mode toggle
The Planner SHALL provide a UI control to switch between route color modes.

#### Scenario: Toggle control location
- **WHEN** a route is displayed
- **THEN** a color mode select dropdown is visible inline with the elevation chart title

#### Scenario: Road type option in toggle
- **WHEN** the color mode dropdown is displayed
- **THEN** it SHALL include a "Road Type" option alongside Plain, Elevation, Surface, and Grade

#### Scenario: Color mode persists in session
- **WHEN** a user changes the color mode
- **THEN** the selection is stored in the Yjs routeData map and synced to all participants

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

#### Scenario: Road type legend
- **WHEN** the color mode is "Road Type"
- **THEN** the legend shows the highway types present in the route with colored swatches, up to 6 entries

### Requirement: Contextual hover information
The elevation chart hover label SHALL show mode-specific information.

#### Scenario: Grade hover
- **WHEN** hovering the chart in "Grade" mode
- **THEN** the label shows elevation, distance, and grade percentage (e.g. "340m · 12.3km · +4.2%")

#### Scenario: Surface hover
- **WHEN** hovering the chart in "Surface" mode
- **THEN** the label shows elevation, distance, and surface type name (e.g. "340m · 12.3km · asphalt")

#### Scenario: Road type hover
- **WHEN** hovering the chart in "Road Type" mode
- **THEN** the label shows elevation, distance, and highway type name (e.g. "340m · 12.3km · cycleway")
