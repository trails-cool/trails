## ADDED Requirements

### Requirement: User registration
The Journal SHALL allow new users to create an account with email and password.

#### Scenario: Successful registration
- **WHEN** a user submits a valid email and password on the registration page
- **THEN** a new user account is created and the user is logged in

#### Scenario: Duplicate email
- **WHEN** a user submits an email that is already registered
- **THEN** the system displays an error indicating the email is already in use

### Requirement: User login
The Journal SHALL allow existing users to log in with email and password.

#### Scenario: Successful login
- **WHEN** a user submits valid credentials
- **THEN** the user is authenticated and redirected to their activity feed

#### Scenario: Invalid credentials
- **WHEN** a user submits invalid credentials
- **THEN** the system displays an error without revealing which field is wrong

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
