## ADDED Requirements

### Requirement: Synthetic activity flag
The Journal SHALL persist a `synthetic` boolean on every activity so automated / demo content can be distinguished from user-created content.

#### Scenario: User-created activities default to non-synthetic
- **WHEN** an activity is created through any user-facing flow (GPX upload, sync import, Planner handoff)
- **THEN** the activity row is persisted with `synthetic = false`

#### Scenario: Bot inserts flag their rows as synthetic
- **WHEN** the demo-activity-bot inserts an activity
- **THEN** the row is persisted with `synthetic = true`

#### Scenario: Synthetic flag is not user-editable
- **WHEN** an activity owner edits the activity via any user-facing action
- **THEN** the stored `synthetic` value is not changed by the edit
