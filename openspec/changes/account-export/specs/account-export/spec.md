## ADDED Requirements

### Requirement: Full-account export archive
The Journal SHALL let a user export all data they own as a single ZIP archive: every route (current GPX plus version-history GPX files), every activity (GPX when present), activity media, and JSON manifests for profile, route/activity metadata, follows, notification history, and connected-service names. The archive SHALL carry a `manifest.json` with a format version. OAuth tokens, credentials, sessions, and other users' content SHALL NOT be included.

#### Scenario: Archive contains originals in open formats
- **WHEN** a user with routes and activities requests an export
- **THEN** the archive contains one GPX file per route and per activity with GPX, and JSON manifests keyed by the same ids

#### Scenario: Secrets never exported
- **WHEN** a user with a connected Wahoo account exports
- **THEN** the archive lists the connection's provider and date only, with no tokens or credentials

### Requirement: Asynchronous generation with bounded memory
Export generation SHALL run as a background job that streams data in batches (memory use independent of account size), notify the user when the archive is ready, and allow only one active export job per user.

#### Scenario: Export of a large account completes
- **WHEN** a user with thousands of activities requests an export
- **THEN** the job completes without exhausting memory and a "export ready" notification links to the download

#### Scenario: Duplicate request returns the running job
- **WHEN** a user requests an export while one is already generating
- **THEN** no second job starts and the settings page shows the in-progress state

### Requirement: Owner-only, expiring download
The export artifact SHALL be downloadable only by the authenticated owner through an app route, and SHALL expire (deleted from storage) after 7 days.

#### Scenario: Another user cannot download
- **WHEN** a different authenticated user requests the export download URL
- **THEN** the request is rejected

#### Scenario: Expired artifact is gone
- **WHEN** 7 days pass after generation
- **THEN** the artifact is removed from storage and the settings page offers a fresh export

### Requirement: Documented archive format
The archive layout and manifest schema SHALL be documented in the repository (`docs/export-format.md`) and versioned via `manifest.formatVersion`, so a future import capability can consume archives across versions.

#### Scenario: Format documented
- **WHEN** the export capability ships
- **THEN** `docs/export-format.md` describes every file and manifest field for format version 1
