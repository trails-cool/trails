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
- **AND** the version identifier of the Terms the user saw is stored in `users.terms_version`

#### Scenario: Missing version rejected
- **WHEN** a registration request arrives without a non-empty `termsVersion` field
- **THEN** the server responds with HTTP 400 and does not create a user

### Requirement: Re-accept updated Terms on next visit
Logged-in users whose stored `terms_version` does not match the currently-published version SHALL be prompted to accept the current Terms before accessing any non-allow-listed page.

#### Scenario: Stale version redirects to accept-terms page
- **WHEN** a logged-in user whose `users.terms_version` is NULL or differs from the current `TERMS_VERSION` requests any page outside the allow-list (`/auth/accept-terms`, `/auth/logout`, `/legal/*`)
- **THEN** the server redirects them to `/auth/accept-terms?returnTo=<original path>`

#### Scenario: Allow-list keeps Terms and logout reachable
- **WHEN** the same user requests `/legal/terms`, `/legal/privacy`, `/legal/imprint`, `/auth/accept-terms`, or `/auth/logout`
- **THEN** the request is served normally without being redirected

#### Scenario: Successful re-acceptance updates both fields
- **WHEN** a user submits the acceptance form with the required checkbox ticked
- **THEN** the server updates `users.terms_version` to the current version and `users.terms_accepted_at` to the current timestamp, then redirects to the `returnTo` path (or `/`)

#### Scenario: Re-acceptance rejects missing consent
- **WHEN** the form is submitted without the checkbox ticked
- **THEN** the server responds with HTTP 400 and does not update the user row

#### Scenario: returnTo is restricted to same-origin paths
- **WHEN** a `returnTo` value is not a same-origin absolute path (missing leading `/`, or starting with `//`)
- **THEN** the server redirects to `/` instead, preventing open-redirect abuse
