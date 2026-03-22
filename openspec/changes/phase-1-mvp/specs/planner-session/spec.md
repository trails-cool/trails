## ADDED Requirements

### Requirement: Create collaborative session
The Planner SHALL allow creating a new editing session that generates a unique shareable URL. Sessions SHALL be created either from the Planner directly (empty route) or via a Journal callback (with initial GPX data).

#### Scenario: Create empty session
- **WHEN** a user navigates to planner.trails.cool
- **THEN** a new Yjs session is created with an empty waypoint list and the user is redirected to `/session/<session-id>`

#### Scenario: Create session from Journal callback
- **WHEN** the Journal opens `planner.trails.cool/new?callback=<url>&token=<jwt>&gpx=<encoded-gpx>`
- **THEN** a new Yjs session is created with waypoints parsed from the GPX and the callback URL is stored for later save operations

### Requirement: Join session via link
The Planner SHALL allow any user (including guests without accounts) to join an existing session by navigating to its URL.

#### Scenario: Join active session
- **WHEN** a user navigates to `planner.trails.cool/session/<session-id>`
- **THEN** the user connects to the Yjs document and sees the current route state with all other participants' cursors

#### Scenario: Join expired session
- **WHEN** a user navigates to a session URL that has expired
- **THEN** the system displays an error message indicating the session no longer exists

### Requirement: Real-time collaborative editing
The Planner SHALL synchronize waypoint edits across all connected participants in real-time using Yjs CRDTs.

#### Scenario: Add waypoint
- **WHEN** participant A adds a waypoint to the map
- **THEN** participant B sees the waypoint appear within 500ms

#### Scenario: Reorder waypoints
- **WHEN** participant A drags a waypoint to reorder it
- **THEN** participant B sees the updated waypoint order within 500ms

#### Scenario: Concurrent edits
- **WHEN** participant A and B both add waypoints simultaneously
- **THEN** both waypoints appear for both participants without conflict

### Requirement: Session persistence
The Planner SHALL persist Yjs session state to PostgreSQL so that sessions survive server restarts.

#### Scenario: Server restart recovery
- **WHEN** the Planner server restarts while a session is active
- **THEN** reconnecting clients recover the full session state from PostgreSQL

### Requirement: Session expiry
The Planner SHALL automatically expire sessions after a configurable period of inactivity (default: 7 days, max: 30 days).

#### Scenario: Session expires
- **WHEN** no edits are made to a session for 7 days
- **THEN** the session is deleted from PostgreSQL and its URL returns a 404

### Requirement: Manual session close
The session owner (initiator) SHALL be able to manually close a session.

#### Scenario: Owner closes session
- **WHEN** the session owner clicks "Close Session"
- **THEN** all connected participants are notified, the session triggers auto-save if a callback exists, and the session becomes inaccessible

### Requirement: User presence
The Planner SHALL display presence indicators showing which users are currently connected to a session.

#### Scenario: Show connected users
- **WHEN** multiple users are connected to a session
- **THEN** each user sees a list of other connected users with assigned colors

### Requirement: No user data collection
The Planner SHALL NOT collect, store, or track any personal user data. Sessions are anonymous by default.

#### Scenario: Anonymous session participation
- **WHEN** a user joins a session without any account
- **THEN** the user is assigned a random color and temporary display name with no data persisted about their identity
