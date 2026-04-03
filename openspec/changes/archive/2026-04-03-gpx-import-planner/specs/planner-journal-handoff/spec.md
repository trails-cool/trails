## MODIFIED Requirements

### Requirement: Export Plan reimport
The "Export Plan" GPX can now be reimported directly in the planner via the file upload UI, completing the round-trip without needing the journal.

#### Scenario: Reimport exported plan
- **WHEN** a user exports a plan and later imports it via the planner's GPX upload
- **THEN** waypoints, no-go areas, and track data are restored from the GPX
- **AND** BRouter re-routes between the imported waypoints with the imported no-go areas active
