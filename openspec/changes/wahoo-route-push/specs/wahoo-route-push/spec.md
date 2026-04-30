## ADDED Requirements

### Requirement: Send to Wahoo action on route detail page
The Journal SHALL show a "Send to Wahoo" button on the route detail page when all of the following hold: the viewer owns the route, the viewer has a connected Wahoo account, and the route has stored geometry (`routes.geom` is non-null and `routes.gpx` is non-empty). The button SHALL trigger a server action that pushes the current route version to Wahoo.

#### Scenario: Owner with connected Wahoo and a route with geometry
- **WHEN** the route owner loads a route detail page for a route that has geometry
- **AND** the owner has a `sync_connections` row with `provider = 'wahoo'`
- **THEN** a "Send to Wahoo" button is visible alongside the existing "Export GPX" action

#### Scenario: Owner without a connected Wahoo account
- **WHEN** the route owner loads a route detail page
- **AND** the owner has no Wahoo `sync_connections` row
- **THEN** the "Send to Wahoo" button is not rendered

#### Scenario: Non-owner viewing the route
- **WHEN** any visitor who is not the route owner loads the route detail page
- **THEN** the "Send to Wahoo" button is not rendered, regardless of the viewer's own Wahoo connection

#### Scenario: Route without geometry
- **WHEN** the route owner loads a route detail page for a route whose `geom` is null or whose `gpx` is empty
- **THEN** the "Send to Wahoo" button is not rendered

### Requirement: Server-side route push pipeline
The Journal SHALL convert the current route version to a FIT Course file and POST it to `https://api.wahooligan.com/v1/routes` with the user's stored Wahoo access token, recording the outcome in `sync_pushes`.

#### Scenario: Successful push
- **WHEN** the route owner triggers the push action for a route version that has not been pushed before
- **THEN** the server reads the route's GPX, runs `gpxToFitCourse`, base64-encodes the result, and POSTs it to `/v1/routes` with the required fields (`external_id`, `provider_updated_at`, `name`, `workout_type_family_id`, `start_lat`, `start_lng`, `distance`, `ascent`)
- **AND** on a 2xx response a `sync_pushes` row is inserted with `pushed_at = now()`, `remote_id` set from Wahoo's response, and `error = null`
- **AND** the user is shown a "Sent to Wahoo" confirmation

#### Scenario: Wahoo returns an error
- **WHEN** Wahoo responds with a non-2xx status
- **THEN** a `sync_pushes` row is inserted with `pushed_at = null`, `remote_id = null`, and `error` populated with the response body or status
- **AND** the user is shown a generic "Sending to Wahoo failed — try again later" message
- **AND** no exception leaks to the browser

#### Scenario: Route file omits records
- **WHEN** the route's GPX has no track points (zero-segment route)
- **THEN** the server returns HTTP 422 to the client and does not call Wahoo
- **AND** no `sync_pushes` row is created

### Requirement: Push idempotency per route version
Each combination of `(user_id, route_id, route_version, provider)` SHALL be pushed at most once successfully. Re-clicking the button for the same version SHALL be a no-op surfacing the existing remote id.

#### Scenario: Re-push of an already-pushed version
- **WHEN** the route owner clicks "Send to Wahoo" on a version that already has a `sync_pushes` row with `pushed_at` set
- **THEN** the server skips the Wahoo call and returns the existing `remote_id`
- **AND** the UI shows "Already on Wahoo" with the timestamp from the existing row

#### Scenario: Push of a new version after editing
- **WHEN** the route owner edits the route, creating a new version, and clicks "Send to Wahoo"
- **THEN** the new version has no `sync_pushes` row yet, so the push proceeds normally
- **AND** a new `sync_pushes` row is inserted for the new version

#### Scenario: Retry after a failed push
- **WHEN** a previous push attempt for this version failed (`pushed_at` null, `error` populated)
- **THEN** clicking "Send to Wahoo" again retries the push
- **AND** the existing `sync_pushes` row is updated in place (no duplicate row)

### Requirement: Stable external_id per route version
The `external_id` field sent to Wahoo SHALL be deterministic per `(route_id, route_version)` so that retries and accidental races do not create duplicate routes on Wahoo's side.

#### Scenario: External id is deterministic
- **WHEN** the server constructs the Wahoo payload for a route version
- **THEN** `external_id` is set to `route:<route_id>:v<route_version>`
- **AND** identical calls for the same version produce the same `external_id`

### Requirement: Re-auth flow when `routes_write` scope is missing
The Journal SHALL detect when a connected Wahoo account lacks the `routes_write` scope before calling Wahoo, redirect the user through OAuth to grant it, and resume the push automatically after the user returns.

#### Scenario: Existing connection lacks routes_write
- **WHEN** the route owner clicks "Send to Wahoo"
- **AND** the user's `sync_connections.granted_scopes` does not include `routes_write`
- **THEN** the server redirects the user to Wahoo's authorization URL with the full updated scope list and a `state` that encodes `{ return_to: <route_url>, push_after: true }`
- **AND** no Wahoo `/v1/routes` call is attempted

#### Scenario: Push completes after re-auth
- **WHEN** the user returns from Wahoo's OAuth callback with `push_after = true` in the state
- **THEN** the connection is updated with the new scopes
- **AND** the push action runs automatically against the route encoded in `return_to`
- **AND** the user lands back on the route detail page with the "Sent to Wahoo" confirmation visible

#### Scenario: User declines the new scope
- **WHEN** the user reaches Wahoo's authorization page and clicks "Deny"
- **THEN** the user is redirected back to the route detail page with an inline notice "Sending to Wahoo needs route permission — please reconnect your account in Settings"
- **AND** no `sync_pushes` row is created

### Requirement: GPX to FIT Course conversion
The system SHALL provide a `gpxToFitCourse` function in the `@trails-cool/fit` package that converts a GPX string to a FIT Course binary suitable for `POST /v1/routes`.

#### Scenario: GPX with track points produces a valid FIT Course
- **WHEN** `gpxToFitCourse({ gpx, name })` is called with a GPX string containing one or more track points
- **THEN** the returned `Uint8Array` is a valid FIT file that decodes via `fit-file-parser` to a Course with the same number of records as the input had track points
- **AND** each record's lat/lon round-trips to within 1e-5 degrees of the source

#### Scenario: GPX with elevation data preserves elevation
- **WHEN** the input GPX track points include `<ele>` values
- **THEN** the encoded FIT records carry `altitude` values that round-trip to within 0.5 m of the source

#### Scenario: GPX without track points is rejected
- **WHEN** the input GPX has no track points
- **THEN** `gpxToFitCourse` throws an error and produces no output

### Requirement: Push status surfaced on the route detail page
The route detail page SHALL show whether the current route version has been pushed to Wahoo, with timestamp.

#### Scenario: Already-pushed route shows status
- **WHEN** the route owner views a route version with a successful `sync_pushes` row
- **THEN** the page shows "Sent to Wahoo on <date>" near the action buttons
- **AND** the "Send to Wahoo" button is replaced with disabled "Already on Wahoo" text

#### Scenario: Push failed previously shows retry affordance
- **WHEN** the route owner views a route version whose latest `sync_pushes` row has `error` set and `pushed_at` null
- **THEN** the page shows "Last attempt failed: <short error>" with a "Send to Wahoo" button still active
