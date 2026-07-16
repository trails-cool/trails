## Purpose

Provider-agnostic activity sync framework with Wahoo as the first provider, supporting OAuth connection, webhook-based automatic sync, manual import, and FIT-to-GPX conversion.
## Requirements
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

### Requirement: Manual import
Users SHALL be able to browse and selectively import older Wahoo workouts.

#### Scenario: View workout list
- **WHEN** a user visits the Wahoo import page
- **THEN** their Wahoo workouts are listed with date, type, duration, and distance
- **AND** already-imported workouts are marked as "Imported"
- **AND** third-party workouts (fitness_app_id >= 1000) are filtered out, as Wahoo does not share their data via the API
- **AND** workouts without a FIT file show a "No GPS" badge with a tooltip explaining the provider has no route data

#### Scenario: Import single workout
- **WHEN** a user clicks "Import" on a Wahoo workout
- **THEN** the import runs in the background using a fetcher (no page refresh)
- **AND** the button shows "Importing..." during the import
- **AND** changes to "Imported" when complete

#### Scenario: Import all workouts
- **WHEN** a user clicks "Import all"
- **THEN** all unimported workouts on the current page are imported sequentially
- **AND** a progress indicator shows "Importing X of Y..."

### Requirement: Activity import metadata
Imported activities SHALL show their origin in the UI.

#### Scenario: View imported activity
- **WHEN** a user views an activity that was imported from Wahoo
- **THEN** an "Imported from wahoo" badge is displayed on the detail page

#### Scenario: Delete and reimport
- **WHEN** a user deletes an imported activity
- **THEN** the sync_imports record is also deleted
- **AND** the workout appears as importable again on the import page

### Requirement: FIT to GPX conversion
The system SHALL convert FIT binary files to GPX format. The conversion logic lives at `apps/journal/app/lib/connected-services/fit.ts` — a provider-agnostic location shared across any future provider that produces FIT files (Garmin, Coros, etc.). Wahoo's importer and webhook both import from this shared module; they do not contain their own copy. The conversion SHALL be pause- and session-aware: timer stop/start events (or record gaps over 5 minutes in files without events) and session boundaries each start a new track segment. The converter SHALL prefer enhanced (corrected) altitude and speed fields, drop records with missing timestamps or non-finite/out-of-range coordinates, treat non-finite altitude as absent, and expose the file's session sport mapped to the Journal's sport types alongside the GPX.

#### Scenario: Convert FIT with GPS data
- **WHEN** a FIT file contains GPS track records
- **THEN** track points with lat, lon, elevation, and ISO 8601 timestamps are extracted
- **AND** coordinates are used as-is from the FIT parser (which already converts semicircles to degrees)
- **AND** a valid GPX string is produced using `generateGpx`

#### Scenario: FIT without GPS data
- **WHEN** a FIT file has no GPS records (e.g., indoor trainer workout)
- **THEN** the activity is created without GPX or geometry (stats only)

#### Scenario: Workout without FIT file
- **WHEN** a workout has no file URL (e.g., aborted recording, third-party app data)
- **THEN** the activity is created without GPX or geometry

#### Scenario: Pause becomes a segment boundary
- **WHEN** a FIT file contains a timer stop event followed by a start event 20 minutes later
- **THEN** the GPX contains two track segments split at the pause
- **AND** moving time computed downstream does not include the paused span

#### Scenario: Multisport file keeps one activity with per-session segments
- **WHEN** a FIT file contains multiple sessions
- **THEN** one GPX is produced with one or more track segments per session, records sliced to each session's time window

#### Scenario: Corrupt records dropped
- **WHEN** a FIT file contains records with out-of-range coordinates or missing timestamps
- **THEN** those records are excluded and the remaining track converts normally

#### Scenario: Sport surfaced from the file
- **WHEN** a FIT file's session declares sport "cycling" with sub-sport "gravel_cycling"
- **THEN** the converter reports sport `gravel` for the importer to use when the provider sends no explicit type

