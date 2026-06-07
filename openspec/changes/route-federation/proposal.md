## Why

`social-federation` delivers the *social* half of the federation pitch:
activities federate as `Create(Note)`, Mastodon users can follow trails
users, trails users will follow each other across instances (§6/§7).
The *collaboration* half of the architecture vision — routes as
first-class federated objects — is still aspirational: `Create/Update
Route` activities, cross-instance route sharing with Invite/Accept
mirroring, and cross-instance Planner edits saved back to the owner's
instance (architecture.md Resolved Decisions #2, #3, #12, #16 and Data
Flow Scenarios 3 & 4).

This is the differentiator. Activity federation makes trails.cool a
Mastodon-compatible publisher; route federation makes it the thing the
architecture promises: collaborative route planning across self-hosted
instances, with the owner's instance as the single source of truth.

## What Changes

- **Routes federate as objects**: a public route is dereferenceable at
  its canonical URL as an ActivityPub object (custom `trails:Route`
  type carrying the JSON-LD metadata envelope + GPX attachment;
  Mastodon-facing fallback rendering deferred — routes federate
  trails-to-trails only). `Create`/`Update` activities fan out to
  followers and collaborators on publish and on new versions.
- **Cross-instance sharing via Invite/Accept**: sharing a route with a
  remote trails user sends an `Invite`; their `Accept` registers them
  as collaborator on the owner's instance and creates a **mirror** (a
  read cache: metadata + latest GPX) on theirs. Route `Update`s push
  new versions to all collaborator mirrors.
- **Cross-instance edits**: a collaborator's instance requests a
  **scoped edit token** from the owner's instance (HTTP-Signature
  authenticated instance-to-instance request). The Planner session
  opens with the owner's callback URL + that token; saves create new
  versions directly on the owner's instance, crediting the
  collaborator as contributor (the existing JWT callback machinery,
  issued across instances).
- **Mirror healing**: a periodic sync check detects mirrors that
  missed `Update`s (instance down > Fedify's retry budget) and
  re-fetches the canonical object.
- **Trails-to-trails only**, enforced with the same NodeInfo
  `software.name` check as outbound follows. Mastodon never sees
  `trails:Route` objects (they're not Notes and aren't delivered to
  non-trails inboxes).

## Capabilities

### New Capabilities

- `route-federation`: Route objects over ActivityPub — dereferenceable
  routes, Create/Update fan-out, Invite/Accept collaboration
  mirroring, cross-instance scoped edit tokens, mirror sync healing.

### Modified Capabilities

- `social-federation`: outbox/delivery extended beyond `Create(Note)`
  with the route activity vocabulary; inbox accepts
  `Invite`/`Accept(Invite)`/`Update(Route)` from trails instances.
- `route-management`: routes gain remote provenance (mirrors) and
  remote collaborators; version creation accepts cross-instance
  contributors.
- `route-sharing`: the share dialog can target remote trails handles
  (`@bob@bob.trails.xyz`), entering the Invite lifecycle instead of a
  local share row.
- `planner-callback`: callback tokens verifiable when issued by THIS
  instance to a session initiated from a REMOTE instance, and the
  edit-in-planner flow can carry a remote owner's callback.

## Impact

- **Dependencies**: requires `social-federation` §6 (outbound
  trails-to-trails follows + NodeInfo check) and `route-sharing`
  (local share model the Invite extends). Build after both.
- **Schema**: `route_mirrors` (or `routes.remote_origin_iri` +
  provenance columns mirroring the activities approach),
  `route_collaborators` extension for remote actor IRIs (the
  exactly-one-of local/remote pattern from `follows`), token-issuance
  audit table.
- **Federation surface**: new inbound activity types (gated to
  verified trails instances), instance-to-instance token endpoint —
  security-review before exposure; privacy manifest update (what a
  collaborator instance learns and stores).
- **Out of scope**: rendering trails Route objects on Mastodon;
  federated forking (fork-from-mirror can be a follow-up); real-time
  *federated* presence in Planner sessions (sessions remain on one
  Planner instance — federation is about where the route lives, not
  where the session runs).
