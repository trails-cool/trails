# authentication-methods Specification

## Purpose
The credentials a user can authenticate with on the Journal: passkeys (WebAuthn) and email magic links / 6-digit codes. Covers registration, login, adding a passkey to an existing account, and the UX toggle on the register/login forms that lets users pick the method that works in their browser. Session management, terms acceptance, and the cookie session cookie itself live in `journal-auth` — this spec only covers what proves identity.

## Requirements

### Requirement: Passkey-based registration
The Journal SHALL support WebAuthn passkey registration as the primary auth method when the browser advertises `browserSupportsWebAuthn()`. Registration SHALL create the user row, generate a credential, and start a session in one HTTP round-trip pair (`step: "start"` followed by `step: "finish"`).

#### Scenario: Browser supports WebAuthn
- **WHEN** a visitor completes the Register form with a browser that supports WebAuthn
- **THEN** the form prompts for a passkey, the credential is stored in `credentials`, the `users` row is created with `terms_version` and `terms_accepted_at`, and a session cookie is issued

#### Scenario: Browser does not support WebAuthn
- **WHEN** the browser reports `browserSupportsWebAuthn() === false`
- **THEN** the Register form auto-switches to the magic-link/code path; the passkey button is not rendered

### Requirement: Magic link + 6-digit code registration
The Journal SHALL support a passwordless registration alternative: the user submits email + username, the server creates the account and a 15-minute magic token (with both a click-through link and a 6-digit code), and the user verifies through either path. Used in production over real email; in development the link/code is logged to the server console (`[Register Magic Link] ...`) so the dev can test without a mail transport.

#### Scenario: Production register-magic-link flow
- **WHEN** a visitor submits the Register form with `step: "register-magic-link"` in production
- **THEN** the server inserts the user row, creates a `magic_tokens` row with both `token` and `code`, sends the email (link + 6-digit code), and the form renders a "check your email" confirmation

#### Scenario: Dev register-magic-link flow
- **WHEN** the same flow runs with `NODE_ENV !== "production"`
- **THEN** the server logs `[Register Magic Link] <email>: <link> (code: <code>)` to stdout instead of sending email, and the API response includes both `devLink` and `code` so the dev can paste either

#### Scenario: Verify via 6-digit code on registration
- **WHEN** the new user enters the 6-digit code on the post-submit form
- **THEN** `POST /api/auth/login { step: "verify-code", email, code }` validates against the same `magic_tokens` row (default `purpose = "login"`), marks it used, and starts a session — registration and first login share the verify-code endpoint

#### Scenario: Verify via click-through link
- **WHEN** the user clicks the link delivered to their inbox (or to the dev console)
- **THEN** `/auth/verify?token=...` validates the same row, marks it used, and starts a session

### Requirement: Passkey login
The Journal SHALL support WebAuthn passkey login on `/auth/login`. The page SHALL default to the passkey method when `browserSupportsWebAuthn()` returns true; otherwise it SHALL pre-select the magic-link method.

#### Scenario: Passkey login on a browser with a registered credential
- **WHEN** a returning user clicks "Sign in with passkey" on a browser that already holds the credential
- **THEN** WebAuthn authentication completes, the matching `credentials` row is verified, and a session cookie is issued

#### Scenario: Passkey not found locally
- **WHEN** the browser does not present any matching credential during the WebAuthn ceremony
- **THEN** the login page surfaces the `auth.passkeyNotFound` error and the user can switch to the magic-link/code flow

### Requirement: Magic link + code login
The Journal SHALL support email-based login as the universal fallback. The login form SHALL include a "Use magic link instead" toggle (for users with WebAuthn but no local credential), which surfaces an email-only form; submitting it sends a magic link (production) or surfaces `devLink` + `code` (dev), and a 6-digit code form lets the user paste the code instead of clicking the link.

#### Scenario: Send magic link
- **WHEN** a registered user submits their email under `step: "magic-link"`
- **THEN** a `magic_tokens` row is created with both `token` and `code`, and either the email is sent (prod) or `devLink` + `code` are returned (dev) plus `[Magic Link] <email>: <link> (code: <code>)` is logged to stdout

#### Scenario: Verify via 6-digit code
- **WHEN** the user submits `step: "verify-code"` with the email and the 6-digit code
- **THEN** the matching `magic_tokens` row is validated (not expired, not used), marked used, and a session cookie is issued

#### Scenario: Magic-link-only browser routes through magic-link mode
- **WHEN** the login page detects `browserSupportsWebAuthn() === false`
- **THEN** the page auto-selects magic-link mode and does not render the passkey button

### Requirement: Method-toggle UX on register and login
The register form and the login form SHALL both render a small text toggle that lets the user manually switch between passkey and magic-link mode when both are available, mirroring the same UX on both surfaces.

#### Scenario: Toggle on register
- **WHEN** a passkey-capable browser visits `/auth/register`
- **THEN** the form starts in passkey mode and renders a "Use magic link instead" link below the submit button; clicking it switches the form to the magic-link path

#### Scenario: Toggle on login
- **WHEN** a passkey-capable browser visits `/auth/login`
- **THEN** the form starts in passkey mode and renders the same toggle to switch to magic-link mode

### Requirement: Add passkey to an existing account
A signed-in user SHALL be able to add an additional passkey to their account from the Security settings page (`/settings/security`) or from the post-login `/?add-passkey=1` prompt. The flow SHALL reuse the WebAuthn registration ceremony but bind the credential to the existing `users.id` rather than creating a new account.

#### Scenario: Add passkey from settings
- **WHEN** a signed-in user clicks "Add passkey" on `/settings/security`
- **THEN** a WebAuthn registration ceremony runs against the existing user id and a new row is inserted in `credentials` linked to that user

#### Scenario: Post-login add-passkey nudge
- **WHEN** a user who has zero registered passkeys lands on `/?add-passkey=1`
- **THEN** the home page surfaces an "Add a passkey for faster sign-in" prompt
- **AND** once the user adds a passkey the prompt disappears (there is no separate dismiss/suppress mechanism)

### Requirement: Passkey deletion
A signed-in user SHALL be able to remove a passkey from their account via the Security settings page (`/settings/security`). The Journal SHALL prevent deletion of the user's last remaining passkey if no alternative auth method (a verified email for magic-link login) is available, to avoid lock-out.

#### Scenario: Delete one of multiple passkeys
- **WHEN** a user with 2+ passkeys removes one via `/api/settings/passkey/delete`
- **THEN** the matching `credentials` row is deleted; remaining passkeys stay valid

#### Scenario: Last-passkey safety net (verified email is the fallback)
- **WHEN** a user attempts to delete their only remaining passkey
- **THEN** the action proceeds because magic-link login by email is always available — passkey deletion does not lock the user out

### Requirement: Single web auth completion chokepoint
Every successful web authentication flow — passkey register-finish, passkey login-finish, magic-link 6-digit-code verify, magic-link click-through verify — SHALL complete by calling a single `completeAuth` function at `apps/journal/app/lib/auth/completion.server.ts`. The function SHALL be the sole place where a successful web authentication mints the cookie session and constructs the redirect to `returnTo` (or `/` when absent or rejected).

Per-method identity verification (WebAuthn ceremony, magic-token consumption, 6-digit-code consumption) SHALL run in its own function and produce a `userId` *before* `completeAuth` is invoked. `completeAuth` SHALL NOT know how identity was proved.

`completeAuth` supports two response modes via an optional `mode` parameter: `"redirect"` (default, for browser flows — returns a `Response` with `Set-Cookie` + `Location`) and `"json"` (for API/mobile flows — returns a JSON body with the session token). All web authentication scenarios use `"redirect"`; the `"json"` mode is used by the OAuth2/PKCE mobile code-exchange flow.

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
