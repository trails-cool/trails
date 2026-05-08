# journal-auth Specification

## Purpose
Session management and the terms-of-service consent gate for the Journal app. The credentials a user authenticates with (passkeys, magic links, magic codes) and the registration UX live in `authentication-methods`; OAuth tokens for third-party services (Wahoo etc.) live in `connected-services`. This spec is the cross-cutting layer: cookie sessions, the Terms-version gate that wraps every authenticated request, and the rules for safely returning users to where they came from.

## Requirements

### Requirement: Cookie session for signed-in users
The Journal SHALL identify signed-in users via a server-set HTTP cookie (`__session`) that carries a serialized JSON payload containing `userId`. The cookie SHALL be `HttpOnly`, `SameSite=Lax`, signed with the server secret, and have a finite max-age. Anonymous browsers SHALL render the public surface (anonymous home, public profiles, public routes/activities) without a session cookie present.

#### Scenario: Set cookie on successful authentication
- **WHEN** any authentication path (passkey finish, magic-link verify, code verify) succeeds
- **THEN** the response carries a `Set-Cookie: __session=...` header binding the resulting `userId` to the browser

#### Scenario: Anonymous request renders public surface
- **WHEN** a request arrives without `__session` (or with one that fails to verify)
- **THEN** loaders treat the request as anonymous; routes that require auth either redirect to `/auth/login` or render the public layout per their own spec

### Requirement: Terms acknowledgement at signup
The registration form SHALL require explicit acknowledgement of the Terms of Service before an account can be created.

#### Scenario: Checkbox required
- **WHEN** a user views the registration form
- **THEN** they see a required checkbox labeled "I have read and agree to the Terms of Service, including that trails.cool is in alpha and my data may be reset"
- **AND** the checkbox label links to the Terms page

#### Scenario: Cannot submit without acknowledgement
- **WHEN** a user attempts to register without checking the acknowledgement box
- **THEN** the form blocks submission and shows a validation message

#### Scenario: Acknowledgement recorded
- **WHEN** a user successfully registers
- **THEN** the current timestamp is stored in `users.terms_accepted_at`
- **AND** the version identifier of the Terms the user saw is stored in `users.terms_version`

#### Scenario: Missing version rejected
- **WHEN** a registration request arrives without a non-empty `termsVersion` field
- **THEN** the server responds with HTTP 400 and does not create a user

### Requirement: Re-accept updated Terms on next visit
Logged-in users whose stored `terms_version` does not match the currently-published version SHALL be prompted to accept the current Terms before accessing any non-allow-listed page.

#### Scenario: Stale version redirects to accept-terms page
- **WHEN** a logged-in user whose `users.terms_version` is NULL or differs from the current `TERMS_VERSION` requests any page outside the allow-list (`/auth/accept-terms`, `/auth/logout`, `/legal/*`)
- **THEN** the server redirects them to `/auth/accept-terms?returnTo=<original path>`

#### Scenario: Allow-list keeps Terms and logout reachable
- **WHEN** the same user requests `/legal/terms`, `/legal/privacy`, `/legal/imprint`, `/auth/accept-terms`, or `/auth/logout`
- **THEN** the request is served normally without being redirected

#### Scenario: Successful re-acceptance updates both fields
- **WHEN** a user submits the acceptance form with the required checkbox ticked
- **THEN** the server updates `users.terms_version` to the current version and `users.terms_accepted_at` to the current timestamp, then redirects to the `returnTo` path (or `/`)

#### Scenario: Re-acceptance rejects missing consent
- **WHEN** the form is submitted without the checkbox ticked
- **THEN** the server responds with HTTP 400 and does not update the user row

#### Scenario: returnTo is restricted to same-origin paths
- **WHEN** a `returnTo` value is not a same-origin absolute path (missing leading `/`, or starting with `//`)
- **THEN** the server redirects to `/` instead, preventing open-redirect abuse

### Requirement: Terms gate applies to bearer-token API requests
Authenticated API requests carrying an OAuth2 bearer token SHALL be subject to the same Terms-version gate as cookie-session requests. When the authenticated user's stored `terms_version` is NULL or differs from the current `TERMS_VERSION`, the API chokepoint (`requireApiUser`) SHALL reject the request with HTTP 403 and a structured JSON body `{ error, code: "TERMS_OUTDATED", currentTermsVersion: <current> }` instead of returning the resource. Cookie-session web traffic continues to be handled by the root-loader redirect to `/auth/accept-terms`; only the API path uses the structured 403.

#### Scenario: Stale bearer token receives structured 403
- **WHEN** a request to `/api/v1/*` arrives with a valid bearer token whose user has `terms_version` NULL or different from the current `TERMS_VERSION`
- **THEN** the server responds with HTTP 403 and JSON `{ error: <message>, code: "TERMS_OUTDATED", currentTermsVersion: <current> }`
- **AND** the requested resource is not returned

#### Scenario: Up-to-date bearer token is allowed through
- **WHEN** a request to `/api/v1/*` arrives with a valid bearer token whose user's `terms_version` matches the current `TERMS_VERSION`
- **THEN** the request proceeds normally

#### Scenario: Anonymous API request still 401
- **WHEN** a request to `/api/v1/*` arrives without a bearer token (or with an invalid one)
- **THEN** the server responds with HTTP 401 `UNAUTHORIZED` as before — the Terms check only applies after authentication succeeds
