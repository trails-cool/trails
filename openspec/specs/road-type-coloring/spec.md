## Purpose

Road type visualization for route planning. Extracts OSM highway classification from BRouter tiledesc data and provides a color mode that shows road type on both the map polyline and elevation chart.

## Requirements

### Requirement: Highway tag extraction from BRouter
The routing pipeline SHALL extract `highway=*` tags from BRouter tiledesc messages and include them in the enriched route data as a per-point `highways` array.

#### Scenario: Highway tags present in BRouter response
- **WHEN** BRouter returns a route with tiledesc messages containing `highway=*` in the WayTags column
- **THEN** the `EnrichedRoute` SHALL include a `highways` string array with one entry per coordinate point

#### Scenario: Highway tags missing from BRouter response
- **WHEN** BRouter returns a route without `highway=*` tags in WayTags
- **THEN** each entry in the `highways` array SHALL be `"unknown"`

#### Scenario: Highway data stored in Yjs
- **WHEN** a route is computed and enriched route data is received
- **THEN** the highway array SHALL be stored in Yjs `routeData` as a JSON-serialized string under the key `"highways"`

### Requirement: Road type color palette
The Planner SHALL define a color mapping for OSM highway classifications, grouped by road category.

#### Scenario: Major roads colored with warm tones
- **WHEN** a route segment has highway type `motorway`, `trunk`, or `primary`
- **THEN** the segment SHALL be colored in red/orange tones

#### Scenario: Urban roads colored with neutral tones
- **WHEN** a route segment has highway type `secondary`, `tertiary`, `residential`, or `unclassified`
- **THEN** the segment SHALL be colored in gray/blue tones

#### Scenario: Paths and cycling infrastructure colored with green tones
- **WHEN** a route segment has highway type `cycleway`, `path`, `footway`, `track`, or `bridleway`
- **THEN** the segment SHALL be colored in green tones

#### Scenario: Unknown highway type
- **WHEN** a route segment has an unrecognized or missing highway value
- **THEN** the segment SHALL be colored with a neutral default color

### Requirement: Road type map polyline coloring
The Planner map SHALL color the route polyline by highway classification when road type mode is active.

#### Scenario: Road type coloring on map
- **WHEN** the color mode is set to "highway"
- **THEN** the route polyline on the map SHALL be colored segment-by-segment using the road type color palette

#### Scenario: Fallback when highway data unavailable
- **WHEN** the color mode is set to "highway" but no highway data is available
- **THEN** the route SHALL fall back to plain color mode

### Requirement: Road type elevation chart coloring
The elevation chart SHALL color segments by highway classification when road type mode is active.

#### Scenario: Road type chart rendering
- **WHEN** the color mode is set to "highway"
- **THEN** the elevation chart line and fill segments SHALL be colored using the road type color palette, matching the map polyline

### Requirement: Road type legend
The elevation chart SHALL display a legend for road type mode showing the highway types present in the route.

#### Scenario: Road type legend display
- **WHEN** the color mode is "highway" and highway data is available
- **THEN** a legend SHALL show colored swatches with highway type labels for the types present in the current route, up to 6 entries with a "+N" overflow indicator

### Requirement: Road type hover information
The elevation chart hover label SHALL include the highway type when in road type mode.

#### Scenario: Road type hover label
- **WHEN** hovering the elevation chart in "highway" mode
- **THEN** the label SHALL show elevation, distance, and highway type name (e.g., "340m · 12.3km · cycleway")

### Requirement: Road type i18n
All user-facing strings for the road type color mode SHALL be translated in English and German.

#### Scenario: English labels
- **WHEN** the app language is English
- **THEN** the color mode dropdown SHALL show "Road Type" and the chart title SHALL show "Road Type Profile"

#### Scenario: German labels
- **WHEN** the app language is German
- **THEN** the color mode dropdown SHALL show "Straßentyp" and the chart title SHALL show "Straßentypenprofil"
