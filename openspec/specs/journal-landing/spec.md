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

### Requirement: Top navbar shape (signed-in vs anonymous)
The Journal SHALL render a top navbar on every page. The navbar's contents depend on whether the request carries a session and on viewport size; this requirement consolidates the full shape so the navbar's makeup is captured in one place rather than scattered across feature specs.

**Anonymous (any viewport):** brand link to `/` · `Sign In` · `Register` (primary CTA). No primary nav entries.

**Signed-in, desktop (≥ md / 768px):** brand link to `/` · primary-nav cluster (`Feed` → `/feed`, `Explore` → `/explore`, `Routes` → `/routes`, `Activities` → `/activities`) · bell icon → `/notifications` (with live unread badge per the `notifications` spec) · avatar dropdown trigger.

**Signed-in, mobile (< md):** brand link · bell icon · hamburger trigger. Tapping the hamburger opens a slide-out drawer that contains the same primary-nav cluster, the bell entry repeated as a labelled link, plus the avatar-dropdown items (Profile / Settings / Log Out). The drawer locks body scroll while open and closes on navigation or Escape.

The avatar dropdown trigger SHALL render an Avatar (initials fallback when no image — the `users` table has no avatar column today, so initials are the only state) with `aria-label = displayName ?? username` and `aria-expanded` reflecting the open state. Opening the dropdown reveals three menuitems (`role="menuitem"`): Profile (links to `/users/<self>`), Settings (links to `/settings`), Log Out (a `<button>` inside a logout `<Form>` posting to `/auth/logout`). Click-outside or Escape SHALL close the dropdown.

The navbar SHALL NOT render a separate "Follow requests" entry — follow-request actions are the Requests tab inside `/notifications` (see `notifications` spec) and the bell's unread badge already counts the corresponding `follow_request_received` rows.

#### Scenario: Anonymous navbar
- **WHEN** an unauthenticated visitor loads any page
- **THEN** the navbar shows the brand link, a `Sign In` link, and a `Register` button — no primary-nav cluster, no bell, no avatar

#### Scenario: Signed-in desktop navbar
- **WHEN** a signed-in user loads any page on a viewport ≥ 768px
- **THEN** the navbar shows the brand, the primary-nav cluster (Feed, Explore, Routes, Activities), the bell (with live unread badge per `notifications`), and the avatar dropdown trigger

#### Scenario: Signed-in mobile navbar
- **WHEN** a signed-in user loads any page on a viewport < 768px
- **THEN** the navbar shows the brand, the bell, and a hamburger trigger
- **AND** tapping the hamburger opens a drawer containing all primary-nav entries plus Profile / Settings / Log Out

#### Scenario: Avatar dropdown reveals account menuitems
- **WHEN** a signed-in user clicks (or taps) the avatar trigger on desktop
- **THEN** a popup with `role="menu"` opens, containing three items with `role="menuitem"`: Profile (→ `/users/<self>`), Settings (→ `/settings`), Log Out (POST to `/auth/logout`)
- **AND** clicking outside the popup, pressing Escape, or selecting a menuitem closes it

#### Scenario: No standalone Follow requests entry
- **WHEN** a signed-in user with one or more pending follow requests loads any page
- **THEN** the navbar does NOT render a separate "Follow requests" link; the bell's unread badge already counts the corresponding `follow_request_received` notifications, and the Requests tab inside `/notifications` is the actionable surface


### Requirement: Visitor home links to /explore
For signed-out visitors on the flagship instance and self-hosted instances alike, the visitor home (`/`) SHALL include a link to `/explore` so anonymous visitors have an in-app path to browse the local user directory before signing up. The link SHALL be visually secondary to the auth CTAs (it does not compete with Register / Sign In as the conversion goal) but reachable on the same first-fold page section.

#### Scenario: Visitor home renders the Explore link
- **WHEN** a signed-out visitor loads `/`
- **THEN** the page includes a link to `/explore` somewhere within the hero / CTAs section, visually secondary to Register and Sign In

#### Scenario: Signed-in user does not see the visitor-home Explore link
- **WHEN** a signed-in user loads `/`
- **THEN** the visitor-home layout is not rendered (the personal dashboard takes its place); the navbar's Explore entry is the signed-in user's path to `/explore`
