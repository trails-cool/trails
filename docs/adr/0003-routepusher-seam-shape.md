# RoutePusher seam takes (service, route); workarounds stay inside adapters

`RoutePusher` has one adapter today (Wahoo), but Coros, Garmin, and Strava
push are all foreseeable. The current Wahoo push code exposes its
workarounds — FIT Course conversion, the deterministic `external_id =
route:<id>` convention, the PUT→POST-on-404 fallback when a user has
deleted the route on the remote side — at the call site, which would force
every future pusher to either inherit those Wahoo-isms or reshape the
seam.

We commit to the seam shape now, with one adapter: `pushRoute(service,
route) → {remoteId, version}`. Format conversion, idempotency tricks, and
provider-specific HTTP recovery live entirely inside the adapter. The
`sync_pushes` table (`(user_id, route_id, provider) → remote_id,
last_pushed_version`) is the cross-provider contract for idempotency; the
adapter is responsible for honouring it but not for exposing how. When the
second pusher lands, it implements the same shape without changing
callers.
