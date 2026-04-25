## 1. Schema

- [ ] 1.1 Add `journal.notifications` table to `packages/db/src/schema/journal.ts`: `id UUID PK`, `recipient_user_id TEXT NOT NULL FK users ON DELETE CASCADE`, `type TEXT NOT NULL`, `actor_user_id TEXT FK users ON DELETE SET NULL`, `subject_id TEXT`, `payload JSONB`, `payload_version INT NOT NULL DEFAULT 1`, `read_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Indexes: `(recipient_user_id, created_at DESC)` and a partial `(recipient_user_id, created_at DESC) WHERE read_at IS NULL` for fast unread counts
- [ ] 1.2 Run `pnpm db:push` locally and confirm the migration is clean
- [ ] 1.3 Update privacy manifest entry: documents the `notifications` relation, the per-type payload snapshot fields, and the 90-day read-retention policy

## 2. Server library

- [ ] 2.1 Create `apps/journal/app/lib/notifications.server.ts` with: `createNotification`, `listForUser(userId, { page })`, `countUnread(userId)`, `markRead(ownerId, id)`, `markAllRead(ownerId)`, `purgeReadOlderThan(days)`. `createNotification` accepts a typed payload + version per type — TS unions enforce per-type shapes at the call site
- [ ] 2.2 Define per-type payload TypeScript types (`FollowPayloadV1`, `ApprovalPayloadV1`, `ActivityPayloadV1`) in `apps/journal/app/lib/notifications/payload.ts`. Each generation hook writes `payload_version = 1` plus the matching shape
- [ ] 2.3 Create `apps/journal/app/lib/notifications/link-for.ts` with `linkFor(notification): LinkBundle` returning `{ web, mobile?, email? }` — handles all four v1 types; consults `subject_id` first, falls back to `payload` fields
- [ ] 2.4 Make `markRead` and `markAllRead` owner-bound (predicate includes `recipient_user_id = ownerId`)
- [ ] 2.5 Unit / integration tests for each helper (`notifications.integration.test.ts` gated on `NOTIFICATIONS_INTEGRATION=1`, mirroring the demo-bot pattern)
- [ ] 2.6 Unit tests for `linkFor` covering all four types + the `subject_id` vs. `payload` fallback path

## 3. Generation hooks (1:1)

- [ ] 3.1 Wire `followUser` (Pending path against private target — `accepted_at = NULL` newly-created row) to insert a `follow_request_received` notification with payload `{ followerUsername, followerDisplayName }` (v1)
- [ ] 3.2 Wire `followUser` (auto-accept path against public target — `accepted_at = now()` newly-created row) to insert a `follow_received` notification with payload `{ followerUsername, followerDisplayName }` (v1)
- [ ] 3.3 Wire `approveFollowRequest` to insert a `follow_request_approved` notification on success with payload `{ targetUsername, targetDisplayName }` (v1) — no-op on idempotent re-approval per the existing return-false path
- [ ] 3.4 Confirm by integration test that approving an already-accepted row, re-following an existing follow, or following the same user twice in a row does NOT create duplicate notifications (the followUser idempotent return-existing-state branch must NOT emit)

## 4. Generation hooks (fan-out)

- [ ] 4.1 Add pg-boss recurring (or one-off-per-activity) job `fanout-activity-notifications` that takes `activityId` and inserts `activity_published` rows with payload `{ activityId, activityName, ownerUsername, ownerDisplayName }` (v1) for every accepted follower of the activity's owner
- [ ] 4.2 Wire `createActivity` to enqueue the fan-out job iff `visibility === 'public'` after the activity row is committed (no fan-out if the create transaction rolls back)
- [ ] 4.3 Integration test: a user with N accepted followers + M Pending followers creates a public activity → exactly N rows are inserted, all with payload populated
- [ ] 4.4 Integration test: a private or unlisted activity does NOT fan out
- [ ] 4.5 Test: idempotency — re-running the same fan-out job (e.g. retry after partial failure) doesn't double-insert. Use `(recipient_user_id, type, subject_id)` as a soft uniqueness check, OR rely on the worker's at-least-once retry semantics + an upsert / unique index for `(recipient_user_id, type, subject_id)` on `activity_published`-type rows. Pick during implementation.

## 4b. SSE events broker + endpoint

- [ ] 4b.1 Create `apps/journal/app/lib/events.server.ts`: in-process registry of `Map<userId, Set<Connection>>` plus `register(userId, conn)` and `emitTo(userId, event, data)`. Connection abstracts a `send(event, data)` that writes a `text/event-stream` chunk and a `close()` for cleanup. Includes an internal heartbeat tick (25s) per connection that writes `: ping\n\n` and prunes connections whose `send` throws (broken pipe)
- [ ] 4b.2 Create `apps/journal/app/routes/api.events.ts`: GET handler returning a streaming `Response` with `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`. Session-bound; anonymous returns 401. On open, registers the connection and emits an initial `notifications.unread { count }` event so the badge reflects current state immediately
- [ ] 4b.3 Wire `createNotification` to call `emitTo(recipientId, "notifications.unread", { count: <fresh count after insert> })` after the row commits. Same for the fan-out job (one emit per recipient)
- [ ] 4b.4 Wire `markRead` and `markAllRead` to emit a refreshed `notifications.unread { count }` so the badge clears live
- [ ] 4b.5 Caddy config check: confirm `text/event-stream` is passed through without buffering. Document if any tweak is needed (proxy_buffering off equivalent for Caddy)

## 4c. SSE client hook

- [ ] 4c.1 Create `apps/journal/app/hooks/useUnreadNotifications.ts` that, when signed in, opens an `EventSource("/api/events")`, listens for `notifications.unread`, and returns the live `count`. Initial value comes from the loader (root) so the badge renders correctly before the SSE handshake completes
- [ ] 4c.2 Use the hook in the navbar to drive the unread-count badge. The loader-supplied count is the SSR baseline; the hook overrides on first event
- [ ] 4c.3 EventSource native auto-reconnect handles transient disconnects. Add a `retry: 5000` directive to the SSE response so deploy-storm reconnects spread out a bit; add 0–2s server-side jitter to the retry hint
- [ ] 4c.4 E2E (Playwright): open two browser contexts as the same user, trigger a follow against that user from a third context, and assert the navbar badge increments without a navigation in either watching context

## 5. Routes + UI

- [ ] 5.1 New `/notifications` route (signed-in only; redirect anonymous to `/auth/login`). Loader fetches `listForUser(currentUser.id, { page: 1 })` and `countUnread(currentUser.id)`
- [ ] 5.2 Render: list of cards. Each card shows the actor's display name + handle (live where available, payload-snapshot fallback if the actor row is gone), a type-specific summary line (i18n keyed), the timestamp, and an action whose href comes from `linkFor(notification).web`. Unread cards are visually distinct (e.g. background tint + unread dot)
- [ ] 5.3 Implement click-through: clicking a card POSTs to `/api/notifications/:id/read` and then navigates to `linkFor(notification).web`. Server-side redirect after mark-read is the simplest path
- [ ] 5.4 "Mark all read" button at the top of the page; clicking POSTs to `/api/notifications/read-all` and the page reloads with empty unread state
- [ ] 5.5 Empty state: "No notifications yet" + a hint about what kinds of events produce them
- [ ] 5.6 Renderer guard: skip notification rows whose subject the recipient can no longer see (e.g. activity made private, activity deleted). Filter at server-side for `activity_published` by joining with `activities WHERE visibility='public'` (and also surface "you saw this earlier" if the activity was public when the notification was created — actually filter, not gracefully degrade, per the design decision)

## 6. API endpoints

- [ ] 6.1 `POST /api/notifications/:id/read` — session-bound, owner-bound; returns 200 on success, 404 if the row doesn't exist or doesn't belong to the caller. Idempotent for already-read rows
- [ ] 6.2 `POST /api/notifications/read-all` — session-bound, marks every unread notification of the caller as read; returns 200 with the affected count
- [ ] 6.3 Register both in `apps/journal/app/routes.ts`

## 7. Navbar entry + unread count

- [ ] 7.1 Extend the root loader to also compute `notificationsUnreadCount` for signed-in users (single aggregate query against the partial unread index)
- [ ] 7.2 Add a "Notifications" link to the navbar — distinct from "Follow requests" — with a small red count badge when unread > 0
- [ ] 7.3 i18n strings for nav entry, page title, type-specific summary lines, empty state, "Mark all read" button

## 8. Retention

- [ ] 8.1 pg-boss recurring job `purge-read-notifications` running daily that calls `purgeReadOlderThan(90)`
- [ ] 8.2 Integration test: read row aged > 90 days is purged; unread row of any age is NOT

## 9. Testing

- [ ] 9.1 Unit / integration: helpers in `notifications.server.ts` (CRUD + unread count + mark-read owner-bound + mark-all-read scope)
- [ ] 9.2 Integration: generation hooks (approve, follow auto-accept, public-activity fan-out)
- [ ] 9.3 E2E: register two users; A follows B (public path) → B sees a `follow_received` notification on `/notifications` with the correct actor and link
- [ ] 9.4 E2E: register two users; A's profile is private; B requests; A approves → B sees a `follow_request_approved` notification linking to A's profile
- [ ] 9.5 E2E: navbar unread badge increments and clears via Mark all read
- [ ] 9.6 E2E: anonymous request to `/notifications` redirects to login

## 10. Rollout

- [ ] 10.1 Schema ships via `drizzle-kit push --force` — additive only
- [ ] 10.2 Feature lands behind no flag (additive surface; users with no notifications see an empty page until events fire)
- [ ] 10.3 Post-deploy smoke: from a test account, follow bruno (public auto-accept) → check `/notifications` shows the row on bruno's account (need to be logged in as bruno briefly, or seed a notification by hand against your own account by acting as the followed party)
- [ ] 10.4 (Follow-up change) Notification preferences (per-type mute) — not in this change
- [ ] 10.5 (Follow-up change) Real-time delivery via SSE / WebSocket — not in this change
