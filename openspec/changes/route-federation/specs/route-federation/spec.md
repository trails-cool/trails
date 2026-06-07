## ADDED Requirements

### Requirement: Public routes are dereferenceable ActivityPub objects
The Journal SHALL serve a public route at its canonical URL as a
`trails:Route` object (JSON-LD metadata envelope + GPX attachment) when
requested with an ActivityPub Accept header, and SHALL announce new
public routes and new versions to followers and collaborators as
`Create`/`Update` activities. Non-public routes SHALL NOT be
dereferenceable or announced.

#### Scenario: Route object resolves
- **WHEN** a trails instance GETs a public route's canonical URL with `Accept: application/activity+json`
- **THEN** the response is a `trails:Route` object containing the metadata envelope (distance, elevation, day breaks, routing profile, contributors) and a GPX `Document` attachment

#### Scenario: New version fans out
- **WHEN** a new version of a shared public route is created
- **THEN** an `Update` activity carrying the new version is delivered to every collaborator instance's inbox

### Requirement: Cross-instance sharing via Invite/Accept mirroring
Sharing a route with a user on another trails instance SHALL send an
ActivityPub `Invite`; the remote user's `Accept` SHALL register them as
collaborator on the owner's instance and establish a mirror (metadata +
latest GPX, no version history) on theirs, kept current by `Update`
fan-out. The owner's instance SHALL remain the canonical source.

#### Scenario: Invite accepted creates a mirror
- **WHEN** Alice (instance A) shares a route with `@bob@b.example` and Bob accepts
- **THEN** A records Bob as collaborator, sends the current route, and B stores a mirror visible in Bob's collection attributed to A

#### Scenario: Invite to a non-trails instance is refused
- **WHEN** a share targets a handle whose instance does not pass the trails-instance check
- **THEN** the share is refused at the API layer with a clear "route federation is trails-to-trails only" error

### Requirement: Cross-instance edits store to the owner via scoped tokens
A collaborator's instance SHALL obtain a scoped, single-use edit token
from the owner's instance via an HTTP-Signature-authenticated request,
SHALL be refused when the requester is not an accepted collaborator,
and the resulting Planner session SHALL save new versions directly to
the owner's instance with the collaborator credited as contributor by
actor IRI.

#### Scenario: Collaborator edits across instances
- **WHEN** Bob starts an edit session on his mirror of Alice's route
- **THEN** B obtains a token from A, the Planner opens with A's callback, and Bob's save creates the next sequential version on A crediting Bob's actor IRI

#### Scenario: Non-collaborator cannot obtain a token
- **WHEN** an instance requests an edit token for an actor who is not an accepted collaborator
- **THEN** the owner's instance refuses with 403 and records the attempt

### Requirement: Mirror sync healing
Each instance holding mirrors SHALL periodically verify them against
the canonical object and re-fetch when stale, and SHALL visibly mark a
mirror whose origin has been unreachable past the verification window.

#### Scenario: Missed update is healed
- **WHEN** instance B was offline long enough to miss an `Update` and its retry window
- **THEN** B's next sync check detects the version gap and re-fetches the canonical route from A
