## 1. Library + dependencies

- [ ] 1.1 Spike Fedify on a branch: import, mount minimal actor object endpoint for one user, validate WebFinger lookup from a remote AP client. Confirm fit. If unfit, document why and pivot to alternative
- [ ] 1.2 Add Fedify (or chosen lib) to `apps/journal/package.json`; document version pinning rationale
- [ ] 1.3 Add `FEDERATION_ENABLED` env var (default `false`) and a thin runtime feature flag the rest of the change reads from

## 2. Schema

- [ ] 2.1 Add `users.public_key TEXT NULL`, `users.private_key_encrypted TEXT NULL` (encrypted with `FEDERATION_KEY_ENCRYPTION_KEY`)
- [ ] 2.2 Add `remote_actors` table: `actor_iri PK`, `display_name`, `username`, `domain`, `avatar_url`, `inbox_url`, `outbox_url`, `public_key`, `software` (the discovery field), `last_polled_at`, `created_at`
- [ ] 2.3 Extend `journal.activities` with `remote_origin_iri TEXT NULL UNIQUE`, `remote_actor_iri TEXT NULL`, `audience TEXT NOT NULL DEFAULT 'public'`
- [ ] 2.4 Run `pnpm db:push` locally and confirm migration is clean
- [ ] 2.5 One-shot pg-boss job `backfill-user-keypairs` that generates a keypair for every existing user lacking one. Runs once at deploy when feature flag flips on

## 3. Identity surface

- [ ] 3.1 `localActorIri(username)` already exists from `social-feed`; ensure it's reused everywhere (no string concat on URLs)
- [ ] 3.2 Implement `/.well-known/webfinger?resource=acct:user@domain` returning JRD with `rel="self"` actor link (gated on `profile_visibility = 'public'`)
- [ ] 3.3 Content-negotiated handler at `/users/:username`: HTML for browsers, `application/activity+json` for AP clients (returning the `Person` actor object). Both gated on `profile_visibility = 'public'`
- [ ] 3.4 Actor object includes `software: trails.cool` (custom AS extension) so other instances can recognize us for the trails-to-trails outbound check

## 4. Inbox

- [ ] 4.1 Inbox endpoint at `/users/:username/inbox`. Verifies HTTP Signature on every request before any further processing
- [ ] 4.2 Handle `Follow`: gate on local user's `profile_visibility`, write follow row, push `Accept(Follow)` back, return 202
- [ ] 4.3 Handle `Undo(Follow)`: delete the matching row, return 202
- [ ] 4.4 Handle `Accept(Follow)`: settle our outgoing Pending row's `accepted_at`, enqueue a one-off outbox-poll for the just-accepted actor, return 202
- [ ] 4.5 Handle `Reject(Follow)`: delete our outgoing follow row, surface in user's outgoing-follows list, return 202
- [ ] 4.6 Handle every other activity type: return 202 and drop silently (logged at debug)
- [ ] 4.7 Replay protection: dedupe on activity IRI for follow-graph activities (small hot table or Redis set)
- [ ] 4.8 Per-source-instance rate limit on inbox: 60 requests / 5 min from any single host

## 5. Outbox + push delivery

- [ ] 5.1 Outbox endpoint at `/users/:username/outbox`. Returns paginated `OrderedCollection` of the user's `public` activities as `Create(Note)` (with structured trails-specific metadata in `attachment` so Mastodon shows text + GPX link, and trails consumers can read distance/elevation)
- [ ] 5.2 Honor signed-fetch (Authorized Fetch) on outbox GETs. Unsigned requests get a public-only subset; signed requests get the same (locked accounts is later-change territory)
- [ ] 5.3 On local activity create with `visibility = 'public'`, enqueue a `deliver-activity` pg-boss job per accepted remote follower
- [ ] 5.4 `deliver-activity` job: HTTP-sign + POST `Create(Note)` to follower inbox; retry with exponential backoff on 5xx; permanent-fail after retry budget; log final outcome
- [ ] 5.5 Per-remote-host rate limit on outbound: 1 req/sec per host
- [ ] 5.6 On local activity update or delete, enqueue corresponding `Update`/`Delete` activities to followers (basic — full update/delete fan-out)

## 6. Outbound follow + trails-to-trails check

- [ ] 6.1 Update `followUser` to allow remote IRIs; before creating, fetch the remote actor object and inspect `software`/discovery endpoint
- [ ] 6.2 Implement `/.well-known/trails-cool` endpoint on our side (publishes our software identity) so other trails instances recognize us
- [ ] 6.3 If the discovery check fails, return 4xx with a clear "outbound federation to non-trails instances isn't supported yet" message + docs link
- [ ] 6.4 If the check passes, write follow row with `accepted_at = NULL`, push `Follow` activity to remote inbox
- [ ] 6.5 UI: "Pending" button state on profile (replaces Follow/Unfollow) when `accepted_at IS NULL`
- [ ] 6.6 Outgoing-follows page or section listing Pending requests with cancel control (`Undo(Follow)` + delete row)

## 7. Outbox-poll ingestion

- [ ] 7.1 pg-boss recurring job `poll-remote-outboxes` (cron every 5 min): iterate distinct accepted remote actor IRIs in `follows` where `remote_actors.last_polled_at < now() - interval '1 hour'`; for each, signed GET on the outbox using one of the local accepted-followers' keys
- [ ] 7.2 Insert returned activities into `journal.activities` with `remote_origin_iri`, `remote_actor_iri`, `audience`. `ON CONFLICT (remote_origin_iri) DO NOTHING` for replay safety. Stop early on streak of conflicts
- [ ] 7.3 Refresh `remote_actors` cache row on each poll (display name, avatar, outbox URL, public key)
- [ ] 7.4 Per-remote-host rate limit (1 req / 5 sec); honor `Retry-After` / `429`; back off the host
- [ ] 7.5 First-poll trigger on `accepted_at` transition (already enqueued from 4.4)

## 8. Feed query update

- [ ] 8.1 Update `listSocialFeed` to include audience-aware filtering: include `(audience='public' OR (audience='followers-only' AND f.followed_actor_iri = a.remote_actor_iri))` predicate
- [ ] 8.2 Update feed sort to use `COALESCE(created_at, remote_created_at)` for mixed local/remote rows

## 9. Profile page updates

- [ ] 9.1 Pending state on Follow button (distinct from Follow/Unfollow)
- [ ] 9.2 Federation gate: actor object endpoint returns 404 if `profile_visibility = 'private'`, mirroring the human profile gate
- [ ] 9.3 When a user flips to `private`, federation must stop: outgoing `Accept(Follow)` rows where they're the followed party are no longer honored, push delivery is suppressed, and inbound Follows return 404. (Existing accepted follow rows on the remote side are not actively reaped — remotes will discover via their next outbox poll returning 404 / via a broadcast `Update` of the actor — pick the right approach during implementation)

## 10. Privacy + docs

- [ ] 10.1 Update privacy manifest: federation traffic, remote actor cache, what data is exposed in the actor object (display name, avatar, public key)
- [ ] 10.2 `docs/deployment.md`: federation runbook — feature flag, key rotation procedure, abuse monitoring, troubleshooting
- [ ] 10.3 Soften the Journal home "Federated by design" blurb on flagship now (or align it to "ActivityPub federation: inbound + trails-to-trails outbound" once this lands)

## 11. Testing

- [ ] 11.1 Unit tests: HTTP-Signature verification on inbox; signature production on outbox-poll; encrypt/decrypt of private keys
- [ ] 11.2 Integration test: post a signed `Follow` to local inbox from a fake Mastodon-shaped client → assert `Accept(Follow)` is delivered + follow row exists
- [ ] 11.3 Integration test: post a `Create(Note)` to local inbox → assert it is dropped silently (no DB writes)
- [ ] 11.4 Integration test: bring up two trails instances (Docker Compose multi-instance setup); A on instance 1 follows B on instance 2 → assert Follow → Accept → first poll all happen and B's public activity appears in A's `/feed`
- [ ] 11.5 Integration test: outbound follow attempt against a Mastodon-shaped actor → assert 4xx with the limitation message
- [ ] 11.6 Integration test (audience leak guard): two local users A and B, only A follows remote trails actor X; X's followers-only post lands in cache. Assert A sees it, B does not
- [ ] 11.7 E2E: with feature flag on, follow bruno across instances + see public activity appear

## 12. Rollout

- [ ] 12.1 Schema lands additively behind `FEDERATION_ENABLED=false` (no traffic, no risk)
- [ ] 12.2 Soak inbound only on flagship — enable WebFinger + actor + inbox; verify Mastodon can fetch + follow + receive Accept
- [ ] 12.3 Soak push delivery — local public activity reaches a Mastodon follower's home timeline
- [ ] 12.4 Soak outbound trails-to-trails — bring up second trails instance (staging or self-host), follow across, both directions verified
- [ ] 12.5 Flip flag on; restore home marketing copy; document in deployment runbook
- [ ] 12.6 Rollback: flag off (instant) or revert PR. Existing `follows` rows stay intact
