## Requirements

### Requirement: localStorage crash recovery
The Planner SHALL periodically save Yjs state to localStorage and recover it on reconnect.

#### Scenario: Browser crash recovery
- **WHEN** a user's browser crashes and they reopen the session
- **THEN** unsaved changes from localStorage are merged with the server state

#### Scenario: Clean exit
- **WHEN** a session syncs successfully
- **THEN** the localStorage backup is cleared
