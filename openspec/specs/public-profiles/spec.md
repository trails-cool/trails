# public-profiles Specification

## Purpose
Profile pages at `/users/:username`, including the locked-account model (private profiles render a stub for non-followers), per-route visibility (`public` / `unlisted` / `private`) and the social-share metadata (Open Graph) that public pages emit. The drilldown collection routes (`/users/:username/followers` and `/users/:username/following`) and the access rule that gates them live in `social-follows` — this spec links to them but does not duplicate the rule.

## Requirements
### Requirement: Public profile page
The Journal SHALL serve a profile page at `/users/:username` for any user who exists. The render SHALL depend on the viewer relationship to the profile owner:
- If the username does not exist, return HTTP 404.
- If the owner's `profile_visibility = 'public'`, render the full profile (display name, handle, follower/following counts, public routes, public activities) regardless of who is viewing.
- If the owner's `profile_visibility = 'private'`, render a stub page (header + handle + counts + lock badge) for non-owner viewers who do NOT have an accepted follow relation. Render the full profile for the owner themselves and for accepted followers.

The page SHALL display follower and following counts (always, regardless of stub vs. full). The counts SHALL link into `/users/:username/followers` and `/users/:username/following` only when the viewer is permitted to see the underlying lists (per `social-follows`); otherwise they render as plain text. For signed-in viewers other than the owner, the page SHALL render a Follow button whose label depends on the relation: "Follow" against a public profile with no relation, "Request to follow" against a private profile with no relation, "Requested" (cancellable) when a Pending request exists, "Unfollow" when an accepted relation exists.

#### Scenario: Logged-out visitor views a public profile
- **WHEN** an unauthenticated visitor navigates to `/users/:username` for a user whose `profile_visibility` is `public`
- **THEN** the page renders the full profile (display name, handle, counts, public routes, public activities)

#### Scenario: Logged-out visitor views a private profile
- **WHEN** an unauthenticated visitor navigates to `/users/:username` for a user whose `profile_visibility` is `private`
- **THEN** the page returns HTTP 200 and renders the stub layout — header with display name, handle, and counts; a 🔒 "Private" badge; a body block with "This profile is private" and a sign-in prompt; no routes or activities are rendered

#### Scenario: Signed-in visitor views a private profile they don't follow
- **WHEN** a signed-in user other than the owner navigates to `/users/:username` for a private profile, with no follow row OR a Pending follow row
- **THEN** the page returns 200 and renders the stub layout, plus a Follow button (or Pending indicator) so the viewer can request access

#### Scenario: Signed-in viewer with accepted follow sees full private profile
- **WHEN** a signed-in user with an accepted follow against a private user navigates to that user's profile
- **THEN** the page returns 200 and renders the full profile — same as a public profile would render — plus an Unfollow button

#### Scenario: Owner sees their own profile
- **WHEN** a user navigates to their own `/users/:username` while logged in
- **THEN** the full profile renders regardless of `profile_visibility`, plus a small owner-only banner (blue "ownNote" for public profiles, amber "private/locked" explanation for private profiles), plus a link to settings; no Follow button is shown

#### Scenario: Profile 404 only for nonexistent users
- **WHEN** a visitor navigates to `/users/:username` for a username that does not exist
- **THEN** the server responds with HTTP 404

#### Scenario: Profile page emits social-share metadata
- **WHEN** any visitor loads a populated `/users/:username` (full or stub)
- **THEN** the page emits Open Graph tags (`og:title`, `og:site_name`, `og:type="profile"`) so links shared on social platforms render a meaningful preview

#### Scenario: Counts degrade to plain text for viewers who can't see the lists
- **WHEN** a viewer who is not permitted to see the followers/following lists per `social-follows` (e.g. an anonymous visitor or non-follower of a private profile) loads any profile page
- **THEN** the follower and following counts render as plain text rather than as anchors, so the visible count doesn't surface a clickable link to a route that would 404

### Requirement: Profile visibility setting (locked accounts)
Every user SHALL have an explicit `profile_visibility` of `public` or `private`. New accounts SHALL default to `private` (locked: profile is reachable but content is gated behind follow approval). Users SHALL be able to change their profile visibility from account settings at any time. `private` is functionally Mastodon's "locked" / "manually approves followers" — visitors see a stub with a Request-to-follow button, follows land in a Pending state, and content is only revealed to accepted followers.

#### Scenario: Default for a new account
- **WHEN** a user registers
- **THEN** their `profile_visibility` is `private`

#### Scenario: Existing user backfilled to public
- **WHEN** the migration that introduces `profile_visibility` runs against pre-existing rows
- **THEN** every existing user's `profile_visibility` is set to `public`, preserving current effective behavior (no surprise lock-down at deploy)

#### Scenario: User toggles profile to private
- **WHEN** a user changes their profile visibility to `private` in settings and saves
- **THEN** subsequent visitor requests to `/users/:username` return HTTP 200 but render a stub page (header + Request-to-follow button) with no content; existing follow rows are unaffected; new follows from anyone other than already-accepted followers are recorded as Pending

#### Scenario: User toggles profile back to public
- **WHEN** a previously-private user switches `profile_visibility` to `public` and saves
- **THEN** their `/users/:username` renders the full profile to anyone again, and any incoming follows auto-accept going forward

