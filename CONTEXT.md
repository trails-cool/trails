# trails.cool domain glossary

This file names the domain concepts used in the codebase. New terms get added
here as decisions crystallize during architecture work; the goal is that one
concept has one name everywhere — specs, code, conversations.

If you're naming a new module, a new column, or a new UI surface, look here
first. If the term you need isn't here, propose it (don't invent a synonym).

---

## Connected Services

The user-facing surface for linking external accounts and devices to a Journal
account. Spec: `openspec/specs/connected-services/`.

### ConnectedService
A single linked external account or device, owned by one user. Stored in the
`connected_services` table (renamed from `sync_connections`). At most one row
per `(user_id, provider)`.

### provider
String identifier for the external system: `wahoo`, `komoot`, `apple-health`,
and future `coros`, `garmin`, `strava`. The provider determines the
`credential_kind` and which capabilities (import / push / webhook) the
connection has, via the provider's manifest.

### credential kind
Discriminator on `connected_services` describing the credential shape stored
in the `credentials` JSONB blob. Three kinds today:

- **oauth** — OAuth2 access token, refresh token, expiry. Wahoo, and the
  expected shape for Coros / Garmin / Strava.
- **web-login** — email + encrypted password + session jar. Komoot. No
  official API; we authenticate against the provider's normal web login and
  reuse the resulting session cookies. Refresh = re-login. Web-login
  breakage (form changes, captchas, password rotation) surfaces at the
  import layer, not at the credential layer.
- **device** — no remote credential. Apple Health (and future Health Connect
  on Android). Data arrives via authenticated mobile API uploads, not
  server-initiated pulls. The `credentials` blob is empty; the connection
  exists so the UI can show "Apple Health is paired."

Credential kind is determined by the provider via its manifest, but stored
explicitly on the row so queries don't need to join the manifest.

### granted_scopes
Column on `connected_services`, populated only for `credential_kind = oauth`,
NULL otherwise. Lists the OAuth scopes the user actually granted (e.g.
`routes_write`). Feature gates query this column directly; missing a scope
triggers re-authorization.

### provider_user_id
The external service's identifier for the user. Used to route incoming
webhooks to the right local user. Nullable (Apple Health has none in the
remote-id sense).

### CredentialAdapter
Per-kind module that knows how to maintain credentials of that kind:

- `oauth.refresh(creds) → creds | NeedsRelink`
- `web-login.relogin(creds) → creds | InvalidCredentials`
- `device` — no-op

Adapters do not import data, push routes, or handle webhooks. They only own
the credential lifecycle.

### ConnectedServiceManager
The deep module callers see. Owns:

- `link(userId, provider, credentials)` / `unlink(serviceId)`
- `withFreshCredentials(serviceId, fn)` — refreshes via the right
  `CredentialAdapter` if expired, calls `fn(creds)`, marks the connection
  `needs_relink` if refresh fails.
- `markNeedsRelink(serviceId, reason)` — called by import / push / webhook
  layers when they observe a credential failure (e.g. Komoot web-login
  fails, Wahoo returns 401 after a successful refresh).

Per-provider importers / pushers / webhook handlers always go through
`withFreshCredentials` — they never read the `credentials` JSONB directly.

### provider manifest
Per-provider declaration co-located with the provider's code
(`providers/wahoo/manifest.ts`, etc.). Declares:

- the provider's `credential_kind`
- which capabilities the provider implements (import? push? webhook?)
- references to the per-capability modules

A small `providers/registry.ts` imports each manifest. Adding a provider is
one new directory plus one import line.

## Sync Capabilities

Three orthogonal capabilities a provider may implement. Each is its own seam
when there are ≥2 adapters; today most are single-adapter and held to a
named shape so the second adapter doesn't reshape the interface.

### Importer
Pulls workouts / activities from the external service into the Journal.
Wahoo (OAuth pull), Komoot (web-login pull), Apple Health (mobile-pushed) all
implement this, with very different mechanics. Dedup via `sync_imports`.

### RoutePusher
Pushes a Journal route out to the external service. One adapter today
(Wahoo); the seam exists so Coros / Garmin / Strava push won't reshape it.

The public seam is `pushRoute(connectedService, route) → {remoteId, version}`.
Provider-specific concerns — FIT Course conversion, the `route:<id>`
`external_id` convention, the PUT→POST-on-404 fallback — are **handled
internally by the adapter**, not exposed on the seam. Idempotency is tracked
via `sync_pushes`.

### WebhookReceiver
Handles inbound webhooks. Today: Wahoo workout-published. Routes incoming
webhooks to the right user via `provider_user_id`. Unknown
`provider_user_id` returns 200 and is silently dropped (no leak).

## Storage tables

- `connected_services` — user ↔ provider links (renamed from
  `sync_connections`).
- `sync_imports` — dedup cache for imported workouts, keyed by
  `(user_id, provider, workout_id)`.
- `sync_pushes` — push state per `(user_id, route_id, provider)` →
  `remote_id`, `last_pushed_version`.
