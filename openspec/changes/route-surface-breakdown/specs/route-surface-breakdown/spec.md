## ADDED Requirements

### Requirement: Surface breakdown derived from BRouter waytags
The system SHALL compute a distance-weighted surface and waytype distribution for a Planner-created route from the per-segment BRouter waytags at save time, and persist it with the route.

#### Scenario: Breakdown captured on save
- **WHEN** a route is saved from the Planner with per-segment surface/highway waytags
- **THEN** the route stores a distance-weighted breakdown of metres per surface category and per waytype category

#### Scenario: No waytags available
- **WHEN** a route is saved without waytags (no surface data)
- **THEN** no breakdown is stored, and the route detail shows no breakdown bars

### Requirement: Surface and waytype proportion bars
The route detail page SHALL render the surface and waytype breakdown as proportion bars when the route has breakdown data, coloured with the shared surface/highway palettes, each segment labelled with its category, distance, and percentage.

#### Scenario: Bars shown for a route with a breakdown
- **WHEN** a user views a route that has a stored surface breakdown
- **THEN** a surface proportion bar and a waytype proportion bar are shown, each segment coloured by category with the largest category first

#### Scenario: Percentages reflect distance share
- **WHEN** a route is 62% asphalt and 28% gravel and 10% path by distance
- **THEN** the surface bar's segments are sized 62% / 28% / 10% and labelled accordingly

#### Scenario: Unknown tags collapse to "other"
- **WHEN** some segments have no recognized surface tag
- **THEN** their distance is shown as an "other" segment rather than omitted

#### Scenario: Hidden without data
- **WHEN** a route has no stored breakdown
- **THEN** no breakdown bars are rendered

### Requirement: Localized breakdown labels
The breakdown SHALL render its category and unit labels through localized strings.

#### Scenario: German labels
- **WHEN** the UI locale is German
- **THEN** the breakdown's category and unit labels render in German
