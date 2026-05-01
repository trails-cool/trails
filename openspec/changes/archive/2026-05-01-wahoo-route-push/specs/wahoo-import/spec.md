## MODIFIED Requirements

### Requirement: Connect Wahoo account
Users SHALL be able to connect their Wahoo account via OAuth2.

#### Scenario: Connect Wahoo
- **WHEN** a user clicks "Connect Wahoo" in journal settings
- **THEN** they are redirected to Wahoo's OAuth authorization page with scopes `workouts_read`, `user_read`, `offline_data`, `routes_write`
- **AND** after granting permission, redirected back to the journal
- **AND** access and refresh tokens are stored in `sync_connections`
- **AND** the granted scopes are recorded in `sync_connections.granted_scopes` so feature gates can detect missing scopes without round-tripping to Wahoo

#### Scenario: Disconnect Wahoo
- **WHEN** a user clicks "Disconnect" next to their Wahoo connection
- **THEN** the stored tokens are deleted from `sync_connections`

#### Scenario: Token refresh
- **WHEN** a Wahoo API call fails with an expired token
- **THEN** the refresh token is used to obtain a new access token automatically

#### Scenario: Existing connection without routes_write
- **WHEN** a user connected before the `routes_write` scope was added attempts an action that requires it (such as pushing a route)
- **THEN** the system detects the missing scope from `sync_connections.granted_scopes` and routes the user through OAuth re-authorization to grant the new scope
- **AND** the existing tokens remain valid until re-auth completes; ongoing read flows (workout import, webhook ingestion) continue to work
