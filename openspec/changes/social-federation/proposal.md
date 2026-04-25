## Why

`social-feed` shipped local-only follows + `/feed` with a forward-compatible schema, but trails.cool's federation pitch — talking to other ActivityPub servers — is currently aspirational. To deliver on it, we need to actually integrate ActivityPub: actor objects, WebFinger, HTTP-signed inbox/outbox, and per-user keypairs.

The first concrete user-visible win is **inbound federation**: anyone with a Mastodon (or other ActivityPub-compatible) account can follow a trails.cool user and see their public activities in their home timeline. That gives our users immediate reach into the existing fediverse without us having to recruit them onto trails.cool.

Outbound federation is intentionally narrower: trails users can follow other **trails** instances. We don't need to follow Mastodon users for the v1 of federation — keeping outbound trails-to-trails sidesteps having to robustly parse Mastodon's full activity vocabulary (Notes with attachments, polls, mentions, reblogs, content warnings, …). It also means our "remote outbox" parser only ever has to consume our own activity shape.

## What Changes

- Adopt **Fedify** (or the closest equivalent we evaluate) as the ActivityPub library on the Journal. No new heavy dependency surface beyond it.
- Generate a per-user RSA (or Ed25519) keypair at registration; store securely. Existing users get keypairs backfilled at deploy time.
- Serve a **WebFinger** endpoint at `/.well-known/webfinger` resolving `acct:user@domain` to the user's actor IRI.
- Serve a per-user **`Person` actor object** at `https://{DOMAIN}/users/:username` (the same URL the human profile renders at — content negotiation by `Accept` header). The actor object SHALL be served only when `profile_visibility = 'public'`; private profiles 404 the actor too.
- Serve a per-user **inbox** at `https://{DOMAIN}/users/:username/inbox`. The inbox accepts a small fixed set of activities and rejects everything else (no `Create`, no `Like`, no `Announce` in v1):
  - `Follow` from any AP-compatible remote — auto-`Accept` if our user is `profile_visibility = 'public'`.
  - `Undo(Follow)` — remove the follow row.
  - `Accept(Follow)` — settle our own outgoing Pending follow.
  - `Reject(Follow)` — delete our own outgoing follow row.
- Serve a per-user **outbox** at `https://{DOMAIN}/users/:username/outbox`, paginated, listing the user's `public` activities as `Create(Note)` (or a custom AS extension type — design decision deferred). All outbox responses honor signed-fetch challenges.
- **Push delivery on local activity create**: when a local user with `profile_visibility = 'public'` posts a `public` activity, fan out a `Create` activity to every accepted remote follower's inbox via signed POST.
- **Outbound follows trails-to-trails only**: a follow originated from a trails user against a remote IRI is allowed only if the remote actor self-identifies as a trails.cool instance (e.g. by hosting `/.well-known/trails-cool` or a recognizable software field on the actor object). Remote-actor IRIs that fail this check are refused at the API layer with a clear "outbound federation is currently trails-to-trails only" message.
- **Outbox-poll ingestion** for remote trails actors we follow: signed GETs against their outbox, store new activities locally for feed display. (Asymmetric with inbound: we don't expect Mastodon to push us anything, and we don't poll Mastodon outboxes.)
- **Audience-aware storage**: extend `journal.activities` with `remote_origin_iri`, `remote_actor_iri`, `audience` (`public | followers-only`) so followers-only content from a remote trails actor only reaches the local follower whose follow brought it in.
- **Remote actor cache**: a `remote_actors` table for display name, avatar, outbox URL, public key — refreshed during outbox polls so feed cards don't re-fetch on every render.
- Update privacy manifest to document the federation footprint: which remote inboxes our outbox delivers to, what data is exposed in the actor object (display name, avatar, public key), and the per-instance log of incoming/outgoing federation requests.

## Capabilities

### New Capabilities

- `social-federation`: ActivityPub integration — actor objects, WebFinger, signed inbox/outbox, push delivery, remote outbox polling, and the trails-to-trails outbound restriction.

### Modified Capabilities

- `social-follows`: extend follows to remote actor IRIs (the schema column already supports this), add Pending lifecycle for outbound trails-to-trails follows awaiting `Accept`, extend the social feed query to include audience-aware remote activities.
- `public-profiles`: gate the actor object endpoint on `profile_visibility = 'public'`; add a Pending state to the Follow button when an outgoing follow is awaiting `Accept`.
- `infrastructure`: add Fedify dependency, document key-management runbook, document the federation outbox/inbox endpoints in the deployment doc.
- `security-hardening`: HTTP Signatures on all outgoing federation requests, signature verification on all inbound, signed-fetch (Authorized Fetch) policy.

## Impact

- **Code**: Fedify integration on the Journal, per-user keypair generation + storage, inbox + outbox + WebFinger + actor-object route handlers, push-delivery worker (pg-boss job per outgoing activity), outbox-poll worker (pg-boss recurring job), trails-instance discovery helper for the trails-to-trails outbound check, audience-aware storage on `journal.activities`, `remote_actors` cache table.
- **API**: 4 new public-internet endpoints per user (`/.well-known/webfinger`, `/users/:username` content-negotiated for AP, `/users/:username/inbox`, `/users/:username/outbox`).
- **UI**: Pending state on Follow button, "outgoing follows" section listing Pending requests with cancel option, federation-aware empty states on `/feed`.
- **Federation surface**: real federation traffic crosses the public internet for the first time — push to followers, inbox processing, outbox polling. Rate-limited per-host on outbound, per-actor on inbound.
- **Dependencies**: Fedify (or chosen equivalent). No other heavy runtime additions.
- **Schema**: additive — `users.public_key`, `users.private_key_encrypted`, `remote_actors` table, `activities.remote_origin_iri/remote_actor_iri/audience`, no changes to `follows` (already federation-ready).
- **Privacy manifest**: federation entry covering inbox/outbox traffic, remote actor cache, and what a remote instance learns when it fetches one of our actor objects.
- **Operational**: deploy raises real public-facing concerns — abuse-prone inbox endpoint, outbound rate limits, key rotation. Pre-launch checklist documented in deployment docs.
- **Out of scope** (tracked as later changes):
  - **Outbound from trails to Mastodon** (fully bidirectional with non-trails servers). Adds robust handling of arbitrary AP vocabulary; revisit once trails-to-trails is stable and we have user demand.
  - **Locked local accounts** (`locked-local-accounts`) — that change adds the third profile state and the manual-approve UX.
  - Content types beyond `Create(Note)`: Like, Announce (boost), reply threading.
