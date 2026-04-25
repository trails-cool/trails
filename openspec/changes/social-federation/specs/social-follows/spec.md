## ADDED Requirements

### Requirement: Pending lifecycle for outbound trails-to-trails follows
A follow row originated from a local user against a remote *trails* actor SHALL be created with `accepted_at = NULL` (Pending) until the remote's `Accept(Follow)` activity arrives at our inbox. The local user SHALL see the Pending state on the profile page and SHALL be able to cancel a Pending request, which deletes the row and delivers `Undo(Follow)` to the remote inbox.

#### Scenario: Outbound follow enters Pending
- **WHEN** a local user follows `@alice@other-trails.example`
- **THEN** the follow row is created with `accepted_at = NULL`, a signed `Follow` is delivered to the remote inbox, and the profile button shows Pending

#### Scenario: Pending → Accepted
- **WHEN** the remote inbox returns `Accept(Follow)` for our outgoing Follow
- **THEN** `accepted_at` is set to `now()`, an immediate one-off outbox-poll is enqueued for that actor, and the profile button transitions to Unfollow

#### Scenario: Pending → Rejected
- **WHEN** the remote inbox returns `Reject(Follow)` for our outgoing Follow
- **THEN** the follow row is deleted and a small UI notice is surfaced on the user's outgoing-follows list

#### Scenario: Cancel a Pending follow
- **WHEN** the follower cancels a Pending request from the outgoing-follows list
- **THEN** the follow row is deleted and an `Undo(Follow)` activity is delivered to the remote inbox

## MODIFIED Requirements

### Requirement: Social activity feed
The Journal SHALL expose a feed at `/feed`, visible only to signed-in users, listing activities from the users they follow with an accepted follow. The feed SHALL include `public` activities from any followed actor (local or remote) and SHALL include `followers-only` activities from a remote actor only for the specific local viewer who holds an accepted follow against that actor. `private` and (local) `unlisted` activities SHALL NOT appear regardless of follow state.

#### Scenario: Feed aggregates local + remote public activities
- **WHEN** a signed-in user with one or more accepted follows (mix of local + remote trails) loads `/feed`
- **THEN** the page shows the most recent public activities across all followed actors, reverse-chronological, up to 50 per page

#### Scenario: Followers-only remote content reaches only the right viewer
- **WHEN** two local users A and B exist; only A holds an accepted follow against remote actor X; X publishes a followers-only activity that lands in our cache via A's poll
- **THEN** A sees the activity in `/feed` and B does not

#### Scenario: Empty feed state
- **WHEN** a signed-in user with zero accepted follows loads `/feed`
- **THEN** the page shows an empty-state message pointing them to follow someone

#### Scenario: Pending follows do not contribute to the feed
- **WHEN** a signed-in user has only Pending outgoing follows
- **THEN** the feed renders the empty state; no remote content is fetched or shown for that follow until `Accept(Follow)` lands
