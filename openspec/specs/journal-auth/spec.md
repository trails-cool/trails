## Purpose

Authentication for the Journal app, including OAuth token storage for external services in the sync_connections table.

## Requirements

### Requirement: Store external service tokens
The journal auth system SHALL store OAuth tokens for external services alongside user credentials.

#### Scenario: Wahoo token storage
- **WHEN** a user connects their Wahoo account
- **THEN** access token, refresh token, expiry time, and Wahoo user ID are stored in the `wahoo_tokens` table
- **AND** tokens are associated with the journal user ID

### Requirement: Terms acknowledgement at signup
The registration form SHALL require explicit acknowledgement of the Terms of Service before an account can be created.

#### Scenario: Checkbox required
- **WHEN** a user views the registration form
- **THEN** they see a required checkbox labeled "I have read and agree to the Terms of Service, including that trails.cool is in alpha and my data may be reset"
- **AND** the checkbox label links to the Terms page

#### Scenario: Cannot submit without acknowledgement
- **WHEN** a user attempts to register without checking the acknowledgement box
- **THEN** the form blocks submission and shows a validation message

#### Scenario: Acknowledgement recorded
- **WHEN** a user successfully registers
- **THEN** the current timestamp is stored in `users.terms_accepted_at`
