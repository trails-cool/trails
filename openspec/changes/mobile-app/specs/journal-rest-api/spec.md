## ADDED Requirements

### Requirement: REST API namespace
The Journal SHALL expose a versioned REST API under `/api/v1/` for external clients.

#### Scenario: API base path
- **WHEN** a client sends a request to `/api/v1/*`
- **THEN** the Journal processes it as an API request with JSON responses and bearer token auth

#### Scenario: Non-API routes unaffected
- **WHEN** a browser accesses the Journal's existing web routes
- **THEN** they continue to work via React Router loaders/actions with cookie sessions

### Requirement: Instance discovery
The Journal SHALL expose a discovery endpoint for clients to identify the instance.

#### Scenario: Discovery endpoint
- **WHEN** a client fetches `GET /.well-known/trails-cool`
- **THEN** the response includes `apiVersion` (semver), instance name, and API base URL

#### Scenario: API version compatibility
- **WHEN** the client's minimum required API version exceeds the server's `apiVersion`
- **THEN** the client blocks with an upgrade prompt (offline data still accessible)

### Requirement: Shared API contract package
The API contract SHALL be defined in `@trails-cool/api` using Zod schemas, shared between server and clients.

#### Scenario: Type-safe requests
- **WHEN** the Journal server receives a request body
- **THEN** it validates the body using the Zod schema from `@trails-cool/api`

#### Scenario: Version in one place
- **WHEN** the API version needs to be bumped
- **THEN** it is changed in `@trails-cool/api` — both server and clients see it at compile time

### Requirement: Authentication
The API SHALL use OAuth2 bearer tokens for authentication.

#### Scenario: Authenticated request
- **WHEN** a client sends a request with `Authorization: Bearer <token>`
- **THEN** the server validates the token and processes the request as the authenticated user

#### Scenario: Unauthenticated request
- **WHEN** a client sends a request without a valid bearer token to a protected endpoint
- **THEN** the server responds with 401 Unauthorized

#### Scenario: Token refresh
- **WHEN** an access token expires
- **THEN** the client exchanges its refresh token at `POST /api/v1/auth/token` for a new access token

### Requirement: Routes endpoints
The API SHALL provide CRUD endpoints for routes.

#### Scenario: List routes
- **WHEN** `GET /api/v1/routes?cursor=<cursor>`
- **THEN** returns paginated route list with id, name, distance, elevationGain, thumbnail geojson, updatedAt, and `nextCursor`

#### Scenario: Get route detail
- **WHEN** `GET /api/v1/routes/:id`
- **THEN** returns full route with metadata, GPX, waypoints, dayBreaks, day stats, geojson, and version history

#### Scenario: Update route
- **WHEN** `PUT /api/v1/routes/:id` with GPX body
- **THEN** creates a new version, updates stats and dayBreaks, returns updated route

#### Scenario: Create route
- **WHEN** `POST /api/v1/routes` with name and optional GPX
- **THEN** creates a new route, returns the route with id

#### Scenario: Delete route
- **WHEN** `DELETE /api/v1/routes/:id`
- **THEN** deletes the route and all versions, returns 204

### Requirement: Activities endpoints
The API SHALL provide CRUD endpoints for activities.

#### Scenario: List activities
- **WHEN** `GET /api/v1/activities?cursor=<cursor>`
- **THEN** returns paginated activity list with id, name, routeId, distance, duration, startedAt, and `nextCursor`

#### Scenario: Get activity detail
- **WHEN** `GET /api/v1/activities/:id`
- **THEN** returns full activity with stats, GPX, linked route info, geojson

#### Scenario: Create activity
- **WHEN** `POST /api/v1/activities` with name, GPX, optional routeId
- **THEN** creates activity, computes stats from GPX, returns activity with id

#### Scenario: Delete activity
- **WHEN** `DELETE /api/v1/activities/:id`
- **THEN** deletes the activity, returns 204

### Requirement: Route computation proxy
The API SHALL proxy BRouter route computation requests.

#### Scenario: Compute route
- **WHEN** `POST /api/v1/routes/compute` with waypoints array and profile
- **THEN** the Journal forwards to its BRouter instance and returns the enriched route (geojson, coordinates, segmentBoundaries, surfaces, highways, etc.)

### Requirement: Cursor-based pagination
All list endpoints SHALL use cursor-based pagination.

#### Scenario: First page
- **WHEN** a list endpoint is called without a cursor
- **THEN** returns the first page of results with `nextCursor` (null if no more results)

#### Scenario: Next page
- **WHEN** a list endpoint is called with `?cursor=<nextCursor>`
- **THEN** returns the next page of results

### Requirement: Error responses
The API SHALL return structured error responses.

#### Scenario: Validation error
- **WHEN** a request body fails Zod validation
- **THEN** returns 400 with `{ error: "Validation failed", code: "VALIDATION_ERROR", fields: [...] }`

#### Scenario: Not found
- **WHEN** a resource doesn't exist
- **THEN** returns 404 with `{ error: "Not found", code: "NOT_FOUND" }`

#### Scenario: Server error
- **WHEN** an unexpected error occurs
- **THEN** returns 500 with `{ error: "Internal server error", code: "INTERNAL_ERROR" }` (no stack traces)
