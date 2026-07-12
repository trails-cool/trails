## Purpose

A self-hosted POI index that serves OpenStreetMap points of interest for the Planner's POI categories from the instance's own database, replacing the third-party Overpass API. The index is refreshed on a schedule via an OSM extract pipeline and served through a same-origin, rate-limited endpoint with no third-party dependency at request time.

## Requirements

### Requirement: POI index table
The instance SHALL maintain a `planner.pois` table of OSM points of interest for the planner's POI categories, storing OSM type and id, category, optional name, centroid point geometry, the element's tags, and import timestamp, indexed for bbox-and-category lookup. Category membership SHALL be derived from the structured tag selectors defined in `@trails-cool/map-core`, which are the single source of truth for the pipeline filter and import-time classification.

#### Scenario: Bbox query by category
- **WHEN** the serving layer queries the index for "drinking water" within a viewport bbox
- **THEN** all indexed elements whose tags match that category's selectors and whose centroid lies in the bbox are returned

#### Scenario: Way POIs appear as points
- **WHEN** an OSM way (e.g. a campground area) matches a category selector
- **THEN** it is indexed with its centroid as the point geometry

### Requirement: Periodic import with atomic swap
The instance SHALL refresh the POI index on a schedule (monthly by default) by filtering an OSM data file to the category selectors, loading the result into a staging table, and swapping it in atomically so serving is never interrupted. The import SHALL abort without swapping when the staging row count falls below 70% of the live table's row count, unless bootstrap mode is explicitly enabled.

#### Scenario: Refresh replaces data without downtime
- **WHEN** a scheduled import completes successfully
- **THEN** the live table reflects the new dataset and no serving request observed an empty or partial table

#### Scenario: Shrunken dataset refused
- **WHEN** an import produces fewer than 70% of the live table's rows (e.g. truncated download)
- **THEN** no swap occurs, the live data stays untouched, and the failure is logged and visible in metrics

#### Scenario: Regional extract for self-hosters
- **WHEN** an operator configures a regional extract URL instead of the planet file
- **THEN** the same pipeline imports that region only

### Requirement: POI serving endpoint
The Planner SHALL serve POIs from the index via `/api/pois`, accepting a bbox and category list, enforcing the same-origin and session checks and the per-IP rate limit that the Overpass proxy enforced, and capping results at 100 per request. The response SHALL provide the fields the client's `Poi` shape requires (id, coordinates, name, category, tags). POI requests SHALL NOT contact any third-party service.

#### Scenario: Happy-path query
- **WHEN** the browser requests two enabled categories for the current viewport
- **THEN** the endpoint returns matching POIs from the local index with their tags

#### Scenario: Missing index degrades gracefully
- **WHEN** the POI table is empty or absent (fresh self-hosted instance)
- **THEN** the endpoint returns an empty result or a service-unavailable status without errors that break the map

### Requirement: Index freshness observability
The instance SHALL expose metrics for index size per category, index age, import job outcome, and serving request counts, and the monitoring stack SHALL alert when the index age indicates a missed refresh.

#### Scenario: Stale index alerts
- **WHEN** the index age exceeds the alert threshold (~6 weeks)
- **THEN** an alert fires identifying the POI import as unhealthy
