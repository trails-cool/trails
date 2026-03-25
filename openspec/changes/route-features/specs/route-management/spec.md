## MODIFIED Requirements

### Requirement: Route metadata
Routes SHALL track visibility, contributors, and support forking.

#### Scenario: Visibility on route creation
- **WHEN** a user creates a route
- **THEN** the route defaults to "private" visibility

#### Scenario: Contributor recorded on version
- **WHEN** a Planner session saves a new route version via callback
- **THEN** the version records the contributor who made the edit
