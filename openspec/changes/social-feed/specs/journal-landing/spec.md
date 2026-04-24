## ADDED Requirements

### Requirement: Social feed link for signed-in users
For signed-in users, the personal dashboard SHALL include a prominent link to the social feed at `/feed` (see `social-follows` spec, "Social activity feed") alongside the existing "New Activity" CTA. The link SHALL be visible regardless of whether the user follows anyone yet — the social feed's own empty state handles the zero-follows case.

#### Scenario: Feed link on personal dashboard
- **WHEN** a signed-in user loads `/`
- **THEN** the dashboard header shows a "Feed" (or equivalent) link to `/feed` next to the "New Activity" CTA

#### Scenario: Feed link is not shown to signed-out visitors
- **WHEN** an unauthenticated visitor loads `/`
- **THEN** the visitor-home layout does not expose a link to `/feed` (the route requires authentication)
