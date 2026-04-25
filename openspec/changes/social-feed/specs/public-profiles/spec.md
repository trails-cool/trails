## ADDED Requirements

### Requirement: Profile visibility setting
Every user SHALL have an explicit `profile_visibility` of `public` or `private`. New accounts SHALL default to `public`. Users SHALL be able to change their profile visibility from account settings at any time.

#### Scenario: Default for a new account
- **WHEN** a user registers
- **THEN** their `profile_visibility` is `public`

#### Scenario: Existing user backfilled to public
- **WHEN** the migration that introduces `profile_visibility` runs against pre-existing rows
- **THEN** every existing user's `profile_visibility` is set to `public`, preserving current effective behavior

#### Scenario: User toggles profile to private
- **WHEN** a user changes their profile visibility to `private` in settings and saves
- **THEN** subsequent requests to `/users/:username` return HTTP 404 (regardless of how much public content they have), and they become unfollowable (existing follow rows are unaffected, but no new follows can be created)

#### Scenario: User toggles profile back to public
- **WHEN** a previously-private user switches `profile_visibility` to `public` and saves
- **THEN** their `/users/:username` becomes reachable again (subject to the existing "has public content" gate) and Follow buttons reappear for visitors

## MODIFIED Requirements

### Requirement: Public profile page
The Journal SHALL serve a public profile page at `/users/:username` that lists the user's public routes and activities in reverse chronological order, viewable without authentication. The page SHALL render only when the user's `profile_visibility` is `public` AND they have at least one `public` route or activity. For signed-in viewers other than the owner, the page SHALL display a Follow / Unfollow toggle that mirrors the current follow relation (see `social-follows` spec). The page SHALL also display follower and following counts with links to the respective collections.

#### Scenario: Logged-out visitor views a public profile with public content
- **WHEN** an unauthenticated visitor navigates to `/users/:username` for a user whose `profile_visibility` is `public` and who has at least one `public` route or activity
- **THEN** the page renders that user's display name (falling back to username), the `@username@domain` handle, follower and following counts, and a reverse-chronological list of their `public` routes and `public` activities
- **AND** items marked `unlisted` or `private` do NOT appear in the list

#### Scenario: Profile 404 cases are indistinguishable
- **WHEN** a visitor navigates to `/users/:username` for any of: a user with `profile_visibility = 'private'`, a user with `profile_visibility = 'public'` but zero public items, a user whose content is all `private` or `unlisted`, or a username that does not exist
- **THEN** the server responds with HTTP 404
- **AND** the response does NOT distinguish the cases, so existence of a private account is not leaked

#### Scenario: Owner sees their own profile
- **WHEN** a user navigates to their own `/users/:username` while logged in
- **THEN** if their `profile_visibility = 'public'` and they have at least one public item, the page renders exactly the same as for a logged-out visitor, plus a small owner-only control strip linking to settings
- **AND** if their profile would 404 for visitors (private or no public content), they are redirected to settings or shown an owner-only "your profile isn't public yet" view (implementation detail)
- **AND** no Follow button is shown (users cannot follow themselves)

#### Scenario: Signed-in viewer sees a Follow control on a public profile
- **WHEN** a signed-in user other than the owner loads a profile that returns 200
- **THEN** the page renders a Follow button if no follow row exists for them against this user, and an Unfollow button if one does

#### Scenario: Profile page emits social-share metadata
- **WHEN** any visitor loads a populated `/users/:username`
- **THEN** the page emits Open Graph tags (`og:title`, `og:site_name`, `og:type="profile"`) so links shared on social platforms render a meaningful preview
