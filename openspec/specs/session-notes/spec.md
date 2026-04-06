## Purpose

Collaborative text notes in Planner sessions, synced in real-time via Yjs.

## Requirements

### Requirement: Collaborative session notes
Planner sessions SHALL have a shared text area for participants to write notes.

#### Scenario: Write notes
- **WHEN** a user types in the notes area
- **THEN** the text syncs in real-time to all other participants via Yjs

#### Scenario: Notes persist
- **WHEN** a user leaves and rejoins a session
- **THEN** the notes are still there (stored in Yjs doc)
