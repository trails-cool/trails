## ADDED Requirements

### Requirement: Passkey registration
The Journal SHALL allow new users to register using a passkey (WebAuthn). No password is required.

#### Scenario: Successful passkey registration
- **WHEN** a user enters an email and username and creates a passkey via the browser prompt
- **THEN** a new user account is created, the passkey credential is stored, and the user is logged in

#### Scenario: Duplicate email
- **WHEN** a user submits an email that is already registered
- **THEN** the system displays an error indicating the email is already in use

#### Scenario: Duplicate username
- **WHEN** a user submits a username that is already taken
- **THEN** the system displays an error indicating the username is not available

### Requirement: Passkey login
The Journal SHALL allow returning users to log in using a stored passkey.

#### Scenario: Successful passkey login
- **WHEN** a user clicks "Sign in" and selects a passkey from the browser prompt
- **THEN** the user is authenticated and redirected to their activity feed

#### Scenario: No passkey available
- **WHEN** a user has no passkey on the current device
- **THEN** the system offers magic link login as a fallback

### Requirement: Magic link login (fallback)
The Journal SHALL allow users to log in via a magic link sent to their email. This serves as a fallback for devices without passkey support or for logging in on a new device.

#### Scenario: Request magic link
- **WHEN** a user enters their email and clicks "Send magic link"
- **THEN** an email with a single-use login link is sent to their address

#### Scenario: Valid magic link
- **WHEN** a user clicks a valid, non-expired magic link
- **THEN** the user is logged in and the link is invalidated

#### Scenario: Expired magic link
- **WHEN** a user clicks a magic link older than 15 minutes
- **THEN** the system displays an error and prompts them to request a new link

#### Scenario: Rate limiting
- **WHEN** a user requests more than 5 magic links in 10 minutes
- **THEN** subsequent requests are rejected with a rate limit message

### Requirement: Add passkey from new device
The Journal SHALL allow logged-in users to register additional passkeys for new devices.

#### Scenario: Add passkey after magic link login
- **WHEN** a user logs in via magic link on a new device
- **THEN** the system prompts them to register a passkey for that device

### Requirement: User profile page
Each user SHALL have a public profile page displaying their username and routes.

#### Scenario: View own profile
- **WHEN** a logged-in user navigates to their profile
- **THEN** they see their username, bio, and a list of their routes

#### Scenario: View other user's profile
- **WHEN** a user navigates to another user's profile URL
- **THEN** they see that user's username, bio, and public routes

### Requirement: Federated identity structure
User accounts SHALL follow the federated identity pattern (`@user@instance`) to prepare for ActivityPub federation in Phase 2.

#### Scenario: Username format
- **WHEN** a user registers with username "alice" on trails.cool
- **THEN** their full identity is stored as `@alice@trails.cool`

### Requirement: Session management
The Journal SHALL maintain authenticated sessions using secure HTTP-only cookies.

#### Scenario: Session persistence
- **WHEN** a logged-in user closes and reopens their browser
- **THEN** they remain logged in if the session has not expired

#### Scenario: Logout
- **WHEN** a user clicks "Log out"
- **THEN** their session is invalidated and they are redirected to the login page

### Requirement: No passwords
The Journal SHALL NOT support password-based authentication. All authentication is via passkeys or magic links.

#### Scenario: No password field
- **WHEN** a user views the registration or login page
- **THEN** there is no password field

### Requirement: Magic link login
The magic link login flow SHALL deliver the link via email in production instead of logging to console.

#### Scenario: Production email delivery
- **WHEN** a user requests a magic link in production
- **THEN** the link is emailed to the user (not just logged to console)

#### Scenario: Dev mode unchanged
- **WHEN** a user requests a magic link in development
- **THEN** the link is returned directly for auto-redirect (existing behavior preserved)
