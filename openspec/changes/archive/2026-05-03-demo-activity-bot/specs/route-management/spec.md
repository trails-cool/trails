## ADDED Requirements

### Requirement: Synthetic route flag
The Journal SHALL persist a `synthetic` boolean on every route so automated / demo content can be distinguished from user-created content.

#### Scenario: User-created routes default to non-synthetic
- **WHEN** a route is created through any user-facing flow (New Route, GPX import, Planner handoff)
- **THEN** the route row is persisted with `synthetic = false`

#### Scenario: Bot inserts flag their rows as synthetic
- **WHEN** the demo-activity-bot inserts a route
- **THEN** the row is persisted with `synthetic = true`

#### Scenario: Synthetic flag is not user-editable
- **WHEN** a route owner edits a route via any user-facing action
- **THEN** the stored `synthetic` value is not changed by the edit
