## Context

Transcribes and refines architecture.md Resolved Decisions #2 (route
mirroring), #3 (cross-instance edits), #12 (cross-instance auth) and
#16 (delivery retry/sync healing) into a buildable change, on top of
what `social-federation` shipped: Fedify mounted in the journal,
per-user keys, the narrow inbox, NodeInfo-based trails-instance
discovery, push delivery via pg-boss, and the hard-won serialization
lessons (attachment arrays, tombstones, async queue, dereferenceable
objects).

Status: drafted ahead of implementation (2026-06-07) to capture the
architecture vision as a concrete change; revisit against reality once
social-federation §6/§7 and route-sharing have landed.

## Goals / Non-Goals

**Goals:**
- A public route is a dereferenceable AP object at its canonical URL.
- Alice (instance A) shares a route with Bob (instance B): Invite →
  Accept → B holds a mirror that stays current via Update fan-out.
- Bob edits Alice's route in a Planner session; the save lands on A as
  a new version crediting Bob — no drafts on B (canonical-owner model).
- Mirrors self-heal after extended downtime via periodic sync check.

**Non-Goals:**
- Mastodon rendering of routes (trails-to-trails only).
- Federated forking, federated route discovery/search.
- Moving Planner sessions between instances (a session lives on one
  Planner; only the *save destination* is remote).

## Decisions

### Decision: Canonical owner, mirrors as read caches (arch #2)

The owner's instance is the single source of truth. Collaborator
instances store mirrors — metadata + latest GPX — updated by `Update`
fan-out, used for display and as the seed when opening an edit session
while A is reachable; stale mirrors are explicitly labeled in the UI
when the sync check can't reach the origin.

### Decision: Edits go straight to the owner (arch #3, #12)

Bob's instance never stores a draft. The edit flow:
1. B requests a scoped edit token from A
   (`POST /api/federation/routes/:id/edit-token`, HTTP-Signature
   signed by Bob's actor key; A verifies Bob is a collaborator).
2. A issues the same shape of scoped JWT the local edit-in-planner
   flow uses (route id, permissions, expiry, jti) — single-use
   enforcement via the existing `consumed_jwt_jti` table.
3. B opens the Planner with A's callback URL + token; the existing
   callback endpoint on A accepts the save and records Bob's actor IRI
   as contributor (contributors become IRIs, matching the route
   metadata envelope in arch #8).

### Decision: Vocabulary — custom `trails:Route` object, standard activity wrappers

`Create`/`Update`/`Invite`/`Accept` are standard AS2 activities; the
object is a custom type under the trails JSON-LD context (namespace
served from the instance, e.g. `https://trails.cool/ns#Route`) carrying
the metadata envelope (distance, elevation, day breaks, routing
profile, contributors) plus a GPX `Document` attachment. Soak lesson
applied: every shape verified against a real second instance before
merge, arrays for one-element collections, objects dereferenceable
from day one.

### Decision: Trails-to-trails gating reuses the §6 check

Same NodeInfo `software.name` allowlist as outbound follows; route
activities are neither delivered to nor accepted from non-trails
instances. (The Wanderer-interop idea would widen this allowlist —
explicitly out of scope here.)

Split-domain interop: the check runs against the **actor IRI's host**
(server domain) after WebFinger resolution, never the handle's domain —
remote instances may run Hollo/Mastodon-style split domains. See
`docs/ideas/split-domain-handles.md`.

### Decision: Sync check is a pg-boss cron, owner-driven re-fetch

Daily job on the *mirror-holding* instance: for each mirror whose
`last_update_at` predates its origin's advertised `updated` (HEAD/GET
on the canonical object), re-fetch and reconcile. Covers the
"instance down > 72h, Update lost" case in arch #16.

## Prior art: wanderer (reviewed 2026-07-06)

Full analysis in `docs/inspirations.md`. wanderer is the only other
shipped ActivityPub-for-trails implementation; three findings bear on
this design:

- **Object model contrast.** wanderer federates trails as plain `Note`s
  — metrics as bespoke `tag[]` entries, GPX as a `Document` attachment.
  That validates our GPX-as-Document choice but is otherwise the
  opposite of the `trails:Route` decision above. Their model is lossy
  (stringified metrics, 3-photo cap) and needs string parsing to
  consume; ours is structured but renders as nothing on non-trails
  platforms. **Consideration for the vocabulary decision:** emit a
  Note-compatible fallback alongside `trails:Route` (readable `content`
  HTML + image/GPX attachments on the same object). wanderer proves the
  Note shape renders well in Mastodon; carrying it costs little and
  keeps the "Mastodon rendering" non-goal a presentation choice rather
  than an architectural wall.
- **wanderer interop is an adapter, not an allowlist tweak.** The §6
  gating note ("widen the allowlist") understates it: accepting
  wanderer content means parsing metric-tags out of `Note`s and
  emitting shapes they parse back. Feasible — their social layer
  (WebFinger, per-user keys, authorized fetch, Follow/Accept) matches
  ours — but it's a dedicated compatibility layer. Stays out of scope;
  now with an accurate size estimate.
- **Operational prerequisite.** wanderer's fire-and-forget delivery
  (no queue/retry) is the cautionary tale for mirror consistency: this
  change's Update fan-out and sync-healing assume durable delivery.
  The `federation-hardening` change (durable Fedify queue, replay
  dedup, instance blocklist) should land **before** route mirrors;
  mirror sync must also respect the blocklist (don't re-fetch origins
  on blocked domains).

## Risks / Trade-offs

- **Custom vocabulary is an interop commitment** — version the
  context document; additive evolution only.
- **Token issuance endpoint is a new authenticated surface** —
  HTTP-Signature + collaborator check + rate limit + audit log;
  security-review gate before enabling (same staged-flag pattern as
  FEDERATION_ENABLED, possibly its own ROUTE_FEDERATION_ENABLED).
- **Tombstone semantics apply to routes too** (2026-06-07 soak
  lesson): unsharing/unpublishing federates a retraction only on an
  actual public/shared→not transition, and re-publishing after a
  Delete won't resurrect mirrors that processed it.
- **Mirror divergence** if a save lands while fan-out is mid-flight —
  versions are sequential on the owner; mirrors always converge to the
  owner's latest (last-write-wins on the mirror, never on the origin).

## Open Questions

- Mirror storage: dedicated `route_mirrors` table vs provenance
  columns on `routes` (the activities precedent says columns +
  `remote_origin_iri UNIQUE`; routes carry more state — versions?
  Probably mirror latest-only, no version history on mirrors).
- Does `Invite` target the user or the instance? (User — but the
  Accept must be signed by the invited actor; what happens when the
  user moves instances?)
- Contributor identity display for remote contributors (handle?
  cached display name? same remote_actors cache?).
- Whether the planner needs to know anything at all (ideally zero
  changes — callback URL + token are opaque to it already).
