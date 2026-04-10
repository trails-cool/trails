## Purpose

Round-trip GPX exchange between Planner and Journal, including JWT-scoped callbacks for saving routes and GPX reimport in the Planner.

## Requirements

### Requirement: Export Plan reimport
The Planner SHALL support reimporting an exported plan GPX via the file upload UI, completing the round-trip without needing the journal.

#### Scenario: Reimport exported plan
- **WHEN** a user exports a plan and later imports it via the planner's GPX upload
- **THEN** waypoints, no-go areas, and track data are restored from the GPX
- **AND** BRouter re-routes between the imported waypoints with the imported no-go areas active
