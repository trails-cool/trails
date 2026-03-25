## MODIFIED Requirements

### Requirement: Planner home page
The Planner home page SHALL provide a clear call-to-action to create a new planning session and a link back to the home page from within sessions.

#### Scenario: Home page CTA
- **WHEN** a user visits the Planner home page
- **THEN** a prominent "Start Planning" button is visible that links to `/new`

#### Scenario: Session home link
- **WHEN** a user is in a planning session
- **THEN** the header contains a link back to the Planner home page
