## Why

The locked-account model in `social-feed` introduced a real "needs your attention" surface (Pending follow requests) and the social feed introduced an "interesting things you might want to know about" surface (a friend posted a new public activity). Today both are invisible unless the user proactively browses the right page — a pending requester has no way to know their request was approved without checking the followed profile, and a follow has no signal at all that someone they follow just posted.

Without a notifications surface, the social loop stays cold: users miss approvals, miss new content, and the locked-account flow feels broken because Pending feels like a one-way drop. A small, focused notifications layer closes the loop.

## What Changes

- New `notifications` table on the Journal: `recipient_user_id`, `type`, `actor_user_id`, `subject_id`, `payload JSONB`, `payload_version INT`, `read_at`, `created_at`. Unread is `read_at IS NULL`. The `payload` snapshots the renderer-friendly fields (display name, activity name, etc.) at creation time so future mobile/email/push consumers can render notifications without a fresh DB lookup; `payload_version` lets us evolve the per-type payload schema without breaking old rows.
- Four notification types in v1:
  - `follow_request_received`: when someone requests to follow a private user, the followed user gets a notification. The notification card links to `/follows/requests` (where Approve / Reject lives); marking the notification read does NOT change the request state — they are independent surfaces, mirroring Mastodon's pattern. The existing follow-requests count badge stays as the actionable surface; this notification is the historical "this happened" record.
  - `follow_request_approved`: when a private user approves an incoming Pending follow, the follower (now accepted) gets a notification.
  - `follow_received`: when a public user is followed (auto-accept path), the followed user gets a notification.
  - `activity_published`: when a user publishes a `public` activity, every accepted follower of theirs gets a notification (server-side fan-out at write time).
- New `/notifications` page — signed-in only — listing the user's notifications reverse-chronological with read/unread state. Inline actions where they make sense (e.g. "View profile" / "View activity").
- New navbar bell-style entry (or repurposed badge) showing the unread count, linking to `/notifications`. The existing `/follows/requests` link stays distinct because Pending requests want their own dedicated surface — the bell tracks "things that have already happened to you," follow-requests is "things you can act on right now."
- Mark-as-read: clicking a notification marks that item read; an explicit "Mark all read" action on `/notifications` clears the badge.
- **Live unread-count updates via Server-Sent Events.** A `/api/events` endpoint streams a small `notifications.unread { count }` event to the user's open browser tabs whenever their unread count changes — generation hooks broadcast through an in-process registry. The navbar badge listens for these events and updates without a page reload. Loader-driven count remains the source of truth on initial render and after navigation; SSE is the "keep it fresh between navigations" channel.
- Generation hooks:
  - `followUser` (Pending path, private target) → insert `follow_request_received` for the target.
  - `followUser` (auto-accepted public path) → insert `follow_received` for the target.
  - `approveFollowRequest` → insert `follow_request_approved` for the follower.
  - `createActivity` (when `visibility = 'public'`) → enqueue a pg-boss fan-out job that inserts `activity_published` rows for all accepted followers.
- Privacy manifest entry documenting the new relation: who got notified about what, retained for read-state and recency only.

## Out of scope (tracked as follow-ups)

- **Notification preferences / per-type mutes.** Single global on/off would already be wider than this change wants to be. Default is "all types on"; a future change adds a settings toggle.
- **Email digest** of unread notifications.
- **WebSocket delivery / bidirectional real-time channel.** v1 ships SSE for one-way badge updates. Bidirectional (chat-style features, presence, typing indicators) is a separate transport with separate concerns and not needed for the notifications use case.
- **Multi-process broadcast (Redis pub/sub).** SSE in v1 is in-process — fine while we run a single Journal container. When we go multi-process we'll need Redis (or equivalent) to fan out events across processes; tracked as a follow-up.
- **Live updates on the `/notifications` page itself.** SSE drives only the navbar badge in v1. If you're sitting on `/notifications`, new rows show up on next navigation/refresh. Live-prepending rows is straightforward to add later but not core to closing the social loop.
- **Notifications about routes.** Activities are the primary social-feed object; routes get linked from activities, so route-level notifications would mostly duplicate.
- **Notifications about replies / mentions / reactions.** trails.cool doesn't have any of these surfaces yet.
- **Cross-instance (federated) notifications.** The fan-out runs only against the local `follows` table. When `social-federation` lands, the remote half is its own design problem (push to remote inboxes vs. let remote instances poll us — handled there).

## Capabilities

### New Capabilities

- `notifications`: the `notifications` table, the `/notifications` page, the unread badge, and the generation hooks for the three v1 types.

### Modified Capabilities

- `social-follows`: existing `approveFollowRequest` and `followUser` (public-path) calls emit notifications. Existing follow lifecycle is unchanged.
- `activity-feed`: existing `createActivity` flow emits the fan-out notifications when `visibility = 'public'`. The notification rows live in `notifications`, separate from the `/feed` query.
- `journal-landing`: navbar gets a bell entry alongside the existing follow-requests badge.

## Impact

- **Code**: new `notifications` table (Drizzle + migration), `notifications.server.ts` (`createNotification` / `listForUser` / `markRead` / `markAllRead` / `countUnread`) plus a `linkFor(notification): { web, mobile, email }` helper consulted by every renderer. Generation hooks wired into `follow.server.ts` and `activities.server.ts` populate `subject_id` + a versioned `payload` snapshot at create time. New `/notifications` route. pg-boss recurring + on-demand jobs for activity fan-out. Plus an in-process **events broker** (`events.server.ts`) — a `Map<userId, Set<{controller, lastEventId}>>` plus `emitTo(userId, event)` — that the generation hooks call to broadcast over open SSE connections.
- **API**: `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`. New `GET /api/events` (SSE, session-bound) streaming `notifications.unread { count }` events. Loader-driven counts in the navbar (root loader extended) remain the source of truth on initial render and after navigation.
- **Client**: a small `useEventStream` hook wired into the root layout. Opens an `EventSource` for signed-in users, listens for `notifications.unread` events, and updates the navbar badge in place. Auto-reconnects (browser native EventSource behavior + a server-suggested `retry:` interval).
- **UI**: `/notifications` page with notification cards, "Mark all read" control, bell-style nav entry with unread count badge.
- **Operational**: fan-out-on-write for activity_published creates one row per accepted follower at activity-create time. At trails.cool's current scale this is trivial; if a user with 10k followers posts, that's 10k inserts in a single pg-boss job. Documented as the scaling line we'd revisit before we ever cross it. SSE adds a long-lived HTTP connection per signed-in tab; ~5–10 KB memory per connection. Caddy needs no special config beyond enabling text/event-stream pass-through (it already does). On deploy every connection drops and reconnects with jittered backoff; no special handling needed.
- **Privacy manifest**: documents the new `notifications` relation and the retention policy (default: keep until user marks read or 90 days, whichever later — implementation detail in design.md).
- **Dependencies**: none new; pg-boss is already in the stack.
- **Forward-compat**: when `social-federation` lands, remote `Accept(Follow)` activities can emit a local `follow_request_approved` notification using the same row shape — `actor_user_id` would become nullable and the IRI of the remote actor goes into `subject_id` (or a denormalized `actor_iri` column added at that time). Schema is reasonably stable. The events broker stays single-process; when the Journal goes multi-process we swap the in-process `Map` for a Redis pub/sub adapter behind the same `emitTo(userId, event)` interface.
