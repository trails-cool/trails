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

---

## Authentication

User identity in the Journal. Two **authentication methods** are supported
and are intentionally the entire surface (see ADR-0005): **passkey**
(WebAuthn) as the preferred method and **magic-link + 6-digit code**
(email) as a fallback for users without passkey support or for cross-device
sign-in. There is no plan for social sign-in (Google/Apple/etc.) — passkeys
already deliver the one-tap UX, and adding centralized identity providers
would conflict with the privacy-first ethos and ActivityPub federation.

OAuth2/PKCE (the `mobile-app` flow) is **not** a third authentication
method. It is a **session transport** for native clients: users still
authenticate via passkey or magic-link in a WebView, then the mobile app
exchanges the resulting authorization code for long-lived bearer tokens.
The peer of OAuth2 transport is the cookie session, not passkey or
magic-link.

### completeAuth
The single chokepoint for the post-verify orchestration of every web
auth flow. Lives at `apps/journal/app/lib/auth/completion.ts` (see
ADR-0004). Called by every route handler that has just verified a
user's identity (passkey login finish, magic-link code verify, magic
link consumer). Does three things in order:

1. If `isNewRegistration`, records the accepted Terms version
   (`recordTermsAcceptance`).
2. Creates the session cookie via `createSession`.
3. Returns `redirect(returnTo ?? "/")` with the session `Set-Cookie`
   header attached.

Identity-method-specific work (WebAuthn ceremony verification, magic
token consumption) stays in the per-method functions and runs *before*
`completeAuth`. The chokepoint deliberately knows nothing about how
identity was proved.

### Terms gate
Cross-cutting middleware enforcing that `users.terms_version` matches
the current `TERMS_VERSION` constant before any non-allow-listed
authenticated request succeeds. Two enforcement points:

- **Web (cookie sessions)**: the root loader redirects stale-terms users
  to `/auth/accept-terms`. Allow-list: `/auth/accept-terms`,
  `/auth/logout`, `/legal/*`. `/oauth/authorize` is *not* on the
  allow-list, so OAuth code issuance is gated by this same redirect
  before mobile sees an authorization code.
- **API (bearer tokens)**: `requireApiUser` returns
  `403 { code: "TERMS_OUTDATED", currentTermsVersion }` for stale-terms
  bearer-token traffic. (Added in `mobile-terms-gate`, 2026-05-08.)

`completeAuth` only **records** terms on registration; it does not
enforce them. Enforcement remains middleware's job.
