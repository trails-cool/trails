## Context

After `social-feed` lands, the Journal has follows + a `/feed` view + explicit `profile_visibility`, all local-only. The schema (`follows.followed_actor_iri`, `users.profile_visibility`) is already shaped for federation but no federation code exists.

This change adds ActivityPub. The asymmetric scope (inbound from anyone; outbound to trails-only) is a deliberate constraint to keep the parser surface small while still delivering the user-visible win of "Mastodon can follow me."

## Goals / Non-Goals

**Goals:**
- A Mastodon (or any AP-compatible) user can follow a trails.cool user and see their public activities in their home timeline.
- A trails.cool user can follow another trails.cool user on a different trails.cool instance, see their public activities in `/feed`, and unfollow cleanly.
- All federation traffic is HTTP-signed; signatures are verified on inbound; private keys are stored encrypted at rest.
- Private profiles do not federate at all — actor IRI 404s, no inbox accepts follows.
- Inbox is narrow: only `Follow`, `Undo(Follow)`, `Accept(Follow)`, `Reject(Follow)`. Everything else is rejected.

**Non-Goals:**
- Outbound follows of non-trails ActivityPub servers (Mastodon, Pleroma, Misskey, etc). Tracked as a later change.
- Inbound `Create`, `Like`, `Announce`, `Update`, `Delete` activities — anything other than the four follow-graph activities. We do not consume content via push.
- Content types beyond `Create(Note)` for outgoing. Replies, boosts, reactions: deferred.
- Locked local accounts (`locked-local-accounts`).
- Manually-driven federation (admin "broadcast" tools, federation-block lists, etc) — out of scope; can be added once basic federation works.

## Decisions

### Decision: Library — Fedify (assumed; revisit during implementation)

Pick **Fedify** as the ActivityPub library. It owns: actor objects, WebFinger, HTTP Signatures, inbox dispatch, outbox composition, document loader, key management primitives. Mature, TypeScript-native, used by other small fediverse projects.

**Why:** rolling our own AP wire layer is multiple weeks of careful spec-reading + testing. Fedify lets us own only the *trails-specific* parts (which activities to dispatch, how to map our `activities` table to AS objects, how to gate visibility).

**Risk:** if Fedify falls short on something specific (e.g., we want a custom outbox-pagination format that doesn't fit), we reach into its lower-level primitives or augment it. We don't fork.

**Alternative considered:** `activitypub-express` (Node middleware), or rolling our own. Both reject for time-to-ship reasons; revisit only if Fedify proves limiting.

### Decision: Identity model — actor IRI is `https://{DOMAIN}/users/:username`, content-negotiated

The same URL serves the human profile (HTML) and the actor object (`application/activity+json`). Mastodon does this; it keeps URLs canonical and shareable.

`/.well-known/webfinger?resource=acct:user@domain` returns the actor IRI in the standard JRD format.

### Decision: Per-user keypairs, encrypted at rest

Generate an RSA 2048 keypair per user at registration (or backfilled at deploy for existing users). Public key sits on the actor object, available to any inbound signature verifier. Private key encrypted with a server-side key (env var `FEDERATION_KEY_ENCRYPTION_KEY`, SOPS-managed) and stored on `users.private_key_encrypted`.

**Why per-user, not per-instance:** ActivityPub binds signatures to actor identity. Every `Follow` we emit is signed by the *user* who initiated it, not the instance. Per-user keys are required by the protocol and standard practice.

**Risk:** rotating an encryption key requires a backfill. Documented in the deployment runbook.

### Decision: Inbound — accept everyone; reject everything but follow-graph activities

Our inbox responds 202 Accepted to:
- `Follow` (from anywhere) → if our user is `profile_visibility = 'public'`, record the row, push back `Accept(Follow)`. Otherwise drop silently (the actor IRI 404s already so well-behaved remotes don't try).
- `Undo(Follow)` → delete the row.
- `Accept(Follow)` → settle our outgoing Pending row's `accepted_at`.
- `Reject(Follow)` → delete our outgoing Pending row.

Every other activity type returns 202 Accepted (per AP recommendation — never 4xx on inbound to avoid breaking remotes' delivery state) but is dropped without action.

**Why narrow inbox:** content via push is the lion's share of attack surface and complexity in fediverse software. Outbox polling for remote trails actors gives us content delivery without exposing our inbox to arbitrary `Create`s. We reconsider once we want to follow non-trails actors.

### Decision: Outbound — trails-to-trails only, gated at the API layer

Before allowing an outbound follow, verify the target IRI's host runs trails.cool. The check:
1. Resolve the target's actor object via WebFinger or direct IRI fetch.
2. Look at the actor's `software` field (a custom AS extension trails.cool will publish) or fall back to fetching `/.well-known/trails-cool` and confirming the response shape.
3. If neither matches: refuse the follow at the API layer with a clear UI error and link to docs explaining the current limitation.

**Why:** ingesting arbitrary Mastodon/Pleroma/Misskey activity shapes (Notes with attachments, polls, mentions, content warnings) is its own engineering project. Trails-to-trails means we control both shapes and can move fast on getting cross-instance trails.cool working without slipping into a generic-fediverse compatibility tar pit. We document the limitation prominently.

**Alternative considered:** allow any outbound, store a "we don't know how to render this remote actor's activities" placeholder. Rejected because it sets a low expectation and produces a worse first-time experience.

### Decision: Push delivery for local-originated content; pull for remote-originated

When a local user posts a public activity, enqueue `Create(Note)` deliveries to every accepted remote follower's inbox (a pg-boss job per delivery, with retry + backoff). When a remote trails actor we follow posts, we pull on a schedule — same pattern proposed in `social-feed` design before the trim.

**Why this split:** push outbound matches expectation for inbound followers (Mastodon expects to receive Creates). Pull inbound (when trails follows trails) keeps us outage-tolerant and avoids accepting arbitrary inbox `Create`s. Tested asymmetry that gives us federation reach without inbox content surface.

### Decision: Audience-aware activity cache, single row per remote activity

When we fetch a remote trails actor's outbox, store each activity once in `journal.activities` with `remote_origin_iri` (unique), `remote_actor_iri`, and `audience`. The feed query filters at read time so a `followers-only` remote activity only reaches the local user whose follow brought it in.

(This is the same model proposed and trimmed from `social-feed`. Lands here when it's actually needed.)

### Decision: HTTP Signatures + Authorized Fetch

All outbound POSTs to remote inboxes are HTTP-signed using the originating local user's key. All outbound GETs to remote outboxes are also signed (Authorized Fetch / Mastodon "secure mode") — this is required to receive a remote locked actor's followers-only items, and is good hygiene against rate-limit dragnets that block unsigned scrapers.

Inbound signature verification uses the actor's public key from their actor object, fetched via Fedify's document loader and cached in `remote_actors`.

## Risks / Trade-offs

- **Public inbox is the highest-risk endpoint we'll have shipped.** → Narrow it (4 activity types only), rate-limit aggressively per source instance, log everything, monitor for abuse patterns. Land behind a feature flag for staged rollout.
- **Outbound trails-to-trails restriction is unusual** and will get flagged by fediverse veterans. → Document prominently, frame as "v1; broader outbound coming after first soak". Provide a clear path: "to follow a Mastodon user, ask them to mirror to trails.cool, or wait for v2."
- **Key rotation is a real operational chore** if `FEDERATION_KEY_ENCRYPTION_KEY` ever needs rotation. → Runbook + scripted re-encrypt; not a recurring concern but documented.
- **Remote outbox spam** if a popular trails account has thousands of followers polling. → We're the *poller* in this asymmetric model; we don't have a "thousands of remotes polling us" problem. We can rate-limit ourselves.
- **Replay attacks on inbox** via signed activities replayed by a third party. → HTTP Signatures include a `(request-target)` and date; Fedify rejects replays per the spec.
- **Marketing copy currently overstates federation** ("Federated by design — Follow friends anywhere"). → Holds true once this lands inbound from anyone + outbound trails-to-trails. Soften copy in the meantime; restore on launch.

## Migration Plan

1. Land schema additively: `users.public_key`, `users.private_key_encrypted`, `remote_actors` table, `activities.remote_origin_iri/remote_actor_iri/audience`. Generate keypairs for existing users in a one-shot pg-boss job.
2. Bring up Fedify behind a feature flag (`FEDERATION_ENABLED` env var, default off) so we can deploy code without exposing endpoints.
3. Soak inbound only on the flagship: enable WebFinger + actor objects + inbox; do not enable outbound delivery yet. Verify Mastodon can fetch our actor + follow + receive Accept.
4. Soak push delivery on the flagship: enable `Create(Note)` outbound when local users post publicly. Verify a Mastodon follower receives the activity.
5. Soak outbound trails-to-trails: bring up a second trails instance (staging or self-host), follow across, verify both directions.
6. Flip `FEDERATION_ENABLED` on, soften the home blurb, document the federation runbook in `docs/deployment.md`.
7. Rollback: feature flag off (instant), or revert PR (recoverable). Existing `follows` rows stay intact; remote rows would need cleanup.

## Implementation Decisions (made during apply)

- **Inbound remote followers live in `follows` with a nullable `follower_id`**
  (decided in task 4.2, 2026-06-06). The original claim that `follows` was
  federation-ready only covered outbound; a remote follower has no local
  `users` row. Added `follower_actor_iri` with a check constraint enforcing
  exactly one of (`follower_id`, `follower_actor_iri`), and a partial unique
  index deduping `(follower_actor_iri, followed_user_id)`. Existing queries
  filter on `follower_id`/`followed_user_id` and are unaffected; follower
  counts now naturally include remote followers; notification fan-out
  explicitly filters `follower_id IS NOT NULL`.
- **Software identity ships via NodeInfo, not a custom AS actor field**
  (task 3.4). Fedify's typed vocab can't emit arbitrary actor properties, and
  NodeInfo (`software.name: trails-cool`) is the standard the fediverse reads.
  The trails-to-trails outbound check (task 6.x) should read remote NodeInfo,
  with `/.well-known/trails-cool` as the secondary signal.
- **Fedify's KvStore is Postgres-backed** (`journal.federation_kv`) so inbox
  replay protection and document caches survive restarts; swept daily.
- **Outgoing activity shape: `Create(Note)` with PropertyValue attachments**
  (task 5.1; resolves the open question below toward Mastodon compat). The
  Note's HTML content carries name/description/stats plus a link to the
  activity page; distance/elevation/duration ride along as `PropertyValue`
  attachments that Mastodon ignores gracefully and trails consumers can read
  without HTML parsing. GPX download links can join once activities have a
  public GPX endpoint.
- **Private-user 404 for collection endpoints is enforced at the route layer**
  (task 5.1): Fedify builds collection-level responses (outbox
  OrderedCollection) from counter/cursors without consulting the page
  dispatcher, so the dispatcher's `null` → 404 contract doesn't cover them.
- **Retractions are transition-aware; tombstones are forever** (learned on
  the 2026-06-07 soak). Mastodon records a received `Delete` as a permanent
  tombstone for that URI — later `Create`s for the same URI are silently
  refused. Push delivery therefore sends `Delete` only on an actual
  public→non-public transition (`visibilityTransitionAction`), never "just
  in case". Consequence worth surfacing user-facing eventually: if a user
  un-publishes a federated activity and re-publishes it later, remotes that
  processed the retraction will not show it again — same semantics as
  Mastodon's own delete-and-redraft.

## Open Questions

- ~~**`activities.owner_id` is NOT NULL but remote-ingested rows have no local
  owner**~~ — **Resolved in task 7.2 (2026-06-07):** `owner_id` is nullable
  with a check constraint enforcing exactly one of (`owner_id`,
  `remote_actor_iri`) — the same pattern as `follows.follower_id` /
  `follower_actor_iri`. Compiler-audited fallout: notification fan-out,
  the Note object dispatcher, and the activity detail loader all
  explicitly 404/skip remote rows (their canonical page is the origin
  instance; the feed links outward). Every other surface joins `users`
  on `owner_id` and excludes remote rows structurally. A
  `remote_published_at` column carries the origin's publish time for
  the §8 feed sort.

- Custom AS extension for activity-type vs. plain `Create(Note)`? Mastodon will only render Notes; an extension type means non-trails clients see nothing useful. Lean toward `Create(Note)` with structured metadata in `attachment` so Mastodon shows the text + GPX link, and trails clients consuming the outbox can read the structured fields.
- Per-instance inbox vs per-user inbox? Mastodon supports a "shared inbox" optimization. Worth doing for delivery efficiency once we have any volume; v1 can use per-user inboxes only.
- How does the trails-to-trails check interact with self-hosters who fork or rebrand? Probably the `software` field is `"trails.cool"` (or a derivative we list) and the `/.well-known/trails-cool` endpoint is the authoritative discovery. Tasks phase decides the exact shape.
