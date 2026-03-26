## MODIFIED Requirements

### Requirement: Map polygon drawing
The Planner map SHALL support drawing and displaying no-go area polygons.

#### Scenario: Polygon tool
- **WHEN** a user activates the no-go area tool
- **THEN** they can draw a polygon by clicking points on the map

#### Scenario: Polygon display
- **WHEN** no-go areas exist in the session
- **THEN** they are rendered as semi-transparent red polygons on the map
