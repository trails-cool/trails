## ADDED Requirements

### Requirement: Surface breakdown derived from BRouter waytags
The system SHALL compute a distance-weighted surface and waytype distribution for a Planner-created route from its per-segment BRouter waytags at save time, and persist it with the route.

#### Scenario: Breakdown captured on save
- **WHEN** a route is saved from the Planner with per-segment surface/highway waytags
- **THEN** the route stores a distance-weighted breakdown of metres per surface category and per waytype category

#### Scenario: No waytags available
- **WHEN** a route is saved without waytags
- **THEN** no breakdown is stored synchronously (an async backfill may fill it later)

### Requirement: Async surface backfill via Overpass
The system SHALL asynchronously derive a surface breakdown for a route or activity that has geometry but no stored breakdown, by map-matching its geometry to OpenStreetMap ways via Overpass in a background job, and SHALL store the resulting distance-weighted breakdown.

#### Scenario: Imported activity is backfilled
- **WHEN** an activity is imported (e.g. from Komoot) with geometry but no waytags
- **THEN** a backfill job map-matches its geometry to OSM ways and stores a surface/waytype breakdown

#### Scenario: Backfill is best-effort and idempotent
- **WHEN** a backfill job runs for a row that already has a breakdown
- **THEN** it does no work; and **WHEN** Overpass is unavailable, the row is left without a breakdown rather than erroring

#### Scenario: Untagged segments
- **WHEN** map-matched ways have no surface tag
- **THEN** those segments' distance is bucketed as unknown

### Requirement: Live update when a backfill completes
The detail page SHALL update its breakdown without a reload when a backfill for the row being viewed completes, via a server-sent event.

#### Scenario: Bars appear after backfill
- **WHEN** a user is viewing a route/activity detail page whose backfill finishes
- **THEN** the page receives a `surface_breakdown` event for that row and renders the bars without a manual reload

### Requirement: Surface and waytype proportion bars
The route and activity detail pages SHALL render the surface and waytype breakdown as proportion bars when the row has breakdown data, coloured with the shared surface/highway palettes, each segment labelled with its category, distance, and percentage.

#### Scenario: Bars shown for a row with a breakdown
- **WHEN** a user views a route or activity that has a stored surface breakdown
- **THEN** a surface proportion bar and a waytype proportion bar are shown, each segment coloured by category with the largest category first

#### Scenario: Percentages reflect distance share
- **WHEN** a route is 62% asphalt and 28% gravel and 10% path by distance
- **THEN** the surface bar's segments are sized 62% / 28% / 10% and labelled accordingly

#### Scenario: Unknown tags collapse to "other"
- **WHEN** some segments have no recognized surface tag
- **THEN** their distance is shown as an "other" segment rather than omitted

#### Scenario: Hidden without data
- **WHEN** a row has no stored breakdown
- **THEN** no breakdown bars are rendered

### Requirement: Localized breakdown labels
The breakdown SHALL render its category and unit labels through localized strings.

#### Scenario: German labels
- **WHEN** the UI locale is German
- **THEN** the breakdown's category and unit labels render in German
