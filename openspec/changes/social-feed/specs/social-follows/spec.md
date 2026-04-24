## ADDED Requirements

### Requirement: Follow another user
A signed-in user SHALL be able to follow another local user from a profile page. Local users with `profile_visibility = 'public'` auto-accept the follow. Local users with `profile_visibility = 'private'` SHALL NOT be followable. Following remote ActivityPub actors is out of scope and tracked in the `social-federation` change.

#### Scenario: Follow a local public profile
- **WHEN** a signed-in user clicks "Follow" on a local user with `profile_visibility = 'public'`
- **THEN** a follow row is recorded with `accepted_at = now()`, the button becomes "Unfollow", and the target's follower count increments

#### Scenario: Cannot follow a private profile
- **WHEN** a signed-in user attempts to follow a local user with `profile_visibility = 'private'`
- **THEN** the follow API returns an error (4xx) and no follow row is created

#### Scenario: Cannot follow yourself
- **WHEN** a signed-in user attempts to follow their own profile
- **THEN** the follow API returns an error (4xx) and no follow row is created

#### Scenario: Unfollow
- **WHEN** the follower clicks "Unfollow" on a profile they already follow
- **THEN** the follow row is deleted and the target's follower count decrements

### Requirement: Follower and following collections
Every local user with `profile_visibility = 'public'` SHALL expose a publicly queryable list of followers and a list of who they follow.

#### Scenario: Follower count on profile
- **WHEN** any visitor loads a public profile
- **THEN** the page displays the follower and following counts, linking to paginated `/users/:username/followers` and `/users/:username/following` pages

#### Scenario: Collection pagination
- **WHEN** a visitor loads `/users/:username/followers` or `/users/:username/following`
- **THEN** the page lists the relations in reverse-chronological order of acceptance, 50 per page

### Requirement: Social activity feed
The Journal SHALL expose a feed at `/feed`, visible only to signed-in users, listing public activities from the local users they follow. `private` and `unlisted` activities SHALL NOT appear in this feed even if the viewer follows the owner.

#### Scenario: Feed aggregates followed users' public activities
- **WHEN** a signed-in user with one or more follows loads `/feed`
- **THEN** the page shows the most recent public activities across all users they follow, reverse-chronological, up to 50 per page, with owner attribution, distance, date, and a map thumbnail

#### Scenario: Empty feed state
- **WHEN** a signed-in user with zero follows loads `/feed`
- **THEN** the page shows an empty-state message pointing them to `/users/:username` pages to follow someone, and suggests the instance public feed as an alternative

#### Scenario: Logged-out visitor cannot access the feed
- **WHEN** an unauthenticated visitor requests `/feed`
- **THEN** they are redirected to `/auth/login`

### Requirement: Schema is forward-compatible with federation
The `follows` table SHALL key the followed side by an `actor_iri TEXT` column (not a plain user FK), so the `social-federation` change can store remote IRIs in the same column without migration. Local follows SHALL populate `actor_iri` with the local user's canonical actor IRI (`https://{DOMAIN}/users/{username}`).

#### Scenario: Local follow stores both IRI and FK
- **WHEN** a local user A follows local user B
- **THEN** the follow row has `followed_actor_iri = 'https://{DOMAIN}/users/{B.username}'` AND `followed_user_id = B.id`

#### Scenario: Lifecycle column ready for Pending state
- **WHEN** any local follow row is created in this change
- **THEN** `accepted_at` is set to `now()` (auto-accepted), but the column remains nullable so future remote follows can land in a Pending state without schema change
