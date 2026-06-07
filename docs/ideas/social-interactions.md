# Local likes & comments

Pre-spec exploration. The architecture's Journal feature list has
"Social: Following, likes, comments" — follows shipped
(`social-follows`), likes and comments don't exist **even between local
users**. The federated halves are sketched separately in
`fediverse-enhancements.md` (kudos = inbound Like/Announce, comments =
inbound replies); this idea is the local foundation those would attach
to.

## Scope sketch

**Likes (kudos)**
- One per (user, activity); toggleable; count on activity cards + detail
- Notification to the activity owner (`notifications` spec has the
  pattern; new type `activity_liked`)
- Storage: `journal.likes (user_id, activity_id, created_at)` or a
  generalized reactions table if we ever want more than ❤️ — start
  with likes only (simplicity principle)
- Federation hook-in later: inbound Mastodon `Like` increments the same
  counter with `remote_actor_iri` instead of `user_id` (same
  exactly-one-of pattern as `follows.follower_id`/`follower_actor_iri`)

**Comments**
- Flat list on activities first (no threading — Mastodon-reply
  interop pushes toward flat anyway); plain text → maybe limited
  markdown later
- Owner can delete comments on their activities; commenter can delete
  their own
- Notification type `activity_commented`
- Federation hook-in later: inbound replies (`inReplyTo`) land in the
  same table with remote attribution; outbound, local comments on a
  federated activity would need to federate back as replies

## Constraints & notes

- Visibility: liking/commenting requires the activity to be visible to
  you — public activities only for non-owners today; revisit when
  followers-only content lands (§7/§8 of social-federation).
- The `activities.owner_id` NOT NULL open question (design.md of
  social-federation) applies to remote comment authors the same way —
  decide once.
- Decide whether routes also get likes/comments or activities only.
  The architecture says activities; start there.
- Moderation precedes federated comments (see
  `instance-administration.md`) but NOT local comments — local users
  are accountable accounts on your own instance.
