## Purpose

Komoot integration for the Journal app: connect a Komoot account (public bio-verification or authenticated with credentials) and import tours as Journal activities with linked routes.

## Requirements

### Requirement: Connect Komoot account — public mode
Users SHALL be able to connect their Komoot account without providing credentials
by verifying ownership via their Komoot bio field.

#### Scenario: Initiate public connection
- **WHEN** a user enters their Komoot profile URL on the integrations page
- **THEN** the system displays their trails.cool profile URL and instructs them to add it to their Komoot bio ("Über dich" field)

#### Scenario: Verify public ownership
- **WHEN** the user clicks Verify after updating their Komoot bio
- **THEN** the system fetches the public Komoot profile, checks that `content_text` contains the user's trails.cool profile URL, and on success marks the connection as active with mode "public"

#### Scenario: Bio not yet updated
- **WHEN** verification is attempted but the trails.cool URL is not found in the Komoot bio
- **THEN** the system shows an error explaining that changes may take a few minutes to propagate, with a retry button

#### Scenario: Disconnect public account
- **WHEN** a user disconnects their public Komoot integration
- **THEN** the stored Komoot username is removed and no further imports can occur

### Requirement: Connect Komoot account — authenticated mode
Users SHALL be able to connect their Komoot account by providing email and
password to access all tours including private ones.

#### Scenario: Successful authenticated connection
- **WHEN** a user enters valid Komoot email and password
- **THEN** the system validates credentials via the Komoot API, stores them encrypted, and shows the connection as active with mode "authenticated"

#### Scenario: Invalid credentials
- **WHEN** a user enters incorrect Komoot credentials
- **THEN** the system shows an error and does not store credentials

#### Scenario: Disconnect authenticated account
- **WHEN** a user disconnects their authenticated Komoot integration
- **THEN** stored credentials are deleted and no further imports can occur

### Requirement: Import Komoot tours
Users SHALL be able to import their Komoot tours as Journal activities with
linked routes. Public mode imports public tours only; authenticated mode imports
all tours.

#### Scenario: Import public tours
- **WHEN** a user with a public-mode connection triggers import
- **THEN** the system fetches all public tours from the Komoot API without credentials, creates an activity and route for each, and shows progress

#### Scenario: Import all tours (authenticated)
- **WHEN** a user with an authenticated-mode connection triggers import
- **THEN** the system fetches all tours (public and private, paginated) using stored credentials, creates an activity and route for each, and shows progress

#### Scenario: Tour with GPX geometry
- **WHEN** a Komoot tour is imported
- **THEN** the system fetches the tour's GPX and creates a route with the full track data

#### Scenario: Import progress
- **WHEN** an import is running
- **THEN** the UI shows: total tours found, imported so far, duplicates skipped, and current status

### Requirement: Deduplication
The system SHALL NOT create duplicate activities when re-importing tours that
were previously imported.

#### Scenario: Re-import skips existing tours
- **WHEN** a user runs import and a tour was already imported previously
- **THEN** the tour is skipped and counted as a duplicate in the import summary

### Requirement: Import batch tracking
Each import run SHALL be tracked as a batch with status and statistics.

#### Scenario: Batch lifecycle
- **WHEN** an import starts
- **THEN** a batch record is created with status "running", updated to "completed" or "failed" when done

#### Scenario: Batch statistics
- **WHEN** an import completes
- **THEN** the batch shows: totalFound, importedCount, duplicateCount, and duration

### Requirement: Credential storage
Both connection modes SHALL store credentials in `connected_services` with `credential_kind = 'web-login'`. Public mode stores only the verified Komoot username; authenticated mode stores an encrypted email + password in the `credentials` JSONB blob. The Komoot provider uses a noop `CredentialAdapter` — it does not go through `ConnectedServiceManager`'s `withFreshCredentials` lifecycle (no token refresh needed for web-login credentials). Credential decryption for API calls happens inside the Komoot importer directly.

The four Komoot-specific routes (`/api/sync/komoot/connect`, `/api/sync/komoot/verify`, `/api/sync/komoot/import`, `/api/sync/komoot/import-status`) intentionally bypass the generic `/api/sync/connect/:provider` / `/api/sync/callback/:provider` framework — Komoot's bio-verification flow is too different from OAuth to fit the generic shape.

#### Scenario: Credentials stored securely
- **WHEN** a user connects via authenticated mode
- **THEN** the password is encrypted with AES-256-GCM before storage and only decrypted when making API calls

### Requirement: Privacy disclosure
The Komoot integration SHALL be documented in the privacy manifest.

#### Scenario: Privacy manifest updated
- **WHEN** Komoot import is available
- **THEN** the /privacy page documents: that public mode stores only the Komoot username, that authenticated mode stores an encrypted password, and what tour data is imported
