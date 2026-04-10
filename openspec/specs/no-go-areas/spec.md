## Purpose

Polygon-based route avoidance areas drawn on the map, synced via Yjs, sent to BRouter as constraints, and persisted in GPX extensions.

## Requirements

### Requirement: Draw no-go areas
Users SHALL be able to draw polygons on the map that BRouter avoids when computing routes.

#### Scenario: Draw polygon
- **WHEN** a user activates the no-go area tool and draws a polygon on the map
- **THEN** the polygon is added to the Yjs doc and visible to all participants

#### Scenario: Route avoids no-go area
- **WHEN** a route is computed and a no-go area intersects the direct path
- **THEN** BRouter request includes the polygon vertices via the `polygons` parameter
- **AND** BRouter routes around the no-go area

#### Scenario: Delete no-go area
- **WHEN** a user right-clicks a no-go area polygon
- **THEN** it is removed from the Yjs doc and the route is recomputed

### Requirement: Persist no-go areas in GPX
No-go areas SHALL be preserved when saving to the journal or exporting a plan.

#### Scenario: Save to Journal
- **WHEN** a user saves a route to the journal from the planner
- **THEN** the GPX includes no-go area polygons in `<extensions>` using the `trails:planning` namespace
- **AND** editing the route in the planner restores the no-go areas

#### Scenario: Export Plan
- **WHEN** a user exports a plan (via "Export Plan" dropdown option)
- **THEN** the GPX includes waypoints, track, and no-go areas in `<extensions>`
- **AND** reimporting the plan into the planner restores all planning data

#### Scenario: Export Route
- **WHEN** a user exports a route (default export or "Export Route" dropdown option)
- **THEN** the GPX includes only the computed track (no waypoints, no extensions)
- **AND** the file is compatible with any GPX-consuming application

### Requirement: GPX extensions format
No-go areas SHALL be stored in GPX using the `trails:planning` custom XML namespace with point-based polygon representation.

#### Scenario: Valid no-go area in GPX
- **WHEN** a GPX file contains a `<trails:nogo>` element with 3+ `<trails:point>` child elements
- **THEN** the parser creates a no-go area polygon from the point coordinates

#### Scenario: Namespace-agnostic parsing
- **WHEN** a GPX file contains non-namespaced `<nogo>` elements instead of `<trails:nogo>`
- **THEN** the parser accepts them identically

#### Scenario: Invalid no-go area rejected
- **WHEN** a GPX file contains a no-go area with fewer than 3 points
- **THEN** the parser rejects it
