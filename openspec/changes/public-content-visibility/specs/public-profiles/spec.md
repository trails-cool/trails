## ADDED Requirements

### Requirement: Public profile page
The Journal SHALL serve a public profile page at `/users/:username` that lists the user's public routes and activities in reverse chronological order, viewable without authentication.

#### Scenario: Logged-out visitor views a profile with public content
- **WHEN** an unauthenticated visitor navigates to `/users/:username` for a user with at least one `public` route or activity
- **THEN** the page renders that user's display name (falling back to username), the `@username@domain` handle, and a reverse-chronological list of their `public` routes and `public` activities
- **AND** items marked `unlisted` or `private` do NOT appear in the list

#### Scenario: Profile 404 when there is no public content
- **WHEN** a visitor navigates to `/users/:username` for a user whose content is all `private` or `unlisted`, or for a username that does not exist
- **THEN** the server responds with HTTP 404
- **AND** the response does NOT distinguish the two cases, so existence of a private-only account is not leaked

#### Scenario: Owner sees their own profile
- **WHEN** a user navigates to their own `/users/:username` while logged in
- **THEN** the page renders exactly the same as for a logged-out visitor, plus a small owner-only control strip linking to settings

#### Scenario: Profile page emits social-share metadata
- **WHEN** any visitor loads a populated `/users/:username`
- **THEN** the page emits Open Graph tags (`og:title`, `og:site_name`, `og:type="profile"`) so links shared on social platforms render a meaningful preview
