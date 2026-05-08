## ADDED Requirements

### Requirement: Single web auth completion chokepoint
Every successful web authentication flow — passkey register-finish, passkey login-finish, magic-link 6-digit-code verify, magic-link click-through verify — SHALL complete by calling a single `completeAuth` function at `apps/journal/app/lib/auth/completion.ts`. The function SHALL be the sole place where a successful web authentication mints the cookie session and constructs the redirect to `returnTo` (or `/` when absent or rejected).

Per-method identity verification (WebAuthn ceremony, magic-token consumption, 6-digit-code consumption) SHALL run in its own function and produce a `userId` *before* `completeAuth` is invoked. `completeAuth` SHALL NOT know how identity was proved.

Terms recording happens at user creation time inside the per-method registration functions (`finishRegistration` for passkey, `registerWithMagicLink` for magic-link), not inside `completeAuth`. The Terms gate (root-loader redirect for cookie sessions; `requireApiUser` 403 for bearer-token API requests) SHALL remain the enforcement point for stale `terms_version`.

OAuth-code issuance at `/oauth/authorize` SHALL NOT be routed through `completeAuth` — that flow operates on an already-authenticated user and shares only the trailing redirect, not the full sequence.

#### Scenario: Passkey register-finish completes through the chokepoint
- **WHEN** a visitor submits a successful WebAuthn `step: "finish"` registration response
- **THEN** the route handler verifies the credential and creates the user row (with terms recorded) inside `finishRegistration`, then calls `completeAuth({ userId, request, returnTo })`
- **AND** `completeAuth` mints the session cookie and returns a `Response` redirecting to `returnTo` (or `/`)

#### Scenario: Passkey login-finish completes through the chokepoint
- **WHEN** a visitor submits a successful WebAuthn `step: "finish-passkey"` login response
- **THEN** the route handler verifies the credential and calls `completeAuth({ userId, request, returnTo })`
- **AND** `completeAuth` mints the session cookie and returns a `Response` redirecting to `returnTo` (or `/`)

#### Scenario: Magic-link 6-digit-code verify completes through the chokepoint
- **WHEN** a visitor submits a valid 6-digit code via `step: "verify-code"`
- **THEN** the route handler consumes the magic token (marks `used_at`) and calls `completeAuth({ userId, request, returnTo })`

#### Scenario: Magic-link click-through verify completes through the chokepoint
- **WHEN** a visitor opens `/auth/verify?token=<token>` with a valid, unused, unexpired token
- **THEN** the route handler consumes the magic token and calls `completeAuth({ userId, request, returnTo })`

#### Scenario: returnTo is sanitized inside completeAuth
- **WHEN** `completeAuth` is called with a `returnTo` value that is not a same-origin absolute path (e.g. starts with `//`, an absolute URL, or is malformed)
- **THEN** the redirect target falls back to `/` rather than honoring the unsafe value
- **AND** every caller benefits from the same check rather than reimplementing it
