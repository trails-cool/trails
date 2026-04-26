## ADDED Requirements

### Requirement: Visitor home links to /explore
For signed-out visitors on the flagship instance and self-hosted instances alike, the visitor home (`/`) SHALL include a link to `/explore` so anonymous visitors have an in-app path to browse the local user directory before signing up. The link SHALL be visually secondary to the auth CTAs (it does not compete with Register / Sign In as the conversion goal) but reachable on the same first-fold page section.

#### Scenario: Visitor home renders the Explore link
- **WHEN** a signed-out visitor loads `/`
- **THEN** the page includes a link to `/explore` somewhere within the hero / CTAs section, visually secondary to Register and Sign In

#### Scenario: Signed-in user does not see the visitor-home Explore link
- **WHEN** a signed-in user loads `/`
- **THEN** the visitor-home layout is not rendered (the personal dashboard takes its place); the navbar's Explore entry is the signed-in user's path to `/explore`
