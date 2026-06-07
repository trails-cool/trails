## 1. Library + dependencies

- [x] 1.1 Spike Fedify on a branch: import, mount minimal actor object endpoint for one user, validate WebFinger lookup from a remote AP client. Confirm fit. If unfit, document why and pivot to alternative
- [x] 1.2 Add Fedify (or chosen lib) to `apps/journal/package.json`; document version pinning rationale
- [x] 1.3 Add `FEDERATION_ENABLED` env var (default `false`) and a thin runtime feature flag the rest of the change reads from

## 2. Schema

- [x] 2.1 Add `users.public_key TEXT NULL`, `users.private_key_encrypted TEXT NULL` (encrypted with `FEDERATION_KEY_ENCRYPTION_KEY`)
- [x] 2.2 Add `remote_actors` table: `actor_iri PK`, `display_name`, `username`, `domain`, `avatar_url`, `inbox_url`, `outbox_url`, `public_key`, `software` (the discovery field), `last_polled_at`, `created_at`
- [x] 2.3 Extend `journal.activities` with `remote_origin_iri TEXT NULL UNIQUE`, `remote_actor_iri TEXT NULL`, `audience TEXT NOT NULL DEFAULT 'public'`
- [x] 2.4 Run `pnpm db:push` locally and confirm migration is clean
- [x] 2.5 One-shot pg-boss job `backfill-user-keypairs` that generates a keypair for every existing user lacking one. Runs once at deploy when feature flag flips on

## 3. Identity surface

- [x] 3.1 `localActorIri(username)` already exists from `social-feed`; ensure it's reused everywhere (no string concat on URLs)
- [x] 3.2 Implement `/.well-known/webfinger?resource=acct:user@domain` returning JRD with `rel="self"` actor link (gated on `profile_visibility = 'public'`)
- [x] 3.3 Content-negotiated handler at `/users/:username`: HTML for browsers, `application/activity+json` for AP clients (returning the `Person` actor object). Both gated on `profile_visibility = 'public'`
- [x] 3.4 Actor object includes `software: trails.cool` (custom AS extension) so other instances can recognize us for the trails-to-trails outbound check
  > Adapted during implementation: shipped as a standard **NodeInfo** endpoint (`/.well-known/nodeinfo` + `/nodeinfo/2.1`, `software.name: trails-cool`) instead of a custom AS field — Fedify's typed vocab can't emit arbitrary actor properties, and NodeInfo is what the fediverse actually reads for software identity. `/.well-known/trails-cool` remains as the secondary discovery surface.

## 4. Inbox

- [x] 4.1 Inbox endpoint at `/users/:username/inbox`. Verifies HTTP Signature on every request before any further processing
- [x] 4.2 Handle `Follow`: gate on local user's `profile_visibility`, write follow row, push `Accept(Follow)` back, return 202
- [x] 4.3 Handle `Undo(Follow)`: delete the matching row, return 202
- [x] 4.4 Handle `Accept(Follow)`: settle our outgoing Pending row's `accepted_at`, enqueue a one-off outbox-poll for the just-accepted actor, return 202
- [x] 4.5 Handle `Reject(Follow)`: delete our outgoing follow row, surface in user's outgoing-follows list, return 202
  > Protocol part done; the UI notice lands with the outgoing-follows list (task 6.6).
- [x] 4.6 Handle every other activity type: return 202 and drop silently (logged at debug)
- [x] 4.7 Replay protection: dedupe on activity IRI for follow-graph activities (small hot table or Redis set)
- [x] 4.8 Per-source-instance rate limit on inbox: 60 requests / 5 min from any single host

## 5. Outbox + push delivery

- [x] 5.1 Outbox endpoint at `/users/:username/outbox`. Returns paginated `OrderedCollection` of the user's `public` activities as `Create(Note)` (with structured trails-specific metadata in `attachment` so Mastodon shows text + GPX link, and trails consumers can read distance/elevation)
- [x] 5.2 Honor signed-fetch (Authorized Fetch) on outbox GETs. Unsigned requests get a public-only subset; signed requests get the same (locked accounts is later-change territory)
  > The two scenarios collapse to one shape — the outbox only ever contains public items, so no signature check is needed until locked accounts exist. Documented in code.
- [x] 5.3 On local activity create with `visibility = 'public'`, enqueue a `deliver-activity` pg-boss job per accepted remote follower
- [x] 5.4 `deliver-activity` job: HTTP-sign + POST `Create(Note)` to follower inbox; retry with exponential backoff on 5xx; permanent-fail after retry budget; log final outcome
- [x] 5.5 Per-remote-host rate limit on outbound: 1 req/sec per host
- [x] 5.6 On local activity update or delete, enqueue corresponding `Update`/`Delete` activities to followers (basic — full update/delete fan-out)
  > Implemented as: visibility flip → public sends Create; flip away from public or hard delete sends Delete(Tombstone). There is no general field-edit server path today, so `Update` has no trigger yet — revisit if/when activity editing ships.

## 6. Outbound follow + trails-to-trails check

- [x] 6.1 Update `followUser` to allow remote IRIs; before creating, fetch the remote actor object and inspect `software`/discovery endpoint
  > Split-domain interop constraint (2026-06-07): resolve the handle via WebFinger first, then run the NodeInfo/`software` check against the **actor IRI's host** (the server domain), never the handle's domain — Hollo/Mastodon-style split-domain instances (`@user@example.com` served from `social.example.com`) would otherwise be wrongly refused. See `docs/ideas/split-domain-handles.md`.
- [x] 6.2 Implement `/.well-known/trails-cool` endpoint on our side (publishes our software identity) so other trails instances recognize us
- [x] 6.3 If the discovery check fails, return 4xx with a clear "outbound federation to non-trails instances isn't supported yet" message + docs link
- [x] 6.4 If the check passes, write follow row with `accepted_at = NULL`, push `Follow` activity to remote inbox
- [x] 6.5 UI: "Pending" button state on profile (replaces Follow/Unfollow) when `accepted_at IS NULL`
  > The Pending button already existed from locked accounts. Remote actors have no local profile page, so the remote Pending state lives on /follows/outgoing (6.6) instead.
- [x] 6.6 Outgoing-follows page or section listing Pending requests with cancel control (`Undo(Follow)` + delete row)
  > Shipped as /follows/outgoing: follow-by-handle form + pending/accepted list + cancel (also satisfies the Reject-surfacing note on 4.5 — rejected rows simply disappear from this list). Linked from the feed empty state.

## 7. Outbox-poll ingestion

- [x] 7.1 pg-boss recurring job `poll-remote-outboxes` (cron every 5 min): iterate distinct accepted remote actor IRIs in `follows` where `remote_actors.last_polled_at < now() - interval '1 hour'`; for each, signed GET on the outbox using one of the local accepted-followers' keys
- [x] 7.2 Insert returned activities into `journal.activities` with `remote_origin_iri`, `remote_actor_iri`, `audience`. `ON CONFLICT (remote_origin_iri) DO NOTHING` for replay safety. Stop early on streak of conflicts
- [x] 7.3 Refresh `remote_actors` cache row on each poll (display name, avatar, outbox URL, public key)
- [x] 7.4 Per-remote-host rate limit (1 req / 5 sec); honor `Retry-After` / `429`; back off the host
  > Done (2026-06-07): 1 req/5 s pacing + explicit 429 backoff. Fedify's `FetchError` carries the failed `Response`, so `Retry-After` is read from `err.response.headers` (delta-seconds or HTTP-date, capped at the 1 h poll interval; 15 min default). Backing-off hosts are skipped before any DB/network work; in-process state (a restart costs at most one extra 429).
- [x] 7.5 First-poll trigger on `accepted_at` transition (already enqueued from 4.4)

## 8. Feed query update

- [x] 8.1 Update `listSocialFeed` to include audience-aware filtering: include `(audience='public' OR (audience='followers-only' AND f.followed_actor_iri = a.remote_actor_iri))` predicate
- [x] 8.2 Update feed sort to use `COALESCE(created_at, remote_created_at)` for mixed local/remote rows

## 9. Profile page updates

- [x] 9.1 Pending state on Follow button (distinct from Follow/Unfollow)
  > Shipped with locked accounts for local profiles; remote Pending lives on /follows/outgoing (no local profile page for remote actors).
- [x] 9.2 Federation gate: actor object endpoint returns 404 if `profile_visibility = 'private'`, mirroring the human profile gate
- [x] 9.3 When a user flips to `private`, federation must stop: outgoing `Accept(Follow)` rows where they're the followed party are no longer honored, push delivery is suppressed, and inbound Follows return 404. (Existing accepted follow rows on the remote side are not actively reaped — remotes will discover via their next outbox poll returning 404 / via a broadcast `Update` of the actor — pick the right approach during implementation)

## 10. Privacy + docs

- [x] 10.1 Update privacy manifest: federation traffic, remote actor cache, what data is exposed in the actor object (display name, avatar, public key)
- [x] 10.2 `docs/deployment.md`: federation runbook — feature flag, key rotation procedure, abuse monitoring, troubleshooting
- [x] 10.3 Soften the Journal home "Federated by design" blurb on flagship now (or align it to "ActivityPub federation: inbound + trails-to-trails outbound" once this lands)

## 11. Testing

- [x] 11.1 Unit tests: HTTP-Signature verification on inbox; signature production on outbox-poll; encrypt/decrypt of private keys
  > Done via combination (2026-06-07): encrypt/decrypt + sign/verify roundtrip in `federation-keys.server.test.ts`; HTTP-Signature verification/production is Fedify's tested core, exercised wire-level by the 11.4 harness (signed Follow/Accept/Authorized Fetch between two live instances).
- [x] 11.2 Integration test: post a signed `Follow` to local inbox from a fake Mastodon-shaped client → assert `Accept(Follow)` is delivered + follow row exists
  > Done (2026-06-07): handler level in `federation-inbox.integration.test.ts`; full wire level (real signed Follow → Accept delivered + rows on both sides) in the 11.4 harness — a real instance instead of a fake client. Actual-Mastodon behavior was verified live in the 2026-06-06/07 soak.
- [x] 11.3 Integration test: post a `Create(Note)` to local inbox → assert it is dropped silently (no DB writes)
  > Done (2026-06-07): in the 11.4 driver — unsigned Create(Note) to the inbox gets 4xx and writes nothing. Signed Creates have no listener (poll-only ingestion by design) and are discarded by Fedify.
- [x] 11.4 Integration test: bring up two trails instances (Docker Compose multi-instance setup); A on instance 1 follows B on instance 2 → assert Follow → Accept → first poll all happen and B's public activity appears in A's `/feed`
  > Done (2026-06-07): `e2e/federation/` harness (postgres + caddy internal CA + two journal containers) driven by `federation-two-instance.integration.test.ts` via `run.sh`. Opt-in, not in CI. Caught a real trails↔trails bug: cross-origin embedded Follow objects in Accept/Reject/Undo are distrusted by Fedify and their fragment IRIs dereference to the actor document — listeners now recover via the wire objectId (captured before getObject(), which memoizes) + the personal-inbox recipient.
- [x] 11.5 Integration test: outbound follow attempt against a Mastodon-shaped actor → assert 4xx with the limitation message
  > Done earlier in §6: `federation-outbound.integration.test.ts` ("refuses non-trails instances with a clear code"); route returns 400 + `not_trails`.
- [x] 11.6 Integration test (audience leak guard): two local users A and B, only A follows remote trails actor X; X's followers-only post lands in cache. Assert A sees it, B does not
  > Done earlier in §8: `social-feed.integration.test.ts` audience-leak guard.
- [x] 11.7 E2E: with feature flag on, follow bruno across instances + see public activity appear
  > Done (2026-06-07) by the 11.4 driver at the HTTP/UI boundary: the follow goes through the real `/follows/outgoing` route action with a real session cookie, and the assertion reads the rendered `/feed` HTML (activity name + `@bob@journal-b.test` attribution). A browser-driven repeat would re-test the same path through Playwright; skipped deliberately.

## 12. Rollout

- [x] 12.1 Schema lands additively behind `FEDERATION_ENABLED=false` (no traffic, no risk)
  > True since the §2 schema PRs: all federation columns/tables shipped additively, prod has run them with the flag off (404 on every federation surface) throughout the staging soak.
- [x] 12.2 Soak inbound only on flagship — enable WebFinger + actor + inbox; verify Mastodon can fetch + follow + receive Accept
  > Soaked on persistent **staging** (2026-06-06/07) against a real Mastodon (social.ullrich.is): WebFinger → actor fetch → Follow → Accept → profile fields all verified live; six latent bugs found and fixed in the process. Staging shares the flagship host, Caddy, and Postgres — the environment risk surface is exercised; only the prod *domain* hasn't federated yet (that's the 12.5 flag flip).
- [x] 12.3 Soak push delivery — local public activity reaches a Mastodon follower's home timeline
  > Same staging soak: pushed Create(Note) rendered in the Mastodon home timeline (tombstone + 10s-timeout lessons recorded in design.md).
- [ ] 12.4 Soak outbound trails-to-trails — bring up second trails instance (staging or self-host), follow across, both directions verified
  > Protocol mechanics fully verified by the two-instance harness (`e2e/federation/`, task 11.4) — which found and fixed the cross-origin Accept bug. Live surface is ready: PR previews run federated (#491), so the soak is: follow from staging.trails.cool to a user on `pr-<N>.staging.trails.cool` and back. Needs a seeded user on a preview (server-side); queued for the next operator session.
- [x] 12.5 Flip flag on; restore home marketing copy; document in deployment runbook
  > Flipped 2026-06-07 (operator-approved): `FEDERATION_ENABLED=true` ships in cd-apps.yml's flagship env, with the compose wiring defaulting *off* for self-hosters. Home blurb already accurate (10.3), runbook documented (10.2). Applied via a manual cd-apps dispatch after merge.
- [x] 12.6 Rollback: flag off (instant) or revert PR. Existing `follows` rows stay intact
  > Documented in the deployment runbook's federation section; flag-off instantly 404s every federation surface while rows persist.
