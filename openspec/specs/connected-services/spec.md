# connected-services Specification

## Purpose
Third-party service connections (Wahoo today; future Strava, Garmin, etc.) that the user opts into from the Journal's settings page. Covers OAuth-based connect / disconnect flows and the storage layout for tokens. Token refresh behavior, webhook ingestion, and the per-service import rules live with each service's own change (e.g. `wahoo-import`).

## Requirements

### Requirement: Connections settings page at `/settings/connections`
The Journal SHALL expose a Connected services page at `/settings/connections` (one of the four sub-pages of `/settings`). The page SHALL list each external integration the Journal supports, each row showing the connection state (Connect / Disconnect) and the link to start the OAuth flow when not connected.

#### Scenario: Wahoo connection status renders both states
- **WHEN** a user loads `/settings/connections`
- **THEN** the page lists Wahoo as connected or disconnected
- **AND** connected state shows a "Disconnect" button that POSTs to `/api/sync/disconnect/<provider>`
- **AND** disconnected state shows a "Connect Wahoo" button that begins the OAuth handshake

### Requirement: OAuth token storage in `sync_connections`
External-service OAuth tokens SHALL be stored in the `journal.sync_connections` table keyed by `(user_id, provider)`. Each row SHALL persist `access_token`, `refresh_token`, `expires_at`, and the provider-side user id (`provider_user_id`). Disconnecting SHALL delete the row, severing the user's link to the external service without affecting any imported activities.

#### Scenario: Wahoo connect persists tokens
- **WHEN** a user completes the Wahoo OAuth flow
- **THEN** a `sync_connections` row is upserted with `provider = 'wahoo'`, the access/refresh tokens, the provider user id, and `expires_at`

#### Scenario: Disconnect removes the row but keeps imports
- **WHEN** a user clicks "Disconnect" on a Wahoo connection
- **THEN** the matching `sync_connections` row is deleted; previously imported activities are not deleted (they remain owned by the user, just no longer auto-syncing)

#### Scenario: Each user has at most one row per provider
- **WHEN** a user reconnects an already-connected provider
- **THEN** the existing `sync_connections` row is updated in place with the fresh tokens; no duplicate row is created
