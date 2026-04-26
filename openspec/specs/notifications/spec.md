# notifications Specification

## Purpose
In-app notifications for things that happened to a user that they didn't trigger themselves: their follow request was approved, someone followed them, a friend posted a public activity. Distinct from `/follows/requests` (which is the actionable surface for *incoming* Pending requests) and `/feed` (which is content from people you follow). Includes the `notifications` table, generation hooks, the `/notifications` page, mark-read APIs, retention, and the SSE-driven live unread badge (the SSE transport itself lives in `sse-broker`).

## Requirements

### Requirement: Notification rows for follow + activity events
The Journal SHALL maintain a `notifications` table where each row records a single event the recipient should be informed about. Four event types SHALL be produced in v1: `follow_request_received`, `follow_request_approved`, `follow_received`, and `activity_published`. Each row SHALL include the recipient user, the actor (the user who caused the event, nullable for system or deleted-actor cases), a `subject_id` whose meaning depends on type (follow row id for follow events; activity id for activity events), a `payload` JSONB snapshot of the renderer-friendly fields at create time, and a `payload_version` (INT, default 1) that documents the per-type payload schema version. Rows SHALL track read state via a nullable `read_at` timestamp.

#### Scenario: Pending follow request emits a notification to the target
- **WHEN** `followUser` creates a Pending row against a private target
- **THEN** a `follow_request_received` notification is created with `recipient_user_id` = the followed user, `actor_user_id` = the requester, `subject_id` = the follow row id

#### Scenario: Approval emits a notification to the requester
- **WHEN** `approveFollowRequest` succeeds against a Pending row
- **THEN** a `follow_request_approved` notification is created with `recipient_user_id` = the follower, `actor_user_id` = the followed user, `subject_id` = the follow row id

#### Scenario: Auto-accepted public follow emits a notification to the target
- **WHEN** `followUser` creates an accepted row against a public target (auto-accept path)
- **THEN** a `follow_received` notification is created with `recipient_user_id` = the followed user, `actor_user_id` = the follower, `subject_id` = the follow row id

#### Scenario: Public activity creation fans out notifications to followers
- **WHEN** a user creates an activity with `visibility = 'public'`
- **THEN** a pg-boss job is enqueued that inserts an `activity_published` notification per accepted follower with `recipient_user_id` = follower, `actor_user_id` = activity owner, `subject_id` = activity id

#### Scenario: Re-following does not duplicate the notification
- **WHEN** a user calls `followUser` against a target they already follow (returns existing state without creating a new row)
- **THEN** no new `follow_received` or `follow_request_received` notification is created

#### Scenario: follow_request_received survives request resolution
- **WHEN** a target approves, rejects, or the requester cancels a Pending follow that previously emitted `follow_request_received`
- **THEN** the `follow_request_received` notification row stays in the database with its existing read-state intact (the event happened; the historical record is preserved independently of the request's eventual outcome)

#### Scenario: follow_request_received card links to /follows/requests, not inline Approve/Reject
- **WHEN** a recipient renders a `follow_request_received` notification on `/notifications`
- **THEN** the card shows a "Review request" link that navigates to `/follows/requests`; Approve / Reject buttons are NOT rendered on `/notifications`

#### Scenario: Read-state is independent from request resolution
- **WHEN** a recipient marks a `follow_request_received` notification read OR approves/rejects the request
- **THEN** the OTHER surface is unaffected — marking read does not approve/reject; approve/reject does not mark the notification read

### Requirement: Versioned payload snapshot for offline renderers
Each notification row SHALL include a `payload` (JSONB) capturing the denormalized fields needed to render the row without a live DB lookup, and a `payload_version` (INT) recording the per-type schema version of `payload`. The web renderer SHALL prefer live data when the subject is still reachable and SHALL fall back to the payload when the subject has been deleted, gone private, or is otherwise unreachable. Future renderers (mobile push, email) SHALL read the payload directly.

#### Scenario: follow notifications snapshot the follower / target
- **WHEN** a `follow_request_received`, `follow_received`, or `follow_request_approved` notification is created
- **THEN** the row's `payload` records the relevant party's `username` and `displayName`, and `payload_version = 1`

#### Scenario: activity_published snapshots the activity + owner
- **WHEN** an `activity_published` notification is created
- **THEN** the row's `payload` records `activityId`, `activityName`, `ownerUsername`, and `ownerDisplayName`, and `payload_version = 1`

#### Scenario: Web renderer falls back to snapshot if subject is unreachable
- **WHEN** a recipient renders a notification whose subject (e.g. activity) has been deleted or made private since creation
- **THEN** the renderer uses the `payload` fields (e.g. activity name from the snapshot) so the row still has meaningful copy; click-through degrades gracefully (the link target may 404, which the user sees once they click)

### Requirement: Single `linkFor` helper produces per-platform deep links
The Journal SHALL expose a single server-side helper `linkFor(notification)` returning a `LinkBundle` with at minimum a `web` path and (for forward-compat) `mobile` and `email` URL variants. Every renderer (web loader, future mobile push formatter, future email formatter) SHALL use this helper so the type-to-URL mapping lives in exactly one file.

#### Scenario: Web loader resolves a click-through link
- **WHEN** the `/notifications` loader prepares a row for render
- **THEN** the row carries `linkFor(row).web` so the card's anchor can navigate to the right page (`/activities/...`, `/users/...`, or `/follows/requests`)

#### Scenario: Helper builds links from subject_id with payload fallback
- **WHEN** `linkFor` is invoked on a notification whose `subject_id` is non-null
- **THEN** the path is built from `subject_id`; if `subject_id` is null, the helper falls back to the relevant `payload` field (e.g. `payload.activityId`)

#### Scenario: Helper outputs a `trails://` mobile scheme
- **WHEN** `linkFor` is invoked for any v1 notification type
- **THEN** the returned `LinkBundle.mobile` is a `trails://` URL pointing at the same logical destination as `web`

#### Scenario: Activity changing to private after publish
- **WHEN** an activity that already triggered fan-out notifications is later changed from `public` to `private`
- **THEN** the existing notification rows remain in the database but are filtered out of the recipient's `/notifications` listing (the renderer skips rows whose subject the recipient can no longer see)

### Requirement: Notifications page and unread count
The Journal SHALL expose `/notifications` to signed-in users only. The page SHALL list the user's notifications reverse-chronological, with each row showing the actor's display name + handle, a type-specific summary line, the timestamp, and a clickable link to the relevant subject. The page SHALL paginate via opaque cursor (a `before` query parameter); when more rows exist past the current page, the page SHALL surface a "Load older" affordance that fetches the next page using the cursor. Page size defaults to 50 and is capped at 100. The navbar SHALL surface an unread count badge linking to `/notifications`; the count is `notifications.read_at IS NULL` for the current user. Logged-out visitors requesting `/notifications` SHALL be redirected to `/auth/login`. The live-update transport for the unread badge is `sse-broker` (`/api/events`); this spec only requires the badge to reflect the count.

#### Scenario: Logged-in user with notifications
- **WHEN** a signed-in user with N notifications (N ≤ page size) loads `/notifications`
- **THEN** the page lists all N rows reverse-chronological by `created_at`, with unread rows visually distinct from read rows

#### Scenario: Logged-in user with no notifications
- **WHEN** a signed-in user with zero notifications loads `/notifications`
- **THEN** the page renders an empty-state message

#### Scenario: Anonymous request
- **WHEN** an unauthenticated visitor requests `/notifications`
- **THEN** they are redirected to `/auth/login`

#### Scenario: Navbar badge reflects unread count
- **WHEN** a signed-in user has K > 0 unread notifications
- **THEN** the "Notifications" navbar entry renders with a count badge showing K
- **AND** when K = 0, the entry renders without a badge

#### Scenario: Paginates older notifications via cursor
- **WHEN** a signed-in user has more notifications than fit in one page and clicks "Load older"
- **THEN** the next request includes the previous response's cursor as `?before=<cursor>` and the page renders the next batch, strictly older than the cursor's `(created_at, id)` position
- **AND** when the final page has been reached the response no longer surfaces "Load older"

#### Scenario: Cursor is stable across rows with identical timestamps
- **WHEN** two notification rows share the exact same `created_at`
- **THEN** pagination orders them deterministically by `id` (descending) as a tiebreaker, so neither page omits nor duplicates them

#### Scenario: Malformed cursor is ignored, not surfaced as an error
- **WHEN** a request reaches `/notifications` with a `before` value that doesn't decode to a valid cursor
- **THEN** the page renders from the top (newest rows) instead of returning a 400, since the cursor is opaque and clients should not need to validate it

### Requirement: Mark-as-read controls
A signed-in user SHALL be able to mark an individual notification as read via `POST /api/notifications/:id/read`, and to mark all of their unread notifications as read via `POST /api/notifications/read-all`. Both endpoints are owner-bound: only the recipient may mark their own notifications.

#### Scenario: Click-through marks the row read and navigates to the subject
- **WHEN** a user clicks an unread notification on `/notifications`
- **THEN** the row's `read_at` is set to `now()` and the user is navigated to the subject page (e.g., the activity, or the follower's profile)

#### Scenario: Mark-all-read clears the unread badge
- **WHEN** a user invokes "Mark all read"
- **THEN** every notification belonging to that user with `read_at IS NULL` is updated to `read_at = now()`, and the navbar unread count drops to 0

#### Scenario: Owner-bound enforcement
- **WHEN** a user attempts to mark another user's notification read via the API
- **THEN** the API returns 404 (no leak of recipient identity), and the row is unchanged

### Requirement: Retention of read notifications
The Journal SHALL retain unread notifications indefinitely and SHALL delete read notifications older than 90 days via a daily pg-boss job, to bound table growth without losing actionable history.

#### Scenario: Read notification past retention window
- **WHEN** the retention job runs and finds notifications with `read_at IS NOT NULL` AND `read_at < now() - interval '90 days'`
- **THEN** those rows are deleted

#### Scenario: Long-unread notification is preserved
- **WHEN** a notification has `read_at IS NULL` for more than 90 days
- **THEN** the retention job does NOT delete it (only read notifications expire)

### Requirement: Cascade on user deletion
Deleting a user account SHALL cascade-delete all notifications where they are the recipient. Notifications where they are the `actor_user_id` SHALL set `actor_user_id` to NULL and remain so the recipient's history is preserved with a generic actor reference.

#### Scenario: Recipient deletes account
- **WHEN** a user deletes their own account
- **THEN** every notification with `recipient_user_id = that user` is deleted

#### Scenario: Actor deletes account
- **WHEN** a user who has caused notifications deletes their account
- **THEN** the recipient's notifications remain, with `actor_user_id` set to NULL; the renderer surfaces a generic "Someone" attribution
