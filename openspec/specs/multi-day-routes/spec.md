## ADDED Requirements

### Requirement: Overnight waypoint markers
Any waypoint SHALL be toggleable as an overnight stop, creating day boundaries in the route.

#### Scenario: Toggle overnight
- **WHEN** a user toggles the overnight flag on a waypoint
- **THEN** the waypoint's `overnight: true` flag is set in the Yjs document
- **AND** the route is visually divided into days at that point

#### Scenario: Implicit day boundaries
- **WHEN** overnight stops are set
- **THEN** the first waypoint is the implicit start of Day 1 and the last waypoint is the implicit end of the final day

### Requirement: Per-day statistics
The Planner SHALL compute and display distance, ascent, and estimated duration for each day.

#### Scenario: Day stats computed
- **WHEN** a route has overnight waypoints
- **THEN** per-day distance, total ascent, and estimated duration are derived from segment boundaries and coordinates

### Requirement: Day-aware sidebar
The sidebar SHALL group waypoints by day with collapsible sections and per-day stats.

#### Scenario: Day breakdown
- **WHEN** a route has multiple days
- **THEN** waypoints are grouped under "Day 1", "Day 2", etc. with collapsible sections
- **AND** each section header shows day distance and ascent

### Requirement: Elevation chart day dividers
The elevation chart SHALL show day boundaries as dashed vertical lines.

#### Scenario: Day dividers on chart
- **WHEN** a route has multiple days
- **THEN** dashed vertical lines with "Day N" labels appear at each overnight waypoint position

### Requirement: Map day labels
The map SHALL display day summary labels at day boundary waypoints.

#### Scenario: Day labels on map
- **WHEN** a route has multiple days
- **THEN** white pill markers at day boundaries show "Day N . X km"

### Requirement: Multi-day GPX export
Day structure SHALL be preserved in GPX exports via waypoint type elements.

#### Scenario: Export multi-day route
- **WHEN** a user exports a plan with overnight waypoints
- **THEN** overnight waypoints include a `<type>overnight</type>` element in the GPX
- **AND** reimporting the GPX restores the day structure
