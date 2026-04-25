## Context

After `social-feed` (PR #310, locked-account model), the Journal has two distinct surfaces for "user owes attention to something":

- **`/follows/requests`** — Pending incoming follows the user can act on. The navbar already shows a count badge.
- **No surface yet** — anything that already happened (your follow request was approved, someone followed you, a friend posted a public activity).

The follow-request badge covers the "act on this" case. This change adds the "be informed about this" case — historical, read-once notifications for events the user couldn't have triggered themselves.

## Goals / Non-Goals

**Goals:**
- A user can see a chronological list of recent things that happened to them on the instance (follow approved/received, friend posted public activity).
- The navbar surfaces an unread count so users know there's something new without visiting `/notifications` first.
- Generation is centralized — three call sites (approve, follow public, create public activity) own the entire notification stream in v1.
- Mark-as-read is per-row and bulk; once read, the row stays around for ~90 days for context but doesn't contribute to the unread badge.
- The `/feed` page and the `/notifications` page have **distinct** purposes — feed is "content from people I follow," notifications are "events that happened to me."

**Non-Goals:**
- Per-type notification preferences (mute "follow received" only). Single global default-on. A future change adds settings.
- Email digests / push notifications / real-time WebSocket delivery.
- Notifications about routes (activities are the unit), replies, mentions, reactions — none of those surfaces exist yet.
- Federation. v1 fans out only against local `follows`; remote inbound is `social-federation`'s job.

## Decisions

### Decision: Fan-out-on-write for `activity_published`, single row for the others

Two notification origins:

- **`follow_request_approved`** and **`follow_received`** are 1:1 events — a single row goes to a specific user at the moment of the action. Direct insert in the same request as the follow API.
- **`activity_published`** is 1:N — when a user publishes a public activity, every accepted follower needs a row. Fan-out happens in a pg-boss job (`fanout-activity-notifications`) so the API request that created the activity returns immediately; the job inserts N notification rows asynchronously.

**Why fan-out-on-write rather than read-time join:** read-time would mean every load of `/notifications` joins `follows × activities × marks-read`, which is doable but doesn't compose with bulk "mark all read" (you'd need a per-(follower, activity) read-state row anyway). Fan-out gives us simple per-row semantics and reuses one query path for all notification types. At trails.cool's scale (hundreds of users, occasional public activities), the cost is dwarfed by what the activity-creation handler already does.

**Cost ceiling:** at 10k followers × 50 activities/day = 500k inserts/day. Still trivial for Postgres; if it ever becomes hot, batch insert or move to a per-user "last-seen-cursor" model. Not a concern in this change; called out so future-us has the explicit waiver.

### Decision: Schema — single table, loose `subject_id`, versioned `payload` snapshot

```sql
CREATE TABLE journal.notifications (
  id UUID PRIMARY KEY,
  recipient_user_id TEXT NOT NULL REFERENCES journal.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                    -- 'follow_request_received' | 'follow_request_approved' | 'follow_received' | 'activity_published'
  actor_user_id TEXT REFERENCES journal.users(id) ON DELETE SET NULL,
  subject_id TEXT,                       -- type-dependent: follow row id, activity id
  payload JSONB,                         -- denormalized snapshot for offline renderers (mobile push, email)
  payload_version INT NOT NULL DEFAULT 1, -- per-type payload schema version
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_recipient_unread_idx
  ON journal.notifications(recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX notifications_recipient_created_idx
  ON journal.notifications(recipient_user_id, created_at DESC);
```

**Why one table, not per-type:** all four v1 types have small, similar shapes (IDs + a tiny payload). One table keeps the unread count + listing query trivial (`SELECT … WHERE recipient_user_id = ? ORDER BY created_at DESC`). When/if types diverge (rich payload, scheduled notifications, etc.), we re-evaluate.

**Why loose `subject_id` (not a discriminator + per-type FK):** the renderer dereferences by `type` anyway. A typed FK would force NULL columns for every notification of the wrong type and add four FK constraints we can't fully populate. Loose is simpler. Renderer is responsible for graceful "missing referent" (activity deleted, follow undone) — same pattern Mastodon uses.

**Why `actor_user_id` nullable + ON DELETE SET NULL:** if the actor account is deleted, we keep the notification row but show "someone" rather than dropping the user's history. This is a small detail but matters for "someone followed you 6 months ago" types of records.

### Decision: Versioned per-type `payload` snapshot for offline renderers

`payload` (JSONB, nullable) holds a small bag of denormalized fields needed to render the notification *without* a live DB lookup. `payload_version` (INT, default 1) lets us evolve the per-type payload schema additively without breaking old rows.

**Per-type v1 payload shapes:**

```ts
// follow_request_received | follow_received
type FollowPayloadV1 = {
  followerUsername: string;       // e.g., "alice"
  followerDisplayName: string | null;
};

// follow_request_approved
type ApprovalPayloadV1 = {
  targetUsername: string;
  targetDisplayName: string | null;
};

// activity_published
type ActivityPayloadV1 = {
  activityId: string;
  activityName: string;
  ownerUsername: string;
  ownerDisplayName: string | null;
};
```

The web renderer prefers **live data** when the subject is still reachable (current display name, current activity title) and falls back to the snapshot when the subject is missing. Mobile push / email renderers (later) read the snapshot directly — they don't have a session to dereference live data anyway, and a slightly stale display is better than a refetch round-trip per push.

**Why a separate `payload_version` column** rather than embedding `_v` in the JSON:
- Cheap to query "anything still on v1" without JSONB extraction.
- Indexable if we ever need to.
- Explicit at the schema layer: it's clearly a versioning concern, not application data.
- Cost: one INT column. Trivial.

**Forward path for schema evolution (e.g., bumping `activity_published` to v2 with a `distance` field):**
1. Bump `payload_version` to 2 in the generation hook for new rows.
2. Update renderer to handle both v1 (no `distance`) and v2 (with `distance`).
3. Optionally backfill — usually unnecessary for notifications because retention ages out v1 rows naturally (read rows in 90 days; unread rarely hangs around that long).

If at some point we want to *remove* fields, that's a v3 bump and a renderer that handles all three. Same pattern as any forward-compatible API.

### Decision: A single `linkFor(notification)` helper produces per-platform deep links

Every renderer (web loader, future mobile push formatter, future email formatter) calls one helper:

```ts
// apps/journal/app/lib/notifications/link-for.ts (sketch)
export type LinkBundle = {
  web: string;        // path-relative for in-app navigation
  mobile?: string;    // trails:// scheme for native deep linking
  email?: string;     // absolute https:// URL for email click-through
};

export function linkFor(n: NotificationRow): LinkBundle {
  const origin = process.env.ORIGIN ?? "https://trails.cool";
  switch (n.type) {
    case "follow_received":
    case "follow_request_received":
    case "follow_request_approved": {
      const username = n.payload?.followerUsername ?? n.payload?.targetUsername;
      const path = n.type === "follow_request_received" ? "/follows/requests" : `/users/${username}`;
      return { web: path, mobile: `trails:/${path}`, email: `${origin}${path}` };
    }
    case "activity_published": {
      const activityId = n.subject_id ?? n.payload?.activityId;
      const path = `/activities/${activityId}`;
      return { web: path, mobile: `trails://activities/${activityId}`, email: `${origin}${path}` };
    }
  }
}
```

**Why one helper, called from many renderers:** keeps the type→URL mapping in exactly one place. Adding a new platform (mobile, email, RSS, ActivityPub) means adding a new field to `LinkBundle` and a new branch — but the type discrimination stays in one file.

**Why the helper consults both `subject_id` and `payload`:** subject_id is the canonical reference; payload is the fallback when subject_id is null or the live record is gone. The helper's behavior is "use whichever is available" so the URL always builds.

**Why URL paths and not pre-rendered URLs:** route renames in the future can update the helper in one place; old notification rows continue to deep-link correctly because they don't store the URL string.

### Decision: Retention — keep read notifications for 90 days

Notifications older than 90 days AND already read are deleted by a daily pg-boss job. Unread notifications are kept indefinitely (so they don't silently disappear from the user's "needs attention" view). This bounds table growth without surprising users.

**Alternative considered:** keep everything forever. Rejected — at activity-fan-out scale the table grows fast and we don't need a permanent log; if we ever need notification history beyond 90 days it'd be surfacing a different thing (an audit log, not a user inbox).

### Decision: Two distinct nav entries — Follow requests + Notifications

Pending follow requests stay on their own `/follows/requests` page with their own count badge; this change adds a separate Notifications entry with a separate unread count.

**Why not unify:** they're semantically different — one is "you can take an action right now (approve/reject)," the other is "this already happened, no action required from you." Merging would conflate them and force us to handle approve/reject inline in the notifications view, which is more UX surface than the value of one fewer nav entry.

**Alternative considered:** one bell that combines both counts. Rejected for the reason above; revisit if user feedback pushes for it.

### Decision: `follow_request_received` lives in *both* surfaces with independent read-state

A new pending follow request is both an "act on this" event (for `/follows/requests`) and a "this happened" event (for `/notifications`). We surface it on both: the request appears on `/follows/requests` with Approve / Reject buttons (count badge increments), AND a `follow_request_received` notification is created (notifications-unread count also increments).

The two surfaces have **independent read-state**:
- Marking the notification read does NOT approve / reject / acknowledge the request.
- Approving or rejecting the request does NOT mark the notification read. The notification stays as a historical record ("Alice asked to follow you on April 24") regardless of how you handled the request.
- If the requester cancels their pending follow before action, the notification still stays — the event is a true historical fact.

**Why both:** users who only check `/notifications` (informational inbox) shouldn't miss requests; users who only check `/follows/requests` (actionable queue) shouldn't see redundant cruft. Surfacing in both with independent read-states is the lowest-surprise behavior — same pattern Mastodon uses.

**Why independent state:** approving a request is its own user intent; reading the notification card is its own user intent. Coupling them ("approve auto-clears the notification") would feel magical and would prevent users from approving the request now and then reviewing the historical record later.

**Renderer responsibility:** the notification card for `follow_request_received` shows a "Review request" CTA that links to `/follows/requests`, not Approve / Reject inline. Approve / Reject lives in exactly one place.

### Decision: Notifications surface only what already happened — no preview content snapshotting

A notification stores `(recipient, type, actor, subject)` and the renderer fetches the live referent at display time (e.g., the activity's name). We don't snapshot the activity title into the notification row.

**Why:** if the activity is later renamed or made private, we want the notifications view to reflect current state. The renderer should gracefully handle "activity is now private and recipient can't see it" (filter from the list, or render a generic "an activity" line — pick at implementation time, lean filter).

**Side effect:** if a user makes their activity `unlisted` after publishing, fan-out notifications still exist as rows, but renders skip those rows for visibility-gated viewers. Acceptable v1 behavior.

### Decision: Loader-driven count + Server-Sent Events for between-navigation freshness

The unread count is computed in the root loader on every navigation (one cheap aggregate query against the partial `read_at IS NULL` index) — that's the source of truth on initial render. On top, a simple SSE channel pushes count updates to open browser tabs so the badge stays current while the user sits on a page.

**Why SSE, not WebSockets:** notifications are a one-way push from server → client. SSE is exactly that. It rides over plain HTTP (no protocol upgrade), browsers ship native `EventSource` with built-in reconnect, and Caddy proxies `text/event-stream` without any special config. WebSockets would buy us bidirectionality we don't need plus more reconnection plumbing on the client.

**Why both loader + SSE, not SSE alone:** loader-driven gives us a deterministic count at every page render and a clean fallback when SSE is unavailable (proxies, locked-down networks, browser tab put-to-sleep). SSE just keeps the value fresh in between. If the SSE connection dies, the next navigation refreshes the badge — no broken-state recovery needed.

**Transport details:**

- **Endpoint**: `GET /api/events` returning `Content-Type: text/event-stream` with `Cache-Control: no-cache`. Session-auth via cookie; anonymous returns 401 (no event stream).
- **Heartbeat**: server emits `: ping\n\n` comments every 25 s to keep idle connections alive through any intermediate proxy timeouts.
- **Reconnect hint**: server sends `retry: 5000\n` so EventSource backs off 5 s on disconnect (browser default is ~3s). Server adds 0–2 s jitter on the *server side* by spacing out reconnect-suggested retry hints during a deploy storm.
- **Event format**:
  ```
  event: notifications.unread
  data: {"count": 7}

  ```
  Single event type in v1; client just sets the navbar badge to `count`. New event types extend the protocol additively.

**Server registry (events broker):**

```ts
// apps/journal/app/lib/events.server.ts
type Connection = { send: (event: string, data: unknown) => void; close: () => void };
const connections = new Map<string /* userId */, Set<Connection>>();
export function register(userId: string, conn: Connection) { /* add + setup teardown */ }
export function emitTo(userId: string, event: string, data: unknown) {
  for (const c of connections.get(userId) ?? []) c.send(event, data);
}
```

Generation hooks (`createNotification`, the fan-out job) call `emitTo(recipientId, "notifications.unread", { count })` after the row insert commits. The aggregate count query is small enough to run per-emit; if it ever becomes hot we cache the count per user in memory and increment on emit.

**Client hook:**

```ts
// app/hooks/useUnreadNotifications.ts (sketch)
const [count, setCount] = useState(initialFromLoader);
useEffect(() => {
  if (!signedIn) return;
  const es = new EventSource("/api/events");
  es.addEventListener("notifications.unread", (e) => setCount(JSON.parse(e.data).count));
  return () => es.close();
}, [signedIn]);
```

EventSource auto-reconnects on transient disconnects; we just open and close.

**Cleanup**: when the response stream ends (client navigates away, tab closes, network drops), we remove the connection from the registry. We also run a periodic `setInterval` GC pass that drops connections whose last heartbeat write failed (defensive; ideally not needed).

**Single-process today, Redis-pub/sub when we go multi-process.** The `emitTo(userId, event, data)` interface is the swap point — the in-process `Map` becomes a Redis subscriber that listens to per-user channels, and `emitTo` becomes a publish. The hooks don't change.

### Decision: Cursor-based pagination for `/notifications`

`listForUser` accepts an opaque `before` cursor (`base64url(JSON{ts, id})`) and orders rows by `(created_at DESC, id DESC)`. `id` is a tiebreaker for rows with identical `created_at`, so two callers paging through the list see neither duplicates nor gaps even if a fan-out job inserted a hundred rows at the same instant. Default page size is 50, hard-capped at 100.

**Why cursor, not page-offset:** notifications grow at the head, not the tail — every new event prepends a row. A page-offset query (`OFFSET 50`) would shift under the user as new rows arrive, causing duplicates on page 2. Cursor pagination pins the boundary to a stable position in the data. It also matches the partial unread index (`(recipient_user_id, created_at DESC)`) without needing `OFFSET`'s implicit table scan.

**Why opaque (base64-encoded JSON) over raw `(ts, id)` query params:** clients should not have to know or validate the cursor format. We get to evolve the encoding (e.g. add a `version` field, or include `read_at` for unread-only feeds) without breaking deep links. A malformed cursor is treated as "start from the top" rather than 400, so an old saved URL still renders something useful.

**No total count, deliberately:** the page shows "Load older" while a `nextCursor` exists; once the cursor is `null`, the user has reached the bottom. Computing a total `COUNT(*)` per page load would defeat the cheap-pagination win and is only useful for a "page 5 of 12" UI that we're not building.

## Risks / Trade-offs

- **Activity fan-out spam**: a user with thousands of followers posting a public activity creates thousands of rows. → At our scale this is invisible; the cost ceiling is documented above. If we ever need to soften, batch the inserts or move to read-time.
- **Stale referents**: notification points at an activity that's since been deleted or made private. → Renderer filters out rows whose referent the viewer can't see; absolute deletes (the activity is hard-deleted) leave a row that the renderer turns into a generic "an activity" line or just skips. Implementation tweak.
- **Notification storm on first follow** (auto-accept of a public profile that subsequently posts a flurry): expected behavior; users can mark all read.
- **Privacy concern**: notifications retain that "User A followed User B at time T" beyond what the public follower lists already show. → Documented in privacy manifest. The retention window is 90 days (read) / indefinite (unread); user can mark all read to age them out.
- **Duplicate suppression**: re-following someone after unfollowing should not produce a duplicate `follow_received`. → followUser is idempotent at the DB level (returns existing state), so the notification path only fires on actual transitions; documented in tasks.
- **SSE deploy storm**: every deploy disconnects all open connections; clients reconnect at once. → EventSource reconnects with the server-suggested `retry:` interval (5 s) plus 0–2 s server-jitter. At trails.cool's connected-tab count this is fine; revisit with a `Connection: close + Retry-After` header strategy if we ever see a thundering-herd issue.
- **SSE memory leak from forgotten connections**: a connection stuck open with no heartbeat reaching the client wastes memory. → Server emits `: ping` every 25 s; if the write fails (broken pipe), we drop the connection from the registry. Periodic GC pass as defense in depth.
- **Multi-process scale ceiling**: in-process broadcast means a user connected to process A can't be reached from process B once we go multi-process. → Today we're single-process, so it's a non-issue. When that changes, swap the registry's `Map` for a Redis pub/sub adapter behind the same `emitTo` interface — additive, no caller changes. Explicitly tracked as a follow-up.
- **SSE blocked by intermediate proxies / corporate networks**: some networks kill long-lived HTTP. → Falls back gracefully — the loader-driven count refreshes on every navigation, so the user just sees a slightly-stale badge until they click a link. Acceptable v1 behavior.

## Migration Plan

1. Land schema additively via `drizzle-kit push --force` (new table, no row changes).
2. Wire the three generation hooks. New code paths only — no behavior change for existing flows besides the side-effect of inserting rows.
3. Add `/notifications` route + nav entry + unread count in root loader.
4. Add the daily retention pg-boss job.
5. Update privacy manifest.
6. Rollback: revert PR. Drop `journal.notifications` and remove the column-less hooks. No data dependencies.

## Open Questions

- **Bell icon vs. labelled "Notifications" link in nav**: minor UX call; lean labelled-link to match the existing nav style (no icons elsewhere). Implementation phase decides.
- **Click-through behavior for `activity_published`**: clicking should both mark the row read and navigate to the activity. A single anchor with a server-side "redirect after mark-read" works; or a client-side fetch + navigation. Tasks phase picks.
- **What happens to a user's notifications when they delete their account?** Cascade-delete via the recipient FK — implemented automatically. Documented.
- **Should `/notifications` itself live-update via SSE?** Out of scope for v1 (the badge is the only thing that updates live; the page reloads on navigation). Worth revisiting if users complain that they sit on the page and miss new rows. Adding it later is a small follow-up — the same SSE event fires; the `/notifications` route subscribes and prepends the row.
- **Event payload size**: v1 sends just `{ count }`. If we want richer payloads later (the new notification's preview text, type, actor name) we extend the event format additively — no protocol break. Lean: keep it small for v1.
