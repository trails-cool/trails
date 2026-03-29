## ADDED Requirements

### Requirement: Settings page access
The Journal SHALL provide an account settings page at `/settings` accessible to authenticated users.

#### Scenario: Authenticated access
- **WHEN** a logged-in user navigates to `/settings`
- **THEN** the settings page is displayed with profile, security, and account sections

#### Scenario: Unauthenticated access
- **WHEN** an unauthenticated user navigates to `/settings`
- **THEN** they are redirected to `/auth/login`

### Requirement: Profile editing
The settings page SHALL allow users to edit their display name and bio.

#### Scenario: Update display name
- **WHEN** a user changes their display name and submits
- **THEN** the display name is updated and reflected on their public profile

#### Scenario: Update bio
- **WHEN** a user enters a bio (max 160 characters) and submits
- **THEN** the bio is saved and visible on their public profile

#### Scenario: Empty fields
- **WHEN** a user clears their display name
- **THEN** their username is used as the display name fallback

### Requirement: Passkey management
The settings page SHALL list all registered passkeys and allow adding or deleting them.

#### Scenario: View passkeys
- **WHEN** a user visits the security section
- **THEN** they see a list of their passkeys with device type, transport label, and registration date

#### Scenario: Add passkey
- **WHEN** a user clicks "Add passkey" on a browser that supports WebAuthn
- **THEN** the browser passkey creation prompt appears and the new passkey is added to the list

#### Scenario: Add passkey unsupported browser
- **WHEN** a user visits the security section on a browser without WebAuthn
- **THEN** the "Add passkey" button is disabled with a message explaining the browser limitation

#### Scenario: Delete passkey
- **WHEN** a user clicks delete on a passkey and confirms
- **THEN** the passkey is removed and can no longer be used for login

#### Scenario: Delete last passkey
- **WHEN** a user deletes their only passkey
- **THEN** a warning is shown that they will need to use magic links to sign in, and the deletion proceeds after confirmation

### Requirement: Email change
The settings page SHALL allow users to change their email address with verification.

#### Scenario: Initiate email change
- **WHEN** a user enters a new email and submits
- **THEN** a verification link is sent to the new email address

#### Scenario: Verify new email
- **WHEN** the user clicks the verification link
- **THEN** their email is updated to the new address

#### Scenario: Duplicate email
- **WHEN** a user enters an email already in use by another account
- **THEN** an error is shown indicating the email is taken

### Requirement: Account deletion
The settings page SHALL allow users to permanently delete their account.

#### Scenario: Delete account
- **WHEN** a user clicks "Delete account" and types their username to confirm
- **THEN** their account and all associated data are permanently deleted and they are logged out

#### Scenario: Cancel deletion
- **WHEN** a user opens the delete confirmation but does not confirm
- **THEN** no data is deleted and they remain on the settings page

### Requirement: Settings navigation
The Journal navigation SHALL include a link to the settings page for authenticated users.

#### Scenario: Settings link visible
- **WHEN** a logged-in user views the navigation
- **THEN** a "Settings" link is present that navigates to `/settings`
