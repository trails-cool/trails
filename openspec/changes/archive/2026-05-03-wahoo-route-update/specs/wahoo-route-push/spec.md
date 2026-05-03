## MODIFIED Requirements

### Requirement: Server-side route push pipeline
The Journal SHALL convert the current route version to a FIT Course file and send it to Wahoo, recording the outcome in `sync_pushes`. When no successful push exists for the `(user_id, route_id, provider='wahoo')` tuple, the request is `POST https://api.wahooligan.com/v1/routes`. When a successful push exists with a non-null `remote_id`, the request is `PUT https://api.wahooligan.com/v1/routes/<remote_id>` so subsequent pushes update the existing Wahoo route in place rather than creating duplicates. If a PUT returns 404 (the user deleted the Wahoo route on their side), the server SHALL fall back to POST and overwrite `remote_id` with the response. The body shape is identical for POST and PUT and matches the existing field set (`external_id`, `provider_updated_at`, `name`, `workout_type_family_id`, `start_lat`, `start_lng`, `distance`, `ascent`, `route[file]` data URI).

#### Scenario: First push of a route
- **WHEN** the route owner triggers the push action and no `sync_pushes` row exists for `(user, route, wahoo)`
- **THEN** the server reads the route's GPX, runs `gpxToFitCourse`, encodes the result as `data:application/vnd.fit;base64,<base64>`, and POSTs it to `/v1/routes`
- **AND** on a 2xx response, a `sync_pushes` row is inserted with `pushed_at = now()`, `remote_id` set from Wahoo's response, `last_pushed_version` set to the local route version, and `error = null`
- **AND** the user is shown a "Sent to Wahoo" confirmation

#### Scenario: Re-push after editing the route
- **WHEN** the route owner edits a previously-pushed route, then triggers the push action
- **AND** a `sync_pushes` row exists for `(user, route, wahoo)` with non-null `remote_id`
- **THEN** the server PUTs the new FIT and metadata to `/v1/routes/<remote_id>` (not POST)
- **AND** on a 2xx response, the existing `sync_pushes` row is updated in place: `pushed_at = now()`, `last_pushed_version` advanced to the new local version, `error = null`
- **AND** the Wahoo route id remains the same (no duplicate route created on Wahoo's side)

#### Scenario: PUT against a deleted Wahoo route falls back to POST
- **WHEN** the server PUTs to `/v1/routes/<remote_id>` and Wahoo returns 404
- **THEN** the server retries the request as POST `/v1/routes`
- **AND** the existing `sync_pushes` row is updated with the new `remote_id` from the POST response

#### Scenario: Wahoo returns an error
- **WHEN** Wahoo responds with a non-2xx status that is not the 404 fallback
- **THEN** the `sync_pushes` row is created or updated in place with `error` populated and `pushed_at` unchanged
- **AND** the user is shown a generic "Sending to Wahoo failed — try again later" message
- **AND** no exception leaks to the browser

#### Scenario: Route file omits records
- **WHEN** the route's GPX has no track points (zero-segment route)
- **THEN** the server returns HTTP 422 to the client and does not call Wahoo
- **AND** no `sync_pushes` row is created or modified

### Requirement: Push idempotency per route
Each `(user_id, route_id, provider)` SHALL map to at most one `sync_pushes` row. Re-clicking the button when the local version equals `last_pushed_version` and the row's `pushed_at` is non-null SHALL be a no-op surfacing the existing remote id; clicking after editing (local version > `last_pushed_version`) SHALL trigger an update via PUT.

#### Scenario: Re-push of an already-pushed unchanged route
- **WHEN** the route owner clicks "Send to Wahoo" and the existing `sync_pushes` row has `last_pushed_version` equal to the current route version and a non-null `pushed_at`
- **THEN** the server skips the Wahoo call and returns the existing `remote_id`
- **AND** the UI shows "Already on Wahoo" with the timestamp from the row

#### Scenario: Push after editing the route (new version)
- **WHEN** the route owner edits the route (incrementing the local version) and clicks "Send to Wahoo"
- **THEN** the server takes the PUT path against the existing `remote_id`
- **AND** exactly one `sync_pushes` row exists for `(user, route, wahoo)` after the operation completes

#### Scenario: Retry after a failed push
- **WHEN** the existing `sync_pushes` row has `pushed_at = null` and `error` populated
- **THEN** clicking "Send to Wahoo" retries — POST if `remote_id` is null, PUT if `remote_id` is non-null
- **AND** the existing row is updated in place (no duplicate row)

### Requirement: Stable external_id per route
The `external_id` field sent to Wahoo SHALL be deterministic per `(route_id)` so that the value identifies the *logical* route, not a specific edit of it. This makes the source-of-truth identifier stable across re-pushes.

#### Scenario: External id is deterministic
- **WHEN** the server constructs the Wahoo payload for any version of a route
- **THEN** `external_id` is set to `route:<route_id>` (no version suffix)
- **AND** subsequent pushes of the same route — including PUTs after edits — send the same `external_id`

### Requirement: Push status surfaced on the route detail page
The route detail page SHALL show whether the route has been pushed to Wahoo and whether the local version is newer than what Wahoo currently has.

#### Scenario: Local version matches Wahoo's
- **WHEN** the route owner views a route whose `sync_pushes` row has `last_pushed_version` equal to the current local version and a non-null `pushed_at`
- **THEN** the page shows "Sent to Wahoo on <date>" near the action buttons
- **AND** the "Send to Wahoo" button is replaced with disabled "Already on Wahoo" text

#### Scenario: Local version is newer than Wahoo's
- **WHEN** the route owner views a route whose `last_pushed_version` is less than the current local version
- **THEN** the page shows "On Wahoo (v<last_pushed_version>) — local version is newer"
- **AND** the action button reads "Send updated version" and triggers the same push action (which will PUT)

#### Scenario: Push failed previously shows retry affordance
- **WHEN** the route owner views a route whose `sync_pushes` row has `error` set and `pushed_at` null
- **THEN** the page shows "Last attempt failed: <short error>" with a "Send to Wahoo" button still active
