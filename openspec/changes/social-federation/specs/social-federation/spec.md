## ADDED Requirements

### Requirement: Per-user actor objects with WebFinger discovery
The Journal SHALL serve an ActivityPub `Person` actor object at the user's canonical URL for any user with `profile_visibility = 'public'`, and SHALL serve a WebFinger endpoint at `/.well-known/webfinger` resolving `acct:user@domain` to that actor IRI.

#### Scenario: Public user has a discoverable actor
- **WHEN** a remote client GETs `/.well-known/webfinger?resource=acct:bruno@trails.cool`
- **THEN** the response is a JRD object with a `links` array including `rel="self"` pointing at `https://trails.cool/users/bruno` (the actor IRI)

#### Scenario: Public user actor object resolves
- **WHEN** a remote client GETs `https://{DOMAIN}/users/bruno` with `Accept: application/activity+json`
- **THEN** the response is a `Person` actor object including the user's display name, public key, inbox IRI, outbox IRI, and `software` field identifying the instance as trails.cool

#### Scenario: Private user is invisible to federation
- **WHEN** any federation request resolves a user whose `profile_visibility = 'private'` — WebFinger lookup, actor IRI fetch, or follow attempt
- **THEN** every endpoint returns HTTP 404 with no leak of user existence

### Requirement: Per-user signing keypairs
Every local user SHALL have an asymmetric keypair (RSA 2048 or Ed25519). The public key SHALL be embedded in the actor object. The private key SHALL be encrypted at rest using a server-managed encryption key. New users SHALL get keys at registration; existing users SHALL be backfilled at deploy.

#### Scenario: Outgoing activity is signed with the user's key
- **WHEN** a local user originates a federation activity (Follow, Accept, Create, etc) that is delivered to a remote inbox
- **THEN** the HTTP request carries an HTTP Signature header signed with that user's private key, identifying the user's `keyId` so the remote can verify

#### Scenario: Existing-user backfill at deploy
- **WHEN** the federation feature flag is first enabled on an instance with pre-existing users
- **THEN** a one-shot job generates keypairs for every user lacking one before any federation traffic is permitted

### Requirement: Narrow inbox — follow-graph activities only
The user inbox at `https://{DOMAIN}/users/:username/inbox` SHALL accept and process only `Follow`, `Undo(Follow)`, `Accept(Follow)`, and `Reject(Follow)` activities. Any other activity type SHALL be acknowledged with HTTP 202 and dropped without processing.

#### Scenario: Inbound Follow auto-accepts for public users
- **WHEN** a signed `Follow` from a remote actor targets a local user with `profile_visibility = 'public'`
- **THEN** the inbox records the follow row with the remote actor as follower, delivers `Accept(Follow)` back, and returns HTTP 202

#### Scenario: Inbound Create is dropped silently
- **WHEN** a signed `Create(Note)` is POSTed to a local user's inbox
- **THEN** the response is HTTP 202 but no row is created in `activities`, no row in `follows`; the activity is logged at debug level and discarded

#### Scenario: Inbound Follow to a private user is rejected
- **WHEN** a `Follow` targets a local user whose `profile_visibility = 'private'`
- **THEN** the inbox returns HTTP 404 (matching the actor's own 404) and no row is created

#### Scenario: Replay-protected
- **WHEN** the same signed activity is delivered twice within the signature's validity window
- **THEN** the second delivery is dropped (idempotent on activity IRI) and returns HTTP 202

### Requirement: Outbox publishes user's public activities
The Journal SHALL serve a paginated outbox at `https://{DOMAIN}/users/:username/outbox` for any user with `profile_visibility = 'public'`, listing the user's `public` activities as `Create(Note)` activities (or a documented AS extension type).

#### Scenario: Outbox lists public activities
- **WHEN** a remote client GETs an outbox URL with a valid HTTP Signature
- **THEN** the response is an `OrderedCollection` (or paginated collection page) of the user's `public` activities, most recent first

#### Scenario: Outbox excludes private and unlisted
- **WHEN** the outbox is fetched
- **THEN** the response includes only activities with `visibility = 'public'`; `unlisted` and `private` activities never appear

### Requirement: Push delivery on local activity create
The Journal SHALL deliver a `Create(Note)` activity to every accepted remote follower's inbox when a local user with `profile_visibility = 'public'` creates a new `public` activity.

#### Scenario: New public activity fans out
- **WHEN** a local user with N accepted remote followers creates a new public activity
- **THEN** N delivery jobs are enqueued (one per follower's inbox), each retrying with exponential backoff on 5xx, giving up after a documented retry budget

#### Scenario: Rate-limited per remote host
- **WHEN** multiple deliveries target the same remote host
- **THEN** they are rate-limited so we never exceed 1 request per second per remote host (configurable; chosen for safety, not throughput)

### Requirement: Outbound follows restricted to other trails instances
The Journal SHALL accept outbound follow requests against remote actor IRIs only when the target host self-identifies as a trails.cool instance. Follows targeting Mastodon, Pleroma, or other non-trails ActivityPub servers SHALL be refused at the API layer with a clear error and a link to the documented v1 limitation.

#### Scenario: Follow another trails instance
- **WHEN** a local user follows `@alice@other-trails.example` and the remote actor's `software` field declares `trails.cool`
- **THEN** the follow row is created with `accepted_at = NULL` (Pending), a signed `Follow` is delivered to the remote inbox, and the button shows Pending

#### Scenario: Refuse to follow a Mastodon user
- **WHEN** a local user attempts to follow `@alice@mastodon.social`
- **THEN** the API returns 4xx with an error message explaining "outbound federation to non-trails instances isn't supported yet" and links to the project documentation

### Requirement: Outbox-poll ingestion of remote trails activities
The Journal SHALL periodically GET the outbox of every remote trails actor that at least one local user follows with `accepted_at IS NOT NULL`, store new activities locally for feed display, and rate-limit fetches per remote host.

#### Scenario: Poll cadence and scope
- **WHEN** the scheduled outbox-poll job runs
- **THEN** it fetches at most the 50 most recent items per remote actor, stores any new rows tagged with their audience, and skips actors polled within the last hour

#### Scenario: Polls are signed
- **WHEN** the poller fetches a remote outbox
- **THEN** the GET request carries an HTTP Signature using the actor key of one of the local users who follow the remote actor

#### Scenario: First poll triggered immediately on accepted follow
- **WHEN** a follow row transitions to `accepted_at IS NOT NULL`
- **THEN** an immediate one-off outbox-poll is enqueued for that specific actor

#### Scenario: Respect remote rate limiting
- **WHEN** a remote instance returns `429` or `Retry-After`
- **THEN** the poller backs off the entire host (not just the actor) for the indicated duration

### Requirement: Audience-aware feed filtering
Activities cached from remote trails actors SHALL be tagged with their audience (`public` or `followers-only`). The social feed query SHALL return `followers-only` activities only to the specific local user who holds an accepted follow against the originating remote actor.

#### Scenario: Followers-only remote content reaches only the right viewer
- **WHEN** a remote actor publishes a followers-only activity, two local users A and B both have rows in the activity cache for that actor, but only A holds an accepted follow against the actor
- **THEN** A sees the activity in `/feed` and B does not, even though the row exists in our database
