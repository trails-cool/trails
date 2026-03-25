## MODIFIED Requirements

### Requirement: Sentry error tracking
The system SHALL enrich Sentry events with user and session context, use route-aware tracing, and prevent source maps from being served to clients.

#### Scenario: Journal error includes user context
- **WHEN** an authenticated Journal user triggers an error
- **THEN** the Sentry event SHALL include the user's ID and username

#### Scenario: Journal error without user context
- **WHEN** an unauthenticated visitor triggers an error
- **THEN** the Sentry event SHALL have no user context (Sentry.setUser(null))

#### Scenario: Planner error includes session ID
- **WHEN** an error occurs during a Planner session
- **THEN** the Sentry event SHALL include a `session_id` tag with the active session ID

#### Scenario: Route-level performance traces
- **WHEN** a user navigates between routes in either app
- **THEN** Sentry SHALL create a transaction span named after the route pattern (e.g., `/routes/:id`)

#### Scenario: Source maps not served to clients
- **WHEN** a client requests a `.map` file from the production server
- **THEN** the server SHALL return 404 (source maps are uploaded to Sentry during build, not shipped in the bundle)
