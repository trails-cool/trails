## ADDED Requirements

### Requirement: Journal authentication client
The system SHALL provide an API client that handles OAuth2 PKCE authentication with a Journal instance.

#### Scenario: Login flow
- **WHEN** the user enters their Journal instance URL and taps "Sign in"
- **THEN** the app opens the Journal's `/oauth/authorize` endpoint in an in-app browser, receives the auth code on redirect, and exchanges it for access + refresh tokens

#### Scenario: Token storage
- **WHEN** tokens are received from the Journal
- **THEN** the access token and refresh token are stored in Expo SecureStore

#### Scenario: Token refresh
- **WHEN** an API request fails with a 401
- **THEN** the client automatically uses the refresh token to obtain a new access token and retries the request

### Requirement: Routes API client
The system SHALL provide methods for listing, fetching, creating, and updating routes on the Journal.

#### Scenario: List user routes
- **WHEN** the Routes tab is opened
- **THEN** the client fetches the user's routes from `GET /api/routes` and returns them as typed Route objects

#### Scenario: Fetch route detail
- **WHEN** a route is selected
- **THEN** the client fetches the route with GPX data from `GET /api/routes/:id` including waypoints and geometry

#### Scenario: Save route
- **WHEN** the user saves an edited route
- **THEN** the client sends the updated GPX to `PUT /api/routes/:id` and returns the new version

### Requirement: Activities API client
The system SHALL provide methods for listing, fetching, and creating activities on the Journal.

#### Scenario: List user activities
- **WHEN** the Activities tab is opened
- **THEN** the client fetches the user's activities from `GET /api/activities`

#### Scenario: Create activity
- **WHEN** a recording is saved
- **THEN** the client sends the activity data (GPX, distance, duration, routeId) to `POST /api/activities`

### Requirement: Network error handling
The system SHALL handle network failures gracefully across all API calls.

#### Scenario: Request timeout or network error
- **WHEN** an API request fails due to network issues
- **THEN** the client returns a typed error and the UI shows an appropriate message with a retry option
