## ADDED Requirements

### Requirement: Connected devices list
The Journal web settings page SHALL display a list of connected devices (active OAuth2 sessions).

#### Scenario: View connected devices
- **WHEN** the user opens the account settings page on the Journal web UI
- **THEN** a "Connected Devices" section lists all active OAuth2 tokens with device name, last active timestamp, and approximate location (derived from IP)

#### Scenario: Device shows last active time
- **WHEN** a device makes an API request using its OAuth2 token
- **THEN** the Journal updates the token's last active timestamp and IP address

### Requirement: Device metadata on token
Each OAuth2 token SHALL store device name, last active timestamp, and IP address.

#### Scenario: Device name stored on token exchange
- **WHEN** the mobile app exchanges an authorization code for tokens via `POST /oauth/token`
- **THEN** the device name (sent in the request body, e.g., "iPhone 15, iOS 18") is stored alongside the token record

#### Scenario: Last active updated on API use
- **WHEN** a bearer token is used to authenticate an API request
- **THEN** the token's `lastActiveAt` and `lastActiveIp` fields are updated

### Requirement: Revoke individual device tokens
Users SHALL be able to revoke individual device sessions from the Journal web settings page.

#### Scenario: Revoke device from web
- **WHEN** the user clicks "Revoke" on a connected device in the Journal settings
- **THEN** the OAuth2 token for that device is deleted and all subsequent API requests from that device fail with 401

#### Scenario: Revoke device from API
- **WHEN** a client sends `DELETE /api/v1/auth/devices/:id` with a valid bearer token
- **THEN** the targeted device token is revoked (the requesting device can revoke other devices, not itself via this endpoint)
