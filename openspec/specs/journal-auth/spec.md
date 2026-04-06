## Purpose

Authentication for the Journal app, including OAuth token storage for external services in the sync_connections table.

## Requirements

### Requirement: Store external service tokens
The journal auth system SHALL store OAuth tokens for external services alongside user credentials.

#### Scenario: Wahoo token storage
- **WHEN** a user connects their Wahoo account
- **THEN** access token, refresh token, expiry time, and Wahoo user ID are stored in the `wahoo_tokens` table
- **AND** tokens are associated with the journal user ID
