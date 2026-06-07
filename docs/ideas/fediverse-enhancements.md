# Fediverse enhancements (post social-federation v1)

Pre-spec exploration. Collected during the 2026-06-06/07 staging soak —
the first real federation exchange between trails.cool (staging) and a
Mastodon instance — partly from Ullrich's notes, partly from what the
soak itself surfaced. Everything here builds on the shipped v1
foundation (keys, inbox, outbox, push delivery, dereferenceable Notes).

## Near-term (high demo value, each roughly a day)

### Route map images in Notes
Attach a rendered map preview (`Document`, image/png) to outgoing
`Create(Note)` activities so Mastodon timelines show *the route*, not
just text. The archived `journal-route-previews` change already renders
previews; this is plumbing, not new rendering. Single highest-impact
small change — an activity post with a map is a self-advertising
artifact every time someone boosts it.

### Fediverse kudos
Mastodon users can already favorite/boost federated activities; our
narrow inbox currently drops the resulting `Like`/`Announce` silently
(by design for v1). Counting them — a `kudos` tally per activity, "12
kudos from the fediverse" on the activity page — extends the inbox by
two activity types with trivially small attack surface (no content,
just references to our own objects). Undo(Like)/Undo(Announce)
decrement.

### Comments from the fediverse
Mastodon replies to a federated activity (`Create(Note)` with
`inReplyTo` pointing at our object) shown as comments on the activity
page. This deliberately opens the inbound-content door the v1 design
kept shut, so it needs the moderation/abuse story first (per-instance
blocklist at minimum, probably report handling). The engagement payoff
is large; the scope is the largest of the near-term items.

## Future

### Planned routes as Events
Publish group rides/hikes as ActivityPub `Event` objects → Mobilizon
and Gancio users can RSVP from their instances. Plan in the Planner,
announce to the fediverse, meet at the trailhead. Pairs naturally with
multi-day routes and would make trails.cool the only outdoor platform
with federated event organizing.

### Interop with Wanderer
[Wanderer](https://wanderer.to) is a federated trail-sharing platform
that already speaks ActivityPub. The trails-to-trails outbound check
(social-federation §6) keys on NodeInfo `software.name`; generalizing
the allowlist to include Wanderer (and rebranded trails forks — an open
question in the design doc already) could connect two outdoor networks
instead of bootstrapping one. Requires mapping their activity/trail
vocabulary to ours — scope unknown until we read their AS shapes.

### Federated explore
Opt-in relay (or peer crawl of trails-instance outboxes) aggregating
public routes across instances so `/explore` shows the network's best
routes, not just the local instance's. Pairs with `route-discovery`
(spatial search) post-launch; the relay also gives self-hosters
discoverability from day one.

## Soak learnings that constrain these (see social-federation design.md)

- Mastodon requires `attachment` arrays and tombstones deleted URIs
  forever — every new outgoing shape should be verified against a real
  instance early, not from the spec.
- Inbound content (kudos, comments) must go through the async queue —
  Mastodon's 10s delivery timeout is unforgiving.
- The `activities.owner_id NOT NULL` question (remote rows have no
  local owner) bites comments-from-fediverse too, not just §7 outbox
  ingestion — resolve it once, for both.
