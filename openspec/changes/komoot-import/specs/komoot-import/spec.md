## ADDED Requirements

### Requirement: Connect Komoot account
Users SHALL be able to connect their Komoot account by providing email and password. Credentials are validated against the Komoot API and stored encrypted.

#### Scenario: Successful connection
- **WHEN** user enters valid Komoot email and password on the integrations page
- **THEN** the system validates credentials via `api.komoot.de`, stores them encrypted, and shows the connection as active

#### Scenario: Invalid credentials
- **WHEN** user enters incorrect Komoot credentials
- **THEN** the system shows an error message and does not store credentials

#### Scenario: Disconnect account
- **WHEN** user disconnects their Komoot integration
- **THEN** stored credentials are deleted and no further imports can occur

### Requirement: Import Komoot tours
Users SHALL be able to import all their Komoot tours as Journal activities with linked routes.

#### Scenario: Import all tours
- **WHEN** user clicks "Import" on the integrations page
- **THEN** the system fetches all tours (paginated), creates an activity and route for each, and shows progress

#### Scenario: Tour with GPX geometry
- **WHEN** a Komoot tour is imported
- **THEN** the system fetches the tour's GPX/geometry and creates a route with the full track data

#### Scenario: Import progress
- **WHEN** an import is running
- **THEN** the UI shows: total tours found, imported so far, duplicates skipped, and current status

### Requirement: Deduplication
The system SHALL NOT create duplicate activities when re-importing tours that were previously imported.

#### Scenario: Re-import skips existing tours
- **WHEN** user runs import and a tour was already imported previously
- **THEN** the tour is skipped and counted as a duplicate in the import summary

### Requirement: Import batch tracking
Each import run SHALL be tracked as a batch with status and statistics.

#### Scenario: Batch lifecycle
- **WHEN** an import starts
- **THEN** a batch record is created with status "running", and updated to "completed" or "failed" when done

#### Scenario: Batch statistics
- **WHEN** an import completes
- **THEN** the batch shows: totalFound, importedCount, duplicateCount, and duration

### Requirement: Credential encryption
Komoot credentials SHALL be encrypted at rest using AES-256-GCM.

#### Scenario: Credentials stored securely
- **WHEN** a user connects their Komoot account
- **THEN** the password is encrypted before storage and only decrypted when making API calls

### Requirement: Privacy disclosure
The Komoot integration SHALL be documented in the privacy manifest.

#### Scenario: Privacy manifest updated
- **WHEN** Komoot import is available
- **THEN** the /privacy page documents: what credentials are stored, what data is imported, and that credentials are encrypted
