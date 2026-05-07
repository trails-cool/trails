# Connected Services use a credential-kind discriminator + JSONB blob

trails.cool integrates with external services whose credentials have
fundamentally different shapes: OAuth2 (Wahoo, future Coros/Garmin/Strava),
web-login session (Komoot — no official API, we authenticate against the
provider's web login with email + password and reuse the cookie jar),
and device pairing (Apple Health, future Health Connect — no remote
credential at all). We considered an OAuth-only schema with nullable extras
and per-kind tables, and rejected both: nullable-OAuth would force Komoot
and Apple Health to leave most columns NULL and bake OAuth assumptions into
queries; per-kind tables would fragment `connected_services` and complicate
the user-facing "Connected Services" list.

We store all linked external accounts in one `connected_services` table
with a `credential_kind ∈ {oauth, web-login, device}` discriminator and a
`credentials` JSONB blob whose schema is determined by kind. OAuth-specific
`granted_scopes` stays a top-level column because feature gates query it
directly. Per-kind `CredentialAdapter` modules own the credential lifecycle
(refresh / relogin / noop); callers never read the JSONB directly.
