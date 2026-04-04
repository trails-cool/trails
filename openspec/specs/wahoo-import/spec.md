## ADDED Requirements

### Requirement: Provider-agnostic sync framework
The system SHALL provide a common interface for external activity sync providers.

#### Scenario: Add new provider
- **WHEN** a developer wants to add a new sync provider (e.g., Garmin)
- **THEN** they implement the `SyncProvider` interface in a single file
- **AND** register it in the provider registry
- **AND** all OAuth, webhook, import, and settings UI works automatically

### Requirement: Connect Wahoo account
Users SHALL be able to connect their Wahoo account via OAuth2.

#### Scenario: Connect Wahoo
- **WHEN** a user clicks "Connect Wahoo" in journal settings
- **THEN** they are redirected to Wahoo's OAuth authorization page with scopes `workouts_read`, `user_read`, `offline_data`
- **AND** after granting permission, redirected back to the journal
- **AND** access and refresh tokens are stored in `sync_connections`

#### Scenario: Disconnect Wahoo
- **WHEN** a user clicks "Disconnect" next to their Wahoo connection
- **THEN** the stored tokens are deleted from `sync_connections`

#### Scenario: Token refresh
- **WHEN** a Wahoo API call fails with an expired token
- **THEN** the refresh token is used to obtain a new access token automatically

### Requirement: Webhook-based automatic sync
New Wahoo workouts SHALL be automatically imported when they complete.

#### Scenario: Webhook receives new workout
- **WHEN** Wahoo sends a `workout_summary` webhook to `/api/sync/webhook/wahoo`
- **THEN** the system identifies the user via `provider_user_id`
- **AND** downloads the FIT file from Wahoo's CDN
- **AND** converts it to GPX
- **AND** creates a journal activity with the GPX, stats, and PostGIS geometry
- **AND** records the import in `sync_imports` to prevent duplicates

#### Scenario: Duplicate webhook
- **WHEN** a webhook arrives for a workout already imported
- **THEN** the import is skipped silently (idempotent)

#### Scenario: Unknown user webhook
- **WHEN** a webhook arrives with a `provider_user_id` not matching any connection
- **THEN** the request is ignored with a 200 response (don't reveal user existence)

### Requirement: Manual import
Users SHALL be able to browse and selectively import older Wahoo workouts.

#### Scenario: View workout list
- **WHEN** a user visits the Wahoo import page
- **THEN** their Wahoo workouts are listed with date, type, duration, and distance
- **AND** already-imported workouts are marked

#### Scenario: Import workout
- **WHEN** a user clicks "Import" on a Wahoo workout
- **THEN** the FIT file is downloaded, converted to GPX, and a new activity is created

### Requirement: FIT to GPX conversion
The system SHALL convert Wahoo's FIT binary files to GPX format.

#### Scenario: Convert FIT with GPS data
- **WHEN** a FIT file contains GPS track records
- **THEN** track points with lat, lon, elevation, and timestamp are extracted
- **AND** a valid GPX string is produced using `generateGpx`

#### Scenario: FIT without GPS data
- **WHEN** a FIT file has no GPS records (e.g., indoor trainer workout)
- **THEN** the activity is created without GPX or geometry (stats only)
