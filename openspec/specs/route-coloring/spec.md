## Purpose

Multi-mode route visualization (plain, elevation, grade, surface, road type, speed limit, smoothness, track type, cycleway, bike route) with session-synced color mode selection. Both the route polyline on the map and the elevation chart reflect the selected color mode. Chart titles link to the corresponding OSM wiki page.

## Requirements

### Requirement: Route color modes
The Planner SHALL support multiple route color modes that visualize per-point data along the route.

#### Scenario: Default plain mode
- **WHEN** a route is first displayed
- **THEN** it renders as a single-color blue polyline

#### Scenario: Elevation color mode
- **WHEN** a user selects the "Elevation" color mode
- **THEN** the route polyline is colored with a gradient from green (low) through yellow (mid) to red (high), based on the elevation at each point

#### Scenario: Grade color mode
- **WHEN** a user selects the "Grade" color mode
- **THEN** the route polyline is colored by steepness: green (<3%), yellow (<6%), orange (<10%), red (<15%), dark red (15%+)

#### Scenario: Surface color mode
- **WHEN** a user selects the "Surface" color mode and surface data is available from BRouter tiledesc
- **THEN** the route polyline is colored by surface type (e.g., asphalt=gray, gravel=brown, path=green)

#### Scenario: Road type color mode
- **WHEN** a user selects the "Road Type" color mode and highway data is available
- **THEN** the route polyline is colored by OSM highway classification (greens for cycling infra, grays for urban, reds for major roads)

#### Scenario: Speed limit color mode
- **WHEN** a user selects the "Speed Limit" color mode and maxspeed data is available
- **THEN** the route polyline is colored by speed limit: green (≤30), yellow (≤50), orange (≤70), red (≤100), dark red (100+)

#### Scenario: Smoothness color mode
- **WHEN** a user selects the "Smoothness" color mode and smoothness data is available
- **THEN** the route polyline is colored by road smoothness: green (excellent) through to dark red (impassable)

#### Scenario: Track type color mode
- **WHEN** a user selects the "Track Type" color mode and tracktype data is available
- **THEN** the route polyline is colored by track quality: green (grade1, best) through red (grade5, worst)

#### Scenario: Cycleway color mode
- **WHEN** a user selects the "Cycleway" color mode and cycleway data is available
- **THEN** the route polyline is colored by cycleway infrastructure type (track=green, lane=lime, shared_lane=yellow, no=red)

#### Scenario: Bike route color mode
- **WHEN** a user selects the "Bike Route" color mode
- **THEN** the route polyline is colored by bicycle route network level: purple (international), blue (national), teal (regional), emerald (local), gray (none)

#### Scenario: Data unavailable fallback
- **WHEN** a user selects any tag-based color mode but the data is not available from BRouter
- **THEN** the route falls back to plain color mode

### Requirement: Color mode toggle
The Planner SHALL provide a UI control to switch between route color modes.

#### Scenario: Toggle control location
- **WHEN** a route is displayed
- **THEN** a color mode select dropdown is visible inline with the elevation chart title

#### Scenario: Dropdown order
- **WHEN** the color mode dropdown is displayed
- **THEN** options appear in order: Plain, Elevation, Grade, Surface, Road Type, Speed Limit, Smoothness, Track Type, Cycleway, Bike Route

#### Scenario: Color mode persists in session
- **WHEN** a user changes the color mode
- **THEN** the selection is stored in the Yjs routeData map and synced to all participants

### Requirement: Elevation chart color sync
The elevation profile chart SHALL use the same coloring as the route for each color mode.

#### Scenario: Chart coloring matches map
- **WHEN** any color mode is active
- **THEN** the elevation chart segments are colored using the same palette as the route polyline on the map

#### Scenario: Plain mode chart coloring
- **WHEN** the color mode is "Plain"
- **THEN** the elevation chart uses the default blue color

### Requirement: Color legends
The elevation chart SHALL display an inline legend matching the active color mode.

#### Scenario: Grade legend
- **WHEN** the color mode is "Grade"
- **THEN** the legend shows colored swatches with percentage thresholds (<3%, <6%, <10%, <15%, 15%+)

#### Scenario: Elevation legend
- **WHEN** the color mode is "Elevation"
- **THEN** the legend shows a gradient bar with the route's min and max elevation in meters

#### Scenario: Tag-based legends
- **WHEN** the color mode is Surface, Road Type, Smoothness, Track Type, or Cycleway
- **THEN** the legend shows the unique values present in the route with colored swatches (max 6 with overflow indicator)

#### Scenario: Speed limit legend
- **WHEN** the color mode is "Speed Limit"
- **THEN** the legend shows colored swatches with speed thresholds (≤30, ≤50, ≤70, ≤100, 100+)

#### Scenario: Bike route legend
- **WHEN** the color mode is "Bike Route"
- **THEN** the legend shows International, National, Regional, Local, None with colored swatches

### Requirement: Contextual hover information
The elevation chart hover label SHALL show mode-specific information.

#### Scenario: Hover label
- **WHEN** hovering the chart in any tag-based mode
- **THEN** the label shows elevation, distance, and the tag value (e.g. "340m · 12.3km · asphalt")

#### Scenario: Grade hover
- **WHEN** hovering in Grade mode
- **THEN** the label additionally shows grade percentage (e.g. "+4.2%")

#### Scenario: Speed limit hover
- **WHEN** hovering in Speed Limit mode
- **THEN** the label shows the speed with "km/h" suffix

#### Scenario: Bike route hover
- **WHEN** hovering in Bike Route mode
- **THEN** the label shows human-readable network names (International/National/Regional/Local)

### Requirement: OSM wiki links
The elevation chart title SHALL link to the corresponding OSM wiki page for tag-based modes.

#### Scenario: Title links
- **WHEN** the color mode is a tag-based mode (surface, highway, maxspeed, smoothness, tracktype, cycleway, bikeroute)
- **THEN** the chart title is a clickable link to the relevant OSM wiki page

#### Scenario: Non-tag modes
- **WHEN** the color mode is Plain, Elevation, or Grade
- **THEN** the chart title is plain text (no link)

### Requirement: BRouter profile patching
The BRouter Docker image SHALL patch profiles to expose additional tags in WayTags output.

#### Scenario: Maxspeed and tracktype exposure
- **WHEN** the BRouter Docker image is built
- **THEN** all routing profiles are patched with `assign dummyUsage2 = maxspeed=` and `assign dummyUsage3 = tracktype=` to include these tags in tiledesc WayTags
