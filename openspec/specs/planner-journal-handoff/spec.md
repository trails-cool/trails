## ADDED Requirements

### Requirement: Open Planner from Journal
The Journal SHALL allow a route owner to open a route in the Planner for collaborative editing.

#### Scenario: Start editing session
- **WHEN** a route owner clicks "Edit in Planner" on a route detail page
- **THEN** the Journal generates a scoped JWT token and redirects to `planner.trails.cool/new?callback=<url>&token=<jwt>` with the route's current GPX

### Requirement: Save from Planner to Journal
The Planner SHALL save route edits back to the Journal via the callback URL provided at session creation.

#### Scenario: Save route back
- **WHEN** a user clicks "Save" in the Planner and a callback URL exists
- **THEN** the Planner POSTs the current GPX and metadata to the callback URL with the JWT token

#### Scenario: Journal receives save callback
- **WHEN** the Journal receives a POST to the callback endpoint with a valid JWT
- **THEN** the Journal creates a new route version with the GPX and credits the contributor

### Requirement: Scoped JWT token
The Journal SHALL generate scoped JWT tokens for Planner callbacks containing the instance URL, route ID, permissions, and expiry.

#### Scenario: Valid token accepted
- **WHEN** the Planner sends a save request with a valid, non-expired JWT
- **THEN** the Journal accepts the request and saves the route

#### Scenario: Expired token rejected
- **WHEN** the Planner sends a save request with an expired JWT
- **THEN** the Journal returns a 401 error

#### Scenario: Invalid token rejected
- **WHEN** the Planner sends a save request with a tampered JWT
- **THEN** the Journal returns a 401 error

### Requirement: Return to Journal after save
After saving, the Planner SHALL provide a link back to the route in the Journal.

#### Scenario: Return link displayed
- **WHEN** a save to the Journal succeeds
- **THEN** the Planner displays a success message with a link to the route in the Journal
