## ADDED Requirements

### Requirement: Connect Garmin account
Users SHALL be able to connect their Garmin account via OAuth2 with PKCE. The provider SHALL be registered through the connected-services manifest/registry seams; the settings page, OAuth routes, and webhook routing SHALL require no framework changes.

#### Scenario: Connect Garmin
- **WHEN** a user clicks "Connect Garmin" on `/settings/connections`
- **THEN** they are redirected to Garmin's OAuth authorization page with a PKCE code challenge
- **AND** after granting permission they are redirected back to the journal
- **AND** access and refresh tokens are stored in `connected_services` with `provider = 'garmin'`, `credential_kind = 'oauth'`
- **AND** the Garmin user id is stored as `provider_user_id` for webhook resolution

#### Scenario: Disconnect Garmin
- **WHEN** a user clicks "Disconnect" next to their Garmin connection
- **THEN** the stored credentials are removed and previously imported activities are unaffected

#### Scenario: Token refresh
- **WHEN** a Garmin API call is attempted with an expired access token
- **THEN** the OAuth `CredentialAdapter` refreshes it via `ConnectedServiceManager.withFreshCredentials`
- **AND** a permanently failed refresh (revoked refresh token) flips the connection to `needs_relink`

#### Scenario: Provider hidden without credentials
- **WHEN** the instance has no `GARMIN_CLIENT_ID` configured
- **THEN** the Garmin row on `/settings/connections` is absent or disabled (self-hosted instances without a Garmin program key see no broken flows)

### Requirement: Push-notification activity import
New Garmin activities SHALL be imported automatically via Garmin's notification pipeline. The webhook endpoint SHALL accept both ping notifications (payload fetched from the notification's callback URL) and push notifications (payload inline), normalize them into a single internal shape, and process imports asynchronously via a background job so the webhook itself responds quickly.

#### Scenario: New activity notification imports the activity
- **WHEN** Garmin POSTs an activity notification to `/api/sync/webhook/garmin`
- **THEN** the endpoint responds 200 promptly and enqueues an import job
- **AND** the job resolves the user via `provider_user_id`, downloads the FIT file, converts it via the shared FIT→GPX module, and creates a journal activity with GPX, stats, and PostGIS geometry
- **AND** the import is recorded in `sync_imports` to prevent duplicates

#### Scenario: Duplicate notification
- **WHEN** a notification arrives for an activity already recorded in `sync_imports`
- **THEN** the import is skipped silently (idempotent)

#### Scenario: Unknown user notification
- **WHEN** a notification arrives whose Garmin user id matches no active connection
- **THEN** the request is acknowledged with 200 and no data is processed (do not reveal user existence)

#### Scenario: Callback URL host validation
- **WHEN** a ping notification carries a callback URL whose host is not on the Garmin API host allowlist
- **THEN** the notification is dropped and logged; the URL is never fetched (SSRF guard)

#### Scenario: Activity without FIT data
- **WHEN** a notification describes an activity with no fetchable FIT file but includes summary stats
- **THEN** the activity is created without GPX or geometry (stats only), mirroring the established FIT-less behavior

#### Scenario: Unknown notification type
- **WHEN** Garmin delivers a notification type the handler does not recognize
- **THEN** it is logged and acknowledged with 200, never an error status

### Requirement: Historical import via backfill
Users SHALL be able to import their Garmin history by requesting backfill for a date range. Because Garmin exposes no activity-list endpoint, the import page SHALL present a date-range request flow with asynchronous progress, not a per-activity pick list. Range requests SHALL be chunked to Garmin's per-request window, and overlapping or repeated requests SHALL be safe (deduplicated via `sync_imports`).

#### Scenario: Request a backfill
- **WHEN** a connected user submits a date range on the Garmin import page
- **THEN** the system issues Garmin backfill requests covering the range in API-sized chunks
- **AND** the page records the requested range and shows it as in progress

#### Scenario: Backfilled activities arrive
- **WHEN** Garmin asynchronously delivers historical activities through the notification pipeline
- **THEN** each is imported by the same job path as live notifications
- **AND** the import page reflects the growing count of imported activities for the requested range

#### Scenario: Overlapping backfill request
- **WHEN** a user requests a range overlapping previously imported activities
- **THEN** already-imported activities are skipped via `sync_imports` and no duplicates are created

### Requirement: Deregistration handling
The system SHALL act on Garmin deregistration notifications. When a user revokes access on Garmin's side, the connection row SHALL be set to `status = 'revoked'`, all Garmin API calls for that user SHALL cease, and the user SHALL see the standard re-connect prompt. Imported activities SHALL be retained (they are the user's journal data; deletion remains the user's existing per-activity and account deletion paths).

#### Scenario: User revokes from Garmin's side
- **WHEN** a deregistration notification for a connected user arrives at the Garmin webhook
- **THEN** the `connected_services` row is set to `revoked`
- **AND** subsequent scheduled or user-triggered Garmin calls for that user short-circuit
- **AND** `/settings/connections` shows Garmin as requiring reconnection

### Requirement: Import provenance
Activities imported from Garmin SHALL show their origin, consistent with other providers.

#### Scenario: View imported activity
- **WHEN** a user views an activity imported from Garmin
- **THEN** an "Imported from garmin" badge is displayed on the detail page

#### Scenario: Delete and reimport
- **WHEN** a user deletes a Garmin-imported activity
- **THEN** the corresponding `sync_imports` record is deleted, so a future overlapping backfill can re-import it
