## MODIFIED Requirements

### Requirement: Session participant awareness
Users in a planning session SHALL see who else is present and be able to identify themselves.

#### Scenario: Participant list visible
- **WHEN** multiple users are in a session
- **THEN** the header shows each participant's name and color

#### Scenario: Host badge
- **WHEN** a participant is the routing host
- **THEN** their entry in the participant list shows a host indicator

#### Scenario: Edit own name
- **WHEN** a user clicks their own name in the participant list
- **THEN** an inline text input appears to change their display name

#### Scenario: Name persisted
- **WHEN** a user changes their name
- **THEN** the name is saved to localStorage and immediately visible to all other participants via awareness

#### Scenario: Join notification
- **WHEN** a new participant joins the session
- **THEN** a brief toast shows "[name] joined"

#### Scenario: Leave notification
- **WHEN** a participant leaves the session
- **THEN** a brief toast shows "[name] left"
