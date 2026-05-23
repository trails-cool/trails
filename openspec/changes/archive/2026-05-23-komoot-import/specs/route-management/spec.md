## MODIFIED Requirements

### Requirement: Route creation
The system SHALL support creating routes via import from external services, in addition to manual creation and GPX upload.

#### Scenario: Route created from import
- **WHEN** a Komoot tour is imported
- **THEN** a route is created with name, distance, elevation, GPX geometry, and a source field indicating "komoot"

#### Scenario: Route links to activity
- **WHEN** a tour is imported as an activity
- **THEN** the activity is linked to the created route
