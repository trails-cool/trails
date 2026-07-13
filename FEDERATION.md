# Federation protocol

trails.cool's Journal federates over [ActivityPub](https://www.w3.org/TR/activitypub/),
implemented with [Fedify](https://fedify.dev). This document describes the
wire protocol precisely enough for another implementation to interoperate
deliberately — actor discovery, the object and activity types we emit and
accept, addressing, signatures, deduplication, delivery retry, and
moderation. Examples use `trails.example` for our instance and
`remote.example` for a peer.

Federation is per-instance opt-in (`FEDERATION_ENABLED`). When it is off,
every federation surface returns 404 — a disabled instance is
indistinguishable from one without the feature. Only users with
`profile_visibility = 'public'` federate; a private user's actor,
WebFinger, inbox, and outbox all 404, so their existence never leaks.

## Actor discovery

### WebFinger

`GET /.well-known/webfinger?resource=acct:alice@trails.example` resolves a
handle to an actor IRI:

```json
{
  "subject": "acct:alice@trails.example",
  "links": [
    { "rel": "self", "type": "application/activity+json", "href": "https://trails.example/users/alice" }
  ]
}
```

### Actor

`GET https://trails.example/users/alice` with `Accept: application/activity+json`
returns a `Person`. The actor IRI and the human profile `url` are the same
by design (browsers get HTML at that URL via content negotiation):

```json
{
  "@context": ["https://www.w3.org/ns/activitystreams", "https://w3id.org/security/v1"],
  "id": "https://trails.example/users/alice",
  "type": "Person",
  "preferredUsername": "alice",
  "name": "Alice",
  "summary": "trail runner",
  "url": "https://trails.example/users/alice",
  "inbox": "https://trails.example/users/alice/inbox",
  "outbox": "https://trails.example/users/alice/outbox",
  "publicKey": {
    "id": "https://trails.example/users/alice#main-key",
    "owner": "https://trails.example/users/alice",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----\n"
  },
  "assertionMethod": [ { "type": "Multikey", "…": "…" } ],
  "attachment": [
    { "type": "PropertyValue", "name": "🥾 trails.cool", "value": "<a href=\"https://trails.example/users/alice\" rel=\"me\">trails.example/users/alice</a>" },
    { "type": "PropertyValue", "name": "Instance", "value": "<a href=\"https://trails.example\">trails.example</a>" }
  ]
}
```

`publicKey` is the RSA key Mastodon reads for HTTP-Signature verification;
`assertionMethod` carries the same keys as Multikeys for newer stacks.

### NodeInfo (software discovery)

`GET /.well-known/nodeinfo` links to `GET /nodeinfo/2.1`:

```json
{
  "version": "2.1",
  "software": { "name": "trails-cool", "version": "1.2.3", "homepage": "https://trails.cool/" },
  "protocols": ["activitypub"],
  "usage": { "users": {}, "localPosts": 0, "localComments": 0 }
}
```

`software.name` is the machine-readable "this is a trails instance" marker
used by the trails-to-trails outbound check. Usage counts are deliberately
zeroed — publishing per-instance counts is a privacy decision we have not
made.

## Objects and activities

Activities correspond to a user's journal entries. The object model is
deliberately Mastodon-compatible: a `Create(Note)` whose HTML `content`
summarizes the activity and whose `url` links to the journal detail page.
(A first-class `trails:Route` object type is planned with route-federation;
today everything is a Note.)

### Note

```json
{
  "id": "https://trails.example/activities/01H…",
  "type": "Note",
  "attributedTo": "https://trails.example/users/alice",
  "content": "<p>Morning trail run — 12.4 km, 480 m up</p>",
  "url": "https://trails.example/activities/01H…",
  "published": "2026-07-13T07:12:00Z",
  "to": ["https://www.w3.org/ns/activitystreams#Public"]
}
```

The Note IRI (`/activities/<id>`) is dereferenceable and serves
`application/activity+json` — Mastodon's search-fetch and strict re-fetch
of pushed objects both rely on this.

### Create / Delete

A publish is a `Create` wrapping the Note; the activity id is the object IRI
with a `#create` fragment. A retraction is a `Delete` wrapping a `Tombstone`
at the same object IRI:

```json
{ "id": "https://trails.example/activities/01H…#create", "type": "Create",
  "actor": "https://trails.example/users/alice",
  "object": { "…": "the Note above" },
  "published": "2026-07-13T07:12:00Z",
  "to": ["https://www.w3.org/ns/activitystreams#Public"] }
```

Note that a `Delete` poisons the object URI on the remote forever (remotes
tombstone it); re-publishing the same URI after a Delete is silently
refused by strict remotes.

### Follow graph

The inbox is **narrow** — only follow-graph activities are processed;
anything else is acknowledged (`202`) and dropped.

| Inbound | Effect |
|---|---|
| `Follow` (remote → local public actor) | auto-accepted; we push back an `Accept(Follow)` |
| `Undo(Follow)` | removes the follow |
| `Accept(Follow)` | settles our outgoing Follow; triggers the first outbox poll |
| `Reject(Follow)` | drops our pending outgoing Follow |

## Addressing

Public activities are addressed to `https://www.w3.org/ns/activitystreams#Public`
and **push-delivered** to each accepted remote follower's inbox (fan-out,
one delivery per follower). We do not implement shared-inbox delivery.
Remotes do not backfill history — only pushed or individually-fetched
objects appear on a peer.

## Signatures

All inbound activities must carry a valid HTTP Signature; Fedify verifies it
against the sending actor's `publicKey` (fetched and cached). Unsigned or
badly-signed requests are rejected. Outbound deliveries are signed with the
sending user's key. An actor changing keys requires the remote to re-fetch
the actor document.

## Deduplication

Delivery is at-least-once, so receivers must be idempotent. trails dedups
inbound activities two ways:

- **`Create(Note)`** — idempotent via a unique constraint on the activity's
  origin IRI (`remote_origin_iri`); a redelivered Create is a no-op.
- **Follow-graph activities** (`Follow` / `Undo` / `Accept` / `Reject`) — the
  activity IRI is recorded in `federation_processed_activities` on first
  receipt (insert-or-drop before any side effect); a redelivery is dropped
  and counted (`federation_inbox_dropped_total{reason="duplicate"}`).
  Records are retained ≥ 30 days, which comfortably exceeds the
  HTTP-Signature date-freshness window, then swept.

## Delivery retry

Delivery queueing and retry state are **durable** — they survive process
restarts and deploys (backed by PostgreSQL via pg-boss; Fedify owns the
retry policy). On a `5xx` or timeout, a delivery retries with exponential
backoff, giving up after a bounded budget (~8 attempts spanning roughly a
day) before a permanent failure is logged. Deliveries are paced to at most
1 request/second per remote host. Metrics:
`federation_delivery_total{outcome}` and `federation_queue_depth`.

## Moderation

An operator can block a federation instance by domain (exact-host match).
A blocked instance is **inert in both directions**:

- its inbound activities are silently dropped (`202`, no error oracle) and
  counted (`federation_inbox_dropped_total{reason="blocked"}`);
- it receives no deliveries (blocked recipients are filtered from fan-out);
- we never fetch its actors or outboxes.

Blocking is effective immediately (checked per request / per job, no cache).
The operator procedure (a SQL insert/delete against
`journal.federation_blocked_instances`) is documented in the
[deployment runbook](docs/deployment.md#blocking-an-instance).

---

*Kept current as federation capabilities change. Specs:
`openspec/specs/social-federation` and `openspec/specs/federation-operations`.*
