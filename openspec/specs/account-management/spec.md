# account-management Specification

## Purpose
Lifecycle operations on a user's account: changing the registered email address (with re-verification) and deleting the account. Authentication-method specifics (passkeys, magic links) live in `authentication-methods`; profile-editing UX lives in `profile-settings`. This spec covers the irreversible / verification-gated operations exposed from the Journal's settings page.

## Requirements

### Requirement: Email change with verification
The Account settings page (`/settings/account`) SHALL include an "Email" section where the signed-in user can request a new email address via `POST /api/settings/email`. The change SHALL NOT take effect until the user clicks a verification link delivered to the new email; the original address remains active until verification completes.

#### Scenario: Initiate email change
- **WHEN** a signed-in user submits a new email address that is not already in use by another account
- **THEN** the server creates a verification token (purpose = `email-change`) tied to the user's id and the proposed address, sends it to the new address, and the page renders a "check your inbox" confirmation. `users.email` is unchanged at this point.

#### Scenario: Reject duplicate email
- **WHEN** the submitted new email is already registered to another user
- **THEN** the server responds with a validation error and the verification email is not sent

#### Scenario: Verification link applies the change
- **WHEN** the user follows the verification link (`/auth/verify?email-change=1&token=...`)
- **THEN** the server validates the token (matching purpose, not expired, not used), updates `users.email`, marks the token used, signs the user back in if necessary, and redirects to `/settings/account`

#### Scenario: Expired verification link
- **WHEN** the verification link is more than 15 minutes old or has already been used
- **THEN** the page shows an expired/used message and the email is unchanged

### Requirement: Account deletion is irreversible and owner-bound
The Account settings page (`/settings/account`) SHALL include a "Delete account" section behind a confirmation step. Deletion SHALL be irreversible and SHALL cascade to all rows owned by the user (per the existing FK ON DELETE CASCADE rules: routes, activities, follows, notifications, magic tokens, sync connections, oauth tokens). Pending follow requests targeting the deleted user SHALL also be cleared.

#### Scenario: Authenticated user deletes their account
- **WHEN** a signed-in user POSTs to `/api/settings/delete-account` with the confirmation step satisfied
- **THEN** the server deletes `users` row for that user (cascading per schema), invalidates the user's session, and redirects to a logged-out goodbye page

#### Scenario: Anonymous request is rejected
- **WHEN** an unauthenticated request hits `/api/settings/delete-account`
- **THEN** the server responds with HTTP 401 and no rows are deleted

#### Scenario: A deleted user's authored notifications survive (with actor set null)
- **WHEN** a user is deleted who has previously emitted notifications (e.g. follows, activity_published)
- **THEN** the recipient's notification rows remain, with `actor_user_id` set to NULL via ON DELETE SET NULL — so historical context is preserved as "someone followed you" rather than dropping the row

### Requirement: Terms re-acceptance gate (cross-cutting)
Settings pages SHALL be reachable while the user has a stale `terms_version` so they can read the current Terms or sign out, but action endpoints behind settings SHALL NOT execute side effects until the user has re-accepted the current Terms version. The cross-cutting gate that enforces this lives in `journal-auth`'s "Re-accept updated Terms on next visit" requirement; this spec only documents the dependency so settings UX is read in context.

#### Scenario: Stale-terms user is redirected before reaching settings
- **WHEN** a user with a stale `terms_version` navigates to `/settings` (or any sub-page like `/settings/account`)
- **THEN** the root loader's Terms gate redirects them to `/auth/accept-terms` first (per `journal-auth`); after re-acceptance they return to the settings page and side effects work normally
