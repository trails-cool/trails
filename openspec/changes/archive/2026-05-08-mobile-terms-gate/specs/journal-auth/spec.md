## ADDED Requirements

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
