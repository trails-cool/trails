# social-follows Specification

## Purpose
Local social follow relationships between Journal users — the follow API, follower/following collections (with locked-account access rules), the Pending request lifecycle for private profiles, and the activity feed driven by accepted follows. The actionable inbox for incoming Pending requests lives as the Requests tab on `/notifications` (see `notifications` spec); this spec covers the lifecycle and the data model behind it. Federation of follows across instances is out of scope here and lives in `social-federation`.
## Requirements
### Requirement: Follow another user
A signed-in user SHALL be able to follow another local user from a profile page. Public targets auto-accept (`accepted_at = now()`); private (locked) targets land in a Pending state (`accepted_at = NULL`) until the target approves the request from the Requests tab on `/notifications`. Following remote ActivityPub actors is out of scope here and tracked in the `social-federation` change.

#### Scenario: Follow a local public profile
- **WHEN** a signed-in user clicks "Follow" on a local user with `profile_visibility = 'public'`
- **THEN** a follow row is recorded with `accepted_at = now()`, the button becomes "Unfollow", and the target's follower count increments

#### Scenario: Follow a local private (locked) profile
- **WHEN** a signed-in user clicks "Request to follow" on a local user with `profile_visibility = 'private'`
- **THEN** a follow row is recorded with `accepted_at = NULL`, the button becomes "Requested" (cancellable), the request appears in the target's Requests tab on `/notifications` (`/notifications?tab=requests`), and the target's follower count does NOT increment

#### Scenario: Cannot follow yourself
- **WHEN** a signed-in user attempts to follow their own profile
- **THEN** the follow API returns an error (4xx) and no follow row is created

#### Scenario: Unfollow (or cancel a Pending request)
- **WHEN** the follower clicks "Unfollow" or "Requested" on a profile they currently have a follow row against
- **THEN** the follow row is deleted regardless of state; the target's follower count decrements only if the row had been accepted

#### Scenario: Owner approves a Pending request
- **WHEN** a private user POSTs to `/api/follows/:id/approve` for a Pending row targeting them
- **THEN** the row's `accepted_at` is set to `now()`, the requester transitions from "Requested" to "Unfollow" view, and the target's follower count increments

#### Scenario: Owner rejects a Pending request
- **WHEN** a private user POSTs to `/api/follows/:id/reject` for a Pending row targeting them
- **THEN** the row is deleted; the requester sees the "Request to follow" state again and can re-request later

#### Scenario: Approve/reject is owner-bound
- **WHEN** any user other than the followed party POSTs `/api/follows/:id/approve` or `/reject`
- **THEN** the API returns 404 (no leak of who the row targets) and the row state is unchanged

### Requirement: Follower and following collections
Every local user SHALL expose follower and following counts on their profile and paginated collection pages, listing only **accepted** relations. Pending requests do not count toward the public tallies. The collection pages themselves SHALL be access-gated under the locked-account model: only the owner, accepted followers, and viewers of public profiles can drill into the list. Counts remain visible to everyone (Mastodon-equivalent surface), but the underlying list of usernames is gated.

#### Scenario: Follower count on profile (always visible)
- **WHEN** any visitor loads a profile (public or private stub)
- **THEN** the page displays the follower and following counts of accepted relations
- **AND** the counts link to the paginated `/users/:username/followers` and `/users/:username/following` pages when the viewer is permitted to see the lists; otherwise the counts render as plain text without links

#### Scenario: Owner sees their own list
- **WHEN** the profile owner loads `/users/:username/followers` or `/users/:username/following` for their own username
- **THEN** the page renders the list regardless of their `profile_visibility` setting

#### Scenario: Public profile list is reachable by anyone
- **WHEN** any visitor (anonymous or signed-in) loads `/users/:username/followers` or `/users/:username/following` for a user with `profile_visibility = 'public'`
- **THEN** the page renders the list

#### Scenario: Private profile list visible to accepted followers
- **WHEN** a signed-in user with an accepted follow relation against a private user loads that user's `/followers` or `/following` page
- **THEN** the page renders the list

#### Scenario: Private profile list is 404 for non-followers
- **WHEN** a visitor (anonymous, or signed-in but with no follow row, or with a Pending follow row) loads `/users/:username/followers` or `/users/:username/following` for a private user
- **THEN** the server responds with HTTP 404 — the same opaque response a stranger would see, with no leak of the user's existence beyond what the profile route already exposes

#### Scenario: Collection pagination
- **WHEN** a visitor permitted to see the list loads `/users/:username/followers` or `/users/:username/following`
- **THEN** the page lists the accepted relations in reverse-chronological order of acceptance, 50 per page

### Requirement: Pending follow request management
A signed-in user SHALL have an actionable surface listing every Pending follow request targeting them (where `followed_user_id = currentUser.id` AND `accepted_at IS NULL`), with Approve and Reject buttons per row. This surface lives as the Requests tab on `/notifications` (see `notifications` spec for the page-level behavior, including the tabbed layout and the per-tab pending-count indicator). The standalone `/follows/requests` URL is preserved as a 301 redirect to the new location so deep-links from prior notifications, emails, and bookmarks still resolve.

#### Scenario: Owner sees their pending requests
- **WHEN** a signed-in user with N Pending incoming requests loads `/notifications?tab=requests`
- **THEN** the page lists all N requests reverse-chronologically by request creation time, with Approve and Reject buttons per request

#### Scenario: Empty requests tab
- **WHEN** a signed-in user with zero pending requests loads `/notifications?tab=requests`
- **THEN** the tab renders an empty-state message

#### Scenario: Legacy URL redirects to the Requests tab
- **WHEN** any visitor requests `/follows/requests`
- **THEN** the server responds with HTTP 301 to `/notifications?tab=requests`

#### Scenario: Anonymous visitor cannot reach the Requests tab
- **WHEN** an unauthenticated visitor requests `/notifications?tab=requests` (or `/follows/requests`, which redirects there)
- **THEN** they are redirected to `/auth/login`

### Requirement: Social activity feed
The Journal SHALL expose a feed at `/feed`, visible only to signed-in users, with two views selectable via `?view=`: **Followed** (default; public activities from the local users they follow with an accepted relation) and **Public** (instance-wide public activities — see `activity-feed` spec, "Instance-wide public activity feed"). The page SHALL render a tab/toggle at the top so the viewer can switch between the two views. `private` and `unlisted` activities SHALL NOT appear in either view. Pending follows SHALL NOT contribute content to the Followed view.

#### Scenario: Followed view aggregates accepted-followed users' public activities
- **WHEN** a signed-in user with one or more accepted follows loads `/feed` (or `/feed?view=followed`)
- **THEN** the Followed view is selected and shows the most recent public activities across all accepted-followed users, reverse-chronological, up to 50 per page, with owner attribution, distance, date, and a map thumbnail

#### Scenario: Public view aggregates instance-wide public activities
- **WHEN** a signed-in user loads `/feed?view=public`
- **THEN** the Public view is selected and shows the most recent public activities across the entire instance, reverse-chronological, up to 50 per page, regardless of follow state

#### Scenario: Pending follows don't contribute to the Followed view
- **WHEN** a signed-in user has only Pending follows (no acceptance yet) and loads the Followed view
- **THEN** the view renders the empty state — no Pending-target content is fetched or shown

#### Scenario: Empty Followed view links to the Public view
- **WHEN** a signed-in user with zero accepted follows loads `/feed`
- **THEN** the Followed view shows an empty-state message and an in-page link to switch to the Public view (`?view=public`), so they can browse the instance without leaving `/feed`

#### Scenario: Empty Public view
- **WHEN** the instance has zero public activities and a signed-in user loads `/feed?view=public`
- **THEN** the Public view shows an empty-state message; no link to elsewhere is required

#### Scenario: Unrecognized view value falls back to Followed
- **WHEN** a signed-in user loads `/feed?view=<anything-other-than-public>`
- **THEN** the loader treats the request as the Followed view (default) without raising an error — the parameter is opaque from the client's perspective

#### Scenario: Logged-out visitor cannot access the feed
- **WHEN** an unauthenticated visitor requests `/feed` (any view)
- **THEN** they are redirected to `/auth/login`

### Requirement: Schema is forward-compatible with federation
The `follows` table SHALL key the followed side by an `actor_iri TEXT` column (not a plain user FK), so the `social-federation` change can store remote IRIs in the same column without migration. Local follows SHALL populate `actor_iri` with the local user's canonical actor IRI (`https://{DOMAIN}/users/{username}`).

#### Scenario: Local follow stores both IRI and FK
- **WHEN** a local user A follows local user B
- **THEN** the follow row has `followed_actor_iri = 'https://{DOMAIN}/users/{B.username}'` AND `followed_user_id = B.id`

#### Scenario: Lifecycle column already supports Pending
- **WHEN** any local follow row is created against a private target in this change
- **THEN** `accepted_at` is set to `NULL`; against a public target it is set to `now()`. Federation's remote-Pending state lands here without schema change


### Requirement: Follow lifecycle emits notifications
The follow lifecycle SHALL produce notifications for the recipient of the social event (see `notifications` spec for the row shape):

- Auto-accepted public follow → `follow_received` to the followed user.
- Pending follow against a private profile → `follow_request_received` to the followed user.
- Approved Pending request → `follow_request_approved` to the follower (now accepted).
- Reject and unfollow do NOT produce notifications.

#### Scenario: Public auto-accept notifies the target
- **WHEN** a user follows another user whose `profile_visibility = 'public'` (auto-accept path)
- **THEN** a `follow_received` notification is created for the followed user

#### Scenario: Pending request notifies the target
- **WHEN** a user requests to follow another user whose `profile_visibility = 'private'`
- **THEN** a `follow_request_received` notification is created for the followed user (the historical record persists even if the request is later rejected or canceled)

#### Scenario: Approval notifies the requester
- **WHEN** a private user approves a Pending follow request
- **THEN** a `follow_request_approved` notification is created for the follower

#### Scenario: Reject does not notify
- **WHEN** a private user rejects a Pending follow request
- **THEN** no notification is created (silent rejection — the follower can re-request later if they want)

#### Scenario: Unfollow does not notify
- **WHEN** a follower unfollows or cancels a Pending request
- **THEN** no notification is created on the followed side
