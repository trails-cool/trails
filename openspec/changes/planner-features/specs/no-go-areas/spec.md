## ADDED Requirements

### Requirement: Draw no-go areas
Users SHALL be able to draw polygons on the map that BRouter avoids when computing routes.

#### Scenario: Draw polygon
- **WHEN** a user activates the no-go area tool and draws a polygon on the map
- **THEN** the polygon is added to the Yjs doc and visible to all participants

#### Scenario: Route avoids no-go area
- **WHEN** a route is computed and a no-go area intersects the direct path
- **THEN** BRouter routes around the no-go area

#### Scenario: Delete no-go area
- **WHEN** a user deletes a no-go area polygon
- **THEN** it is removed from the Yjs doc and the route is recomputed
