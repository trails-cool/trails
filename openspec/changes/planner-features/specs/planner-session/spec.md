## MODIFIED Requirements

### Requirement: Planner session data model
The Yjs document SHALL include noGoAreas and notes fields alongside waypoints and routeData.

#### Scenario: Session with all fields
- **WHEN** a Planner session is active
- **THEN** the Yjs doc contains: waypoints (Y.Array), routeData (Y.Map), noGoAreas (Y.Array), notes (Y.Text)
