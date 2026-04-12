## ADDED Requirements

### Requirement: Zod schemas as source of truth
The `@trails-cool/api` package SHALL define all API request and response shapes as Zod schemas, with TypeScript types inferred via `z.infer<>`.

#### Scenario: Server validates request body
- **WHEN** the Journal server receives a request body for a known endpoint
- **THEN** it validates the body using the corresponding Zod schema from `@trails-cool/api` and returns a structured 400 error on failure

#### Scenario: Client validates response
- **WHEN** the mobile client receives a response from a Journal instance (especially self-hosted on an older version)
- **THEN** it can optionally validate the response against the Zod schema to detect incompatibilities

### Requirement: API version constant
The package SHALL export an `API_VERSION` semver constant as the single source of truth for the current API version.

#### Scenario: Version bump in one place
- **WHEN** the API version needs to be bumped (new endpoint, new field, breaking change)
- **THEN** the version is changed in `@trails-cool/api` and both the Journal server and mobile client see it at compile time

### Requirement: Endpoint path constants
The package SHALL export typed constants for all API endpoint paths.

#### Scenario: Endpoint paths used by server and client
- **WHEN** the server registers a route or the client constructs a URL
- **THEN** both import the path from `@trails-cool/api` (e.g., `ENDPOINTS.routes.list` resolves to `"/api/v1/routes"`)

### Requirement: Request and response schemas
The package SHALL define Zod schemas for all API endpoints.

#### Scenario: Routes schemas
- **WHEN** a route-related endpoint is called
- **THEN** schemas exist for `RouteListResponse`, `RouteDetailResponse`, `CreateRouteRequest`, `UpdateRouteRequest`

#### Scenario: Activities schemas
- **WHEN** an activity-related endpoint is called
- **THEN** schemas exist for `ActivityListResponse`, `ActivityDetailResponse`, `CreateActivityRequest`

#### Scenario: Auth schemas
- **WHEN** an auth-related endpoint is called
- **THEN** schemas exist for `TokenExchangeRequest`, `TokenResponse`, `DiscoveryResponse`

#### Scenario: Upload schemas
- **WHEN** an upload-related endpoint is called
- **THEN** schemas exist for `PresignedUploadRequest`, `PresignedUploadResponse`

### Requirement: Error response schema
The package SHALL define a standard error response schema used by all endpoints.

#### Scenario: Error shape
- **WHEN** any API endpoint returns an error
- **THEN** the response matches the `ApiErrorResponse` schema: `{ error: string, code: string, fields?: Array<{ field: string, message: string }> }`
