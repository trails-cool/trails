## Purpose

Collaborative rich text notes in Planner sessions, powered by CodeMirror 6 with Yjs CRDT sync and real-time cursor awareness.

## Requirements

### Requirement: Collaborative session notes
Planner sessions SHALL have a shared text editor for participants to write notes, with character-level real-time sync.

#### Scenario: Write notes
- **WHEN** a user types in the notes editor
- **THEN** the text syncs character-by-character to all other participants via Yjs Y.Text

#### Scenario: Remote cursor awareness
- **WHEN** multiple participants are editing notes
- **THEN** each participant sees the others' cursor positions and selections highlighted in their assigned color with their name label

#### Scenario: Notes persist across reload
- **WHEN** a participant reloads the session page
- **THEN** the notes content is restored from the Yjs document
- **AND** the editor displays the existing text immediately

#### Scenario: Notes persist across reconnect
- **WHEN** a user leaves and rejoins a session
- **THEN** the notes are still there (stored in Yjs doc and crash recovery)

### Requirement: Editor implementation
The notes editor SHALL use CodeMirror 6 with y-codemirror.next for Yjs binding.

#### Scenario: Undo/redo
- **WHEN** a user presses Ctrl+Z / Ctrl+Shift+Z in the notes editor
- **THEN** undo/redo applies to notes only (separate Y.UndoManager from waypoint undo)

#### Scenario: Awareness field isolation
- **WHEN** the notes editor sets cursor awareness state
- **THEN** it does not conflict with map cursor awareness (uses separate awareness fields)

### Requirement: Notes in GPX export
Notes SHALL be included in GPX exports as `<metadata><desc>`.

#### Scenario: Export plan with notes
- **WHEN** a user exports a plan GPX and notes are present
- **THEN** the GPX contains `<metadata><desc>` with the notes text

#### Scenario: Import GPX with notes
- **WHEN** a GPX file with `<metadata><desc>` is imported
- **THEN** the notes editor is populated with the description text

### Requirement: Notes sync to Journal
Notes SHALL be saved to the Journal route description when saving via callback.

#### Scenario: Save to Journal with notes
- **WHEN** a user saves a route to the Journal and notes are present
- **THEN** the route's description field is set from the notes text

#### Scenario: Edit in Planner restores notes
- **WHEN** a user clicks "Edit in Planner" on a Journal route with a description
- **THEN** the Planner session's notes editor is populated with the description
