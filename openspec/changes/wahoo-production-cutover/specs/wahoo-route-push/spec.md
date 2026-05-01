## MODIFIED Requirements

### Requirement: Server-side route push pipeline
The Journal SHALL convert the current route version to a FIT Course file and POST it to `https://api.wahooligan.com/v1/routes` with the user's stored Wahoo access token, recording the outcome in `sync_pushes`. The FIT bytes SHALL be sent in the `route[file]` form field as a data URI of the form `data:application/vnd.fit;base64,<base64>` — Wahoo silently discards routes whose `route[file]` is plain base64 (the route metadata is stored but the track is not). The encoded FIT Course SHALL set the COURSE message `capabilities` field to a bitmask containing at least `valid | distance | position` (`0x1A`); a `time`-only capabilities value (`0x04`) causes consuming devices and the Wahoo app to render the route without a track. The encoded LAP message SHALL have non-zero `total_elapsed_time` and `total_timer_time` derived from the record stream.

#### Scenario: Successful push
- **WHEN** the route owner triggers the push action for a route version that has not been pushed before
- **THEN** the server reads the route's GPX, runs `gpxToFitCourse`, encodes the result as `data:application/vnd.fit;base64,<base64>`, and POSTs it to `/v1/routes` with the required fields (`external_id`, `provider_updated_at`, `name`, `workout_type_family_id`, `start_lat`, `start_lng`, `distance`, `ascent`)
- **AND** the produced FIT Course advertises capabilities including `valid | distance | position`, not `time` alone
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

## ADDED Requirements

### Requirement: Revoke Wahoo tokens on disconnect
When a user disconnects their Wahoo account from trails.cool, the Journal SHALL revoke the access token at Wahoo via `DELETE https://api.wahooligan.com/v1/permissions` before deleting the local `sync_connections` row. Wahoo enforces a per-(app, user) cap on unrevoked access tokens; failing to revoke causes subsequent reconnect attempts to fail with `"Too many unrevoked access tokens exist for this app and user"` until the user manually revokes via the Wahoo app or website.

#### Scenario: Disconnect with a live token
- **WHEN** the user submits the disconnect form for a Wahoo connection that has a non-expired access token
- **THEN** the server calls `DELETE /v1/permissions` with the bearer token before deleting the local row
- **AND** the local `sync_connections` row is deleted regardless of whether the revoke call succeeded (best-effort)

#### Scenario: Disconnect when revoke fails
- **WHEN** the revoke call returns a non-2xx response (e.g., the token is already expired)
- **THEN** the server logs a warning and proceeds to delete the local row
- **AND** the user sees the same disconnect confirmation as on a successful revoke

### Requirement: Surface Wahoo-side OAuth errors to the user
The Journal SHALL distinguish Wahoo's `"Too many unrevoked access tokens"` failure during OAuth code exchange from generic OAuth failures and display a localized banner on `/settings/connections` instructing the user to revoke trails.cool in the Wahoo app and try again.

#### Scenario: Token-cap error during connect
- **WHEN** the user completes the Wahoo authorize flow and the token exchange returns a 400 whose body matches `"Too many unrevoked access tokens"`
- **THEN** the user is redirected to `/settings/connections?error=too_many_tokens`
- **AND** the page renders a red banner explaining the cap and pointing the user at the Wahoo app to revoke

#### Scenario: Generic connect error
- **WHEN** the token exchange returns any other non-2xx status
- **THEN** the user is redirected to `/settings/connections?error=generic` (or the legacy `sync_failed`)
- **AND** the page renders a generic "Couldn't connect — try again" banner
