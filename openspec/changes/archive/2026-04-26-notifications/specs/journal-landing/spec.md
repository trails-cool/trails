## ADDED Requirements

### Requirement: Notifications entry in the navbar
The navbar SHALL render a "Notifications" entry for signed-in users, linking to `/notifications`. It SHALL render an unread count badge when the user has at least one unread notification, and no badge when the count is zero. This entry SHALL be distinct from the existing "Follow requests" entry — they cover different categories (informational vs. actionable).

#### Scenario: Signed-in user sees the entry
- **WHEN** a signed-in user loads any page
- **THEN** the navbar includes a "Notifications" link to `/notifications`, and a count badge if the user has unread rows

#### Scenario: Anonymous user does not see the entry
- **WHEN** an unauthenticated visitor loads any page
- **THEN** the navbar does not include the Notifications entry (the route requires authentication anyway)
