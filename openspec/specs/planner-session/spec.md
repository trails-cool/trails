## Purpose

Collaborative planning session management with Yjs CRDT synchronization, supporting initialization from URL parameters, journal handoff, and GPX file upload.

## Requirements

### Requirement: Session initialization from GPX
The Planner SHALL support initializing sessions from a GPX file upload in addition to URL parameters and the journal handoff.

#### Scenario: Session created from GPX upload
- **WHEN** a session is created via GPX file upload on the home page
- **THEN** waypoints and no-go areas from the GPX are passed via URL parameters to the session page
- **AND** the Yjs document is initialized with the extracted data on the client side
