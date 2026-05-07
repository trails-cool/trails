## MODIFIED Requirements

### Requirement: Send to Wahoo action on route detail page
The Journal SHALL show a "Send to Wahoo" button on the route detail page when all of the following hold: the viewer owns the route, the viewer has a connected Wahoo account, and the route has stored geometry (`routes.geom` is non-null and `routes.gpx` is non-empty). The button SHALL trigger a server action that pushes the current route version to Wahoo.

#### Scenario: Owner with connected Wahoo and a route with geometry
- **WHEN** the route owner loads a route detail page for a route that has geometry
- **AND** the owner has a `connected_services` row with `provider = 'wahoo'`
- **THEN** a "Send to Wahoo" button is visible alongside the existing "Export GPX" action

#### Scenario: Owner without a connected Wahoo account
- **WHEN** the route owner loads a route detail page
- **AND** the owner has no Wahoo `connected_services` row
- **THEN** the "Send to Wahoo" button is not rendered

#### Scenario: Non-owner viewing the route
- **WHEN** any visitor who is not the route owner loads the route detail page
- **THEN** the "Send to Wahoo" button is not rendered, regardless of the viewer's own Wahoo connection

#### Scenario: Route without geometry
- **WHEN** the route owner loads a route detail page for a route whose `geom` is null or whose `gpx` is empty
- **THEN** the "Send to Wahoo" button is not rendered

### Requirement: Re-auth flow when `routes_write` scope is missing
The Journal SHALL detect when a connected Wahoo account lacks the `routes_write` scope before calling Wahoo, redirect the user through OAuth to grant it, and resume the push automatically after the user returns.

#### Scenario: Existing connection lacks routes_write
- **WHEN** the route owner clicks "Send to Wahoo"
- **AND** the user's `connected_services.granted_scopes` does not include `routes_write`
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

## ADDED Requirements

### Requirement: `RoutePusher` capability seam
The system SHALL expose `RoutePusher` as the capability seam through which any provider pushes routes. The seam shape is `pushRoute(service, route) → {remoteId, version}`. Provider-specific concerns — file format conversion (e.g. FIT Course), `external_id` conventions, HTTP fallback strategies, idempotency-tracking semantics — SHALL be handled inside the adapter and SHALL NOT appear on the `RoutePusher` interface.

#### Scenario: Wahoo pusher implements the seam without leaking workarounds
- **WHEN** the route push action invokes the Wahoo `RoutePusher`
- **THEN** the seam is called as `pushRoute(connectedService, route)` and returns `{remoteId, version}`
- **AND** the FIT-Course conversion, the `external_id = route:<route_id>` convention, the PUT-vs-POST decision, and the PUT→POST-on-404 fallback are all internal to the Wahoo adapter
- **AND** callers do not pass FIT data or Wahoo-specific fields across the seam

#### Scenario: Future pusher reuses the same seam
- **WHEN** a developer adds a second `RoutePusher` (e.g. Garmin)
- **THEN** they implement `pushRoute(service, route) → {remoteId, version}` with the same shape
- **AND** the route push action invokes it identically to the Wahoo pusher
- **AND** their format conversion and HTTP recovery live inside the adapter
