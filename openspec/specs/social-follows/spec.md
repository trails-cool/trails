# social-follows Specification

## Purpose
TBD - created by archiving change social-feed. Update Purpose after archive.
## Requirements
### Requirement: Follow another user
A signed-in user SHALL be able to follow another local user from a profile page. Public targets auto-accept (`accepted_at = now()`); private (locked) targets land in a Pending state (`accepted_at = NULL`) until the target approves the request from `/follows/requests`. Following remote ActivityPub actors is out of scope here and tracked in the `social-federation` change.

#### Scenario: Follow a local public profile
- **WHEN** a signed-in user clicks "Follow" on a local user with `profile_visibility = 'public'`
- **THEN** a follow row is recorded with `accepted_at = now()`, the button becomes "Unfollow", and the target's follower count increments

#### Scenario: Follow a local private (locked) profile
- **WHEN** a signed-in user clicks "Request to follow" on a local user with `profile_visibility = 'private'`
- **THEN** a follow row is recorded with `accepted_at = NULL`, the button becomes "Requested" (cancellable), the request appears in the target's `/follows/requests` page, and the target's follower count does NOT increment

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
Every local user SHALL expose follower and following counts on their profile and paginated collection pages, listing only **accepted** relations. Pending requests do not count toward the public tallies.

#### Scenario: Follower count on profile
- **WHEN** any visitor loads a profile (public or private stub)
- **THEN** the page displays the follower and following counts of accepted relations, linking to paginated `/users/:username/followers` and `/users/:username/following` pages

#### Scenario: Collection pagination
- **WHEN** a visitor loads `/users/:username/followers` or `/users/:username/following`
- **THEN** the page lists the accepted relations in reverse-chronological order of acceptance, 50 per page

### Requirement: Pending follow request management
A signed-in user SHALL have a dedicated `/follows/requests` page listing every Pending follow request targeting them (where `followed_user_id = currentUser.id` AND `accepted_at IS NULL`). The page SHALL provide Approve and Reject actions for each request. The navbar SHALL surface a count badge linking to this page when at least one request is pending.

#### Scenario: Owner sees their pending requests
- **WHEN** a signed-in user with N Pending incoming requests loads `/follows/requests`
- **THEN** the page lists all N requests reverse-chronologically by request creation time, with Approve and Reject buttons per request

#### Scenario: Empty requests page
- **WHEN** a signed-in user with zero pending requests loads `/follows/requests`
- **THEN** the page renders an empty-state message

#### Scenario: Anonymous visitor cannot access requests page
- **WHEN** an unauthenticated visitor requests `/follows/requests`
- **THEN** they are redirected to `/auth/login`

#### Scenario: Navbar badge reflects pending count
- **WHEN** a signed-in user has N > 0 pending follow requests
- **THEN** the "Follow requests" link in the navbar renders with a small red count badge of N; when N = 0 the link still renders but without a badge

### Requirement: Social activity feed
The Journal SHALL expose a feed at `/feed`, visible only to signed-in users, listing public activities from the local users they follow with an accepted relation. `private` and `unlisted` activities SHALL NOT appear regardless of follow state. Pending follows SHALL NOT contribute content to the feed.

#### Scenario: Feed aggregates accepted-followed users' public activities
- **WHEN** a signed-in user with one or more accepted follows loads `/feed`
- **THEN** the page shows the most recent public activities across all accepted-followed users, reverse-chronological, up to 50 per page, with owner attribution, distance, date, and a map thumbnail

#### Scenario: Pending follows don't contribute to the feed
- **WHEN** a signed-in user has only Pending follows (no acceptance yet)
- **THEN** the feed renders the empty state — no Pending-target content is fetched or shown

#### Scenario: Empty feed state
- **WHEN** a signed-in user with zero accepted follows loads `/feed`
- **THEN** the page shows an empty-state message pointing them to `/users/:username` pages to follow someone, and suggests the instance public feed as an alternative

#### Scenario: Logged-out visitor cannot access the feed
- **WHEN** an unauthenticated visitor requests `/feed`
- **THEN** they are redirected to `/auth/login`

### Requirement: Schema is forward-compatible with federation
The `follows` table SHALL key the followed side by an `actor_iri TEXT` column (not a plain user FK), so the `social-federation` change can store remote IRIs in the same column without migration. Local follows SHALL populate `actor_iri` with the local user's canonical actor IRI (`https://{DOMAIN}/users/{username}`).

#### Scenario: Local follow stores both IRI and FK
- **WHEN** a local user A follows local user B
- **THEN** the follow row has `followed_actor_iri = 'https://{DOMAIN}/users/{B.username}'` AND `followed_user_id = B.id`

#### Scenario: Lifecycle column already supports Pending
- **WHEN** any local follow row is created against a private target in this change
- **THEN** `accepted_at` is set to `NULL`; against a public target it is set to `now()`. Federation's remote-Pending state lands here without schema change

