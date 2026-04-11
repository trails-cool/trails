## ADDED Requirements

### Requirement: POI overlay panel
The Planner SHALL provide a collapsible panel for toggling POI categories on the map.

#### Scenario: Open POI panel
- **WHEN** a user clicks the POI toggle button on the map
- **THEN** a panel opens showing checkboxes for each POI category with icons and names

#### Scenario: Close POI panel
- **WHEN** the POI panel is open and the user clicks the toggle button again
- **THEN** the panel collapses and POI markers remain visible on the map

### Requirement: POI categories
The Planner SHALL support the following POI categories queried from OpenStreetMap via Overpass API: drinking water, shelter, camping, food & drink, groceries, bike infrastructure, accommodation, viewpoints, and toilets.

#### Scenario: Enable a POI category
- **WHEN** a user enables the "Drinking water" category in the POI panel
- **THEN** drinking water POIs within the current map viewport are fetched from Overpass and rendered as markers

#### Scenario: Disable a POI category
- **WHEN** a user disables a previously enabled POI category
- **THEN** markers for that category are removed from the map

#### Scenario: Multiple categories enabled
- **WHEN** a user enables "Camping" and "Drinking water" simultaneously
- **THEN** both categories of markers are visible, each with distinct icons

### Requirement: POI markers
Each POI SHALL be rendered as a map marker with a category-specific icon.

#### Scenario: POI marker display
- **WHEN** POIs are loaded for an enabled category
- **THEN** each POI appears as a small icon marker at its coordinates on the map

#### Scenario: POI marker popup
- **WHEN** a user clicks a POI marker
- **THEN** a popup shows the POI name, category, and available details (opening hours, website, OSM link)

#### Scenario: POI marker clustering
- **WHEN** many POIs are visible in a small area
- **THEN** markers are clustered with a count badge, and expand when the user zooms in

### Requirement: Viewport-scoped POI loading
The Planner SHALL load POIs only within the current map viewport, refreshing when the viewport changes.

#### Scenario: Load POIs on viewport
- **WHEN** POI categories are enabled and the user pans or zooms the map
- **THEN** POIs are fetched for the new viewport after a 500ms debounce

#### Scenario: Zoom threshold
- **WHEN** the map zoom level is below 12
- **THEN** POI queries are not sent and a message indicates the user should zoom in to see POIs

#### Scenario: Cached results
- **WHEN** the user pans back to a previously viewed area within 10 minutes
- **THEN** cached POI results are displayed without a new Overpass query

### Requirement: Overpass rate limit handling
The Planner SHALL handle Overpass API rate limits gracefully.

#### Scenario: Rate limited response
- **WHEN** the Overpass API returns a 429 status
- **THEN** the Planner shows a temporary "POI data unavailable — try again shortly" message and retries with exponential backoff

#### Scenario: Overpass unavailable
- **WHEN** the Overpass API is unreachable
- **THEN** the Planner shows a message and tile overlays continue to function normally

### Requirement: Profile-aware POI defaults
The Planner SHALL auto-enable relevant POI categories when the routing profile changes.

#### Scenario: Cycling profile POI defaults
- **WHEN** the routing profile is changed to a cycling variant
- **THEN** the "Bike infrastructure" POI category is automatically enabled

#### Scenario: Hiking profile POI defaults
- **WHEN** the routing profile is changed to a hiking variant
- **THEN** "Shelter" and "Viewpoints" POI categories are automatically enabled

#### Scenario: User override persists
- **WHEN** a user manually disables an auto-enabled POI category
- **THEN** it remains disabled until the next profile change
