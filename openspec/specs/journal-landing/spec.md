## Purpose

The Journal home page (`/`) serves three audiences with one route: anonymous visitors arriving at the flagship trails.cool instance, anyone landing on a self-hosted Journal instance, and signed-in users returning to *their own* home. It introduces the product to visitors on the flagship, shows a public activity feed on every instance for visitors, and swaps in a personal activity stream for signed-in users so "home" means "your stuff."
## Requirements
### Requirement: Home behavior depends on session
The `/` route SHALL render one of two distinct layouts based on whether the request carries a valid session. Signed-in users see a personal activity dashboard; signed-out visitors see the marketing + public-feed layout. The two layouts SHALL NOT render simultaneously — a signed-in user does not see the marketing blurbs, auth CTAs, or public instance feed on their home; a signed-out visitor does not see anyone's personal stream.

#### Scenario: Signed-in user gets the personal dashboard
- **WHEN** a request to `/` carries a valid session
- **THEN** the response is the personal dashboard layout (welcome + New Activity CTA + own activity stream)

#### Scenario: Anonymous visitor gets the visitor home
- **WHEN** a request to `/` carries no session
- **THEN** the response is the visitor home layout (hero + auth CTAs + flagship-conditional marketing + public-feed)

### Requirement: Visitor home hero and auth CTAs
For signed-out visitors, the home page SHALL render a hero section with a product-describing headline, a short tagline, and Register and Sign In as the primary CTAs. A link to the Planner SHALL be available but visually secondary to auth, because the main conversion goal is account creation.

#### Scenario: Auth CTAs are primary
- **WHEN** a visitor without a session loads the home page
- **THEN** Register (primary button) and Sign In (outlined button) appear together, with a smaller "Or try the Planner without an account →" link below them

### Requirement: Flagship-only marketing section
The visitor home SHALL render a four-card marketing section (Planner / Journal / Federation / Ownership) if and only if the `IS_FLAGSHIP` environment variable is `"true"`. Self-hosted instances SHALL NOT render this block; instead they SHALL show a "Powered by trails.cool — about the project" link that points to `https://trails.cool` so operators don't have to author their own marketing copy.

#### Scenario: Flagship shows marketing
- **WHEN** the visitor home renders with `IS_FLAGSHIP=true`
- **THEN** the four marketing cards are shown and the "Powered by" link is suppressed

#### Scenario: Self-host shows the back-link
- **WHEN** the visitor home renders with `IS_FLAGSHIP` unset or empty
- **THEN** the marketing cards are not rendered and a "Powered by trails.cool — about the project" link appears below the feed

### Requirement: Public activity feed on visitor home
The visitor home SHALL list the most recent public activities on the instance (see `activity-feed` spec, "Instance-wide public activity feed"). Each entry SHALL link to the activity detail page, show a map thumbnail when geometry is available, and display the owner's display name, distance, and start date.

#### Scenario: Feed populated
- **WHEN** public activities exist on the instance
- **THEN** the home renders a reverse-chronological list of at least the 20 most recent, each as a card with map thumbnail + owner + stats + date

#### Scenario: Empty feed
- **WHEN** the instance has no public activities
- **THEN** the visitor home shows an empty-state message instead of the feed list; all other sections (hero, marketing, CTAs) remain unchanged

### Requirement: Personal dashboard for signed-in users
For signed-in users, the home page SHALL render a personal activity dashboard: a welcome line linking to the user's profile, a "New Activity" CTA, and a reverse-chronological list of the user's own most recent activities (including `private`, `unlisted`, and `public`). The public instance feed SHALL NOT be rendered on this view; users who want it can browse other users' profiles or the dedicated activities/routes pages.

#### Scenario: Dashboard shows user's own activities
- **WHEN** a signed-in user loads the home page
- **THEN** they see their own activities in reverse-chronological order, regardless of visibility, up to 20 entries

#### Scenario: Dashboard empty state
- **WHEN** a signed-in user has no activities yet
- **THEN** the dashboard shows an empty-state message pointing to activity creation, while the welcome line and New Activity CTA remain visible

### Requirement: Social feed link for signed-in users
For signed-in users, the personal dashboard SHALL include a prominent link to the social feed at `/feed` (see `social-follows` spec, "Social activity feed") alongside the existing "New Activity" CTA. The link SHALL be visible regardless of whether the user follows anyone yet — the social feed's own empty state handles the zero-follows case.

#### Scenario: Feed link on personal dashboard
- **WHEN** a signed-in user loads `/`
- **THEN** the dashboard header shows a "Feed" (or equivalent) link to `/feed` next to the "New Activity" CTA

#### Scenario: Feed link is not shown to signed-out visitors
- **WHEN** an unauthenticated visitor loads `/`
- **THEN** the visitor-home layout does not expose a link to `/feed` (the route requires authentication)


### Requirement: Notifications entry in the navbar
The navbar SHALL render a "Notifications" entry for signed-in users, linking to `/notifications`. It SHALL render an unread count badge when the user has at least one unread notification, and no badge when the count is zero. This entry SHALL be distinct from the existing "Follow requests" entry — they cover different categories (informational vs. actionable). The badge live-updates via `sse-broker`; the loader-driven count is the SSR baseline.

#### Scenario: Signed-in user sees the entry
- **WHEN** a signed-in user loads any page
- **THEN** the navbar includes a "Notifications" link to `/notifications`, and a count badge if the user has unread rows

#### Scenario: Anonymous user does not see the entry
- **WHEN** an unauthenticated visitor loads any page
- **THEN** the navbar does not include the Notifications entry (the route requires authentication anyway)
