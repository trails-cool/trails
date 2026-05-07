## MODIFIED Requirements

### Requirement: Provider-agnostic sync framework
The system SHALL provide capability-shaped seams for external activity sync providers. Each provider declares a manifest at `providers/<name>/manifest.ts` listing its `credential_kind` (`oauth | web-login | device`) and the capability adapters it implements (`Importer`, `RoutePusher`, `WebhookReceiver`). There SHALL NOT be a unified `SyncProvider` interface containing every capability with optional methods.

#### Scenario: Add new provider
- **WHEN** a developer wants to add a new sync provider (e.g., Garmin)
- **THEN** they create `providers/garmin/` containing a `manifest.ts` declaring `credential_kind` and the implemented capabilities
- **AND** they implement only the capability interfaces that apply (e.g. `Importer` for an import-only provider)
- **AND** they register the manifest in `providers/registry.ts`
- **AND** OAuth flows, webhook routing, and settings UI work without further changes

### Requirement: Connect Wahoo account
Users SHALL be able to connect their Wahoo account via OAuth2.

#### Scenario: Connect Wahoo
- **WHEN** a user clicks "Connect Wahoo" in journal settings
- **THEN** they are redirected to Wahoo's OAuth authorization page with scopes `workouts_read`, `user_read`, `offline_data`, `routes_write`
- **AND** after granting permission, redirected back to the journal
- **AND** access and refresh tokens are stored in `connected_services` (in the `credentials` JSONB blob, with `credential_kind = 'oauth'`)
- **AND** the granted scopes are recorded in `connected_services.granted_scopes` so feature gates can detect missing scopes without round-tripping to Wahoo

#### Scenario: Disconnect Wahoo
- **WHEN** a user clicks "Disconnect" next to their Wahoo connection
- **THEN** the stored credentials are deleted from `connected_services`

#### Scenario: Token refresh
- **WHEN** a Wahoo API call fails with an expired token
- **THEN** the OAuth `CredentialAdapter` is invoked via `ConnectedServiceManager.withFreshCredentials` to obtain a new access token automatically
- **AND** the new tokens are written back to the `credentials` JSONB blob

#### Scenario: Existing connection without routes_write
- **WHEN** a user connected before the `routes_write` scope was added attempts an action that requires it (such as pushing a route)
- **THEN** the system detects the missing scope from `connected_services.granted_scopes` and routes the user through OAuth re-authorization to grant the new scope
- **AND** the existing tokens remain valid until re-auth completes; ongoing read flows (workout import, webhook ingestion) continue to work

### Requirement: Webhook-based automatic sync
New Wahoo workouts SHALL be automatically imported when they complete.

#### Scenario: Webhook receives new workout
- **WHEN** Wahoo sends a `workout_summary` webhook to `/api/sync/webhook/wahoo`
- **THEN** the system identifies the user via `provider_user_id`
- **AND** downloads the FIT file from Wahoo's CDN (without auth headers, as CDN URLs are pre-signed)
- **AND** converts it to GPX
- **AND** creates a journal activity with the GPX, stats, and PostGIS geometry
- **AND** records the import in `sync_imports` to prevent duplicates

#### Scenario: Webhook for workout without file
- **WHEN** a webhook arrives for a workout with no FIT file URL
- **THEN** the activity is created without GPX or geometry

#### Scenario: Duplicate webhook
- **WHEN** a webhook arrives for a workout already imported
- **THEN** the import is skipped silently (idempotent)

#### Scenario: Unknown user webhook
- **WHEN** a webhook arrives with a `provider_user_id` not matching any connection
- **THEN** the request is ignored with a 200 response (don't reveal user existence)
