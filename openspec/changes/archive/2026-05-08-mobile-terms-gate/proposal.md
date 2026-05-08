## Why

Mobile API requests authenticated via OAuth2 bearer tokens currently bypass the Terms gate. Web users with a stale `users.terms_version` are redirected to `/auth/accept-terms` by the journal root loader (`apps/journal/app/root.tsx:58`), but mobile clients hitting `/api/v1/*` with the same stale version get a normal 200 response. The Terms gate (defined in `journal-auth/spec.md`) is meant to apply to **all** authenticated requests, not only cookie-session traffic.

## What Changes

- Extend the bearer-token API chokepoint (`requireApiUser` in `apps/journal/app/lib/api-guard.server.ts`) to compare the authenticated user's `termsVersion` against the current `TERMS_VERSION`. On mismatch, return a structured **HTTP 403** with `{ error, code: "TERMS_OUTDATED", currentTermsVersion }` so the mobile app can surface its own UI (or open the web Terms page in a webview).
- Add `TERMS_OUTDATED` to `packages/api/src/errors.ts` `ERROR_CODES` so clients have a stable code to switch on.
- Spec delta on `journal-auth`: add a requirement that the Terms gate also applies to bearer-token API auth, with the structured-error contract as a scenario.

Web cookie-session behaviour is unchanged (still a redirect via the root loader). Only the API chokepoint changes.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `journal-auth`: adds a requirement that the Terms-version gate applies to bearer-token API requests, returning HTTP 403 with a structured `terms_outdated` payload instead of a redirect.

## Impact

- **Code**: one function (`requireApiUser`) gains a terms check; one constant added to `@trails-cool/api`.
- **Clients**: the mobile app needs to handle `403 { code: "TERMS_OUTDATED" }` (out of scope for this change — tracked separately on the mobile side).
- **Tests**: unit test for `requireApiUser` covering stale / current / null `termsVersion`.
- **Specs**: 1 spec delta on `journal-auth` (added requirement).
- **Out of scope**: mobile client UI for the new error; any change to web cookie-session behaviour.
