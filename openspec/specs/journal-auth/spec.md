## MODIFIED Requirements

### Requirement: Add passkey from new device
The Journal SHALL allow logged-in users to register additional passkeys from the account settings page or via the post-login prompt.

#### Scenario: Add passkey after magic link login
- **WHEN** a user logs in via magic link on a device that supports WebAuthn
- **THEN** the system prompts them to register a passkey for that device

#### Scenario: Add passkey from settings
- **WHEN** a user clicks "Add passkey" in the security section of account settings
- **THEN** the browser passkey creation prompt appears and the new passkey is stored

#### Scenario: Add passkey prompt on unsupported browser
- **WHEN** a user logs in via magic link on a device that does not support WebAuthn
- **THEN** the system shows the add-passkey prompt with a message that the browser does not support passkeys

## ADDED Requirements

### Requirement: Delete passkey
The Journal SHALL allow users to delete individual passkeys from account settings.

#### Scenario: Delete passkey
- **WHEN** a user deletes a passkey from account settings
- **THEN** the credential is removed from the database and can no longer be used for authentication

#### Scenario: Delete last passkey warning
- **WHEN** a user attempts to delete their only remaining passkey
- **THEN** a warning is shown explaining they will need to use magic links, and deletion proceeds after confirmation
