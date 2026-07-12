## MODIFIED Requirements

### Requirement: POI categories
The Planner SHALL support the following POI categories served from the instance's own POI index (`/api/pois`): drinking water, shelter, camping, food & drink, groceries, bike infrastructure, accommodation, viewpoints, and toilets.

#### Scenario: Enable a POI category
- **WHEN** a user enables the "Drinking water" category in the POI panel
- **THEN** drinking water POIs within the current map viewport are fetched from the instance's POI index and rendered as markers

#### Scenario: Disable a POI category
- **WHEN** a user disables a previously enabled POI category
- **THEN** markers for that category are removed from the map

#### Scenario: Multiple categories enabled
- **WHEN** a user enables "Camping" and "Drinking water" simultaneously
- **THEN** both categories of markers are visible, each with distinct icons

### Requirement: Viewport-scoped POI loading
The Planner SHALL load POIs only within the current map viewport, refreshing when the viewport changes.

#### Scenario: Load POIs on viewport
- **WHEN** POI categories are enabled and the user pans or zooms the map
- **THEN** POIs are fetched for the new viewport after an 800ms debounce (`DEBOUNCE_MS` in `use-pois.ts`); a minimum request interval of 2000ms additionally throttles rapid viewport changes

#### Scenario: Zoom threshold
- **WHEN** the map zoom level is below 10 (`MIN_ZOOM` constant in `use-pois.ts`)
- **THEN** POI queries are not sent and a message indicates the user should zoom in to see POIs

#### Scenario: Cached results
- **WHEN** the user pans back to a previously viewed area within 10 minutes
- **THEN** cached POI results are displayed without a new POI request

## REMOVED Requirements

### Requirement: Overpass rate limit handling
**Reason**: The Overpass API dependency is removed; POIs are served from the instance's own index. Degradation handling is re-specified source-neutrally below.
**Migration**: The client error UI is unchanged; it now reacts to 429/5xx from `/api/pois` instead of Overpass statuses.

## ADDED Requirements

### Requirement: POI service degradation handling
The Planner SHALL handle POI endpoint failures gracefully.

#### Scenario: Rate limited response
- **WHEN** `/api/pois` returns a 429 status
- **THEN** the Planner shows a temporary "POI data unavailable — try again shortly" message and sets a backoff delay before the next request

#### Scenario: POI service unavailable
- **WHEN** `/api/pois` is unreachable or returns a server error
- **THEN** the Planner shows a message and tile overlays continue to function normally
