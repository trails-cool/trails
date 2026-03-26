## MODIFIED Requirements

### Requirement: BRouter routing with constraints
Route computation SHALL include no-go area polygons as avoidance constraints.

#### Scenario: Route with no-go areas
- **WHEN** the routing host computes a route and no-go areas exist
- **THEN** the BRouter request includes nogo parameters for each polygon
