## Purpose

The Journal home page (`/`) serves two audiences with one layout: anonymous visitors arriving at the flagship trails.cool instance, and anyone landing on a self-hosted Journal instance. It introduces the product on the flagship, shows a public activity feed on every instance, and avoids asking self-hosters to write their own marketing copy.

## Requirements

### Requirement: Hero and auth CTAs
The home page SHALL render a hero section with a product-describing headline, a short tagline, and — for logged-out visitors — Register and Sign In as the primary CTAs. A link to the Planner SHALL be available but visually secondary to auth, because the main conversion goal is account creation.

#### Scenario: Logged-out visitor sees auth CTAs
- **WHEN** a visitor without a session loads the home page
- **THEN** Register (primary button) and Sign In (outlined button) appear together, with a smaller "Or try the Planner without an account →" link below them

#### Scenario: Logged-in user sees welcome instead of CTAs
- **WHEN** a signed-in user loads the home page
- **THEN** the auth CTAs are replaced by a welcome line linking to their profile

### Requirement: Flagship-only marketing section
The home page SHALL render a four-card marketing section (Planner / Journal / Federation / Ownership) if and only if the `IS_FLAGSHIP` environment variable is `"true"`. Self-hosted instances SHALL NOT render this block; instead they SHALL show a "Powered by trails.cool — about the project" link that points to `https://trails.cool` so operators don't have to author their own marketing copy.

#### Scenario: Flagship shows marketing
- **WHEN** the home page renders with `IS_FLAGSHIP=true`
- **THEN** the four marketing cards are shown and the "Powered by" link is suppressed

#### Scenario: Self-host shows the back-link
- **WHEN** the home page renders with `IS_FLAGSHIP` unset or empty
- **THEN** the marketing cards are not rendered and a "Powered by trails.cool — about the project" link appears below the feed

### Requirement: Public activity feed on home
The home page SHALL list the most recent public activities on the instance (see `activity-feed` spec, "Instance-wide public activity feed"). Each entry SHALL link to the activity detail page, show a map thumbnail when geometry is available, and display the owner's display name, distance, and start date.

#### Scenario: Feed populated
- **WHEN** public activities exist on the instance
- **THEN** the home renders a reverse-chronological list of at least the 20 most recent, each as a card with map thumbnail + owner + stats + date

#### Scenario: Empty feed
- **WHEN** the instance has no public activities
- **THEN** the home shows an empty-state message instead of the feed list; all other sections (hero, marketing, CTAs) remain unchanged
