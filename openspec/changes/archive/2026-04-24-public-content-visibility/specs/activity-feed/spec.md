## MODIFIED Requirements

### Requirement: Activity detail page
The Journal SHALL display an activity detail page with map, stats, and description. Access depends on the activity's `visibility`: `public` activities are viewable by anyone including unauthenticated visitors, `unlisted` activities are viewable by anyone who has the URL, and `private` activities are viewable only by the owner.

#### Scenario: Owner views own activity
- **WHEN** a logged-in user navigates to an activity they own at any visibility
- **THEN** they see the activity name, description, a map with the GPS trace, distance, duration, and elevation stats

#### Scenario: Anyone views a public activity
- **WHEN** any visitor (including unauthenticated) navigates to a `public` activity's URL
- **THEN** they see the full activity detail page as above

#### Scenario: Anyone with the URL views an unlisted activity
- **WHEN** any visitor navigates directly to an `unlisted` activity's URL
- **THEN** they see the full activity detail page as above

#### Scenario: Non-owner is blocked from a private activity
- **WHEN** a visitor who is not the owner requests a `private` activity URL
- **THEN** the server responds with HTTP 404 (not 403), so the existence of the private activity is not leaked

#### Scenario: Public and unlisted activity pages emit social-share metadata
- **WHEN** a visitor loads a `public` or `unlisted` activity detail page
- **THEN** the response emits Open Graph and Twitter Card meta tags (`og:title`, `og:description`, `og:type="article"`, `og:site_name`, `twitter:card="summary"`)

## ADDED Requirements

### Requirement: Activity visibility
The Journal SHALL persist a `visibility` value on every activity and SHALL allow the owner to change it.

#### Scenario: New activities default to private
- **WHEN** an activity is created without an explicit visibility
- **THEN** the activity row is persisted with `visibility = 'private'`

#### Scenario: Owner changes an activity's visibility
- **WHEN** an activity owner selects a different visibility (`private`, `unlisted`, `public`) and saves
- **THEN** the stored visibility is updated and subsequent access checks use the new value immediately

### Requirement: Activity listings respect visibility
The Journal's own-activities feed SHALL show the owner everything regardless of visibility, while any cross-user listing SHALL only include activities with `visibility = 'public'`.

#### Scenario: Own activity feed is unchanged
- **WHEN** a logged-in user views their own activity feed
- **THEN** the feed includes all of their own activities regardless of visibility

#### Scenario: Public profile lists only public activities
- **WHEN** a visitor loads `/users/:username`
- **THEN** the rendered list of activities includes only the user's `public` activities; `unlisted` and `private` activities are omitted
