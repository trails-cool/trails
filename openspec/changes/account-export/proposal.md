## Why

"All user data must be exportable in open formats" is a stated trails principle, but today it only exists as per-route/per-activity GPX downloads. There is no way to take *everything* with you — which a federated, self-hostable platform owes its users both as a data-ownership promise and as the practical instance-migration story. Endurain (reviewed 2026-07-06) ships a streaming full-account ZIP export; trails should match it with an open-format equivalent.

## What Changes

- New **"Export my data"** action in account settings: produces a ZIP containing every route and activity as its original GPX file (open format first), plus JSON manifests for entities GPX can't carry — profile, route/activity metadata (visibility, tags, sport type, day breaks), route version history, follows, connected-service *names* (never tokens), and notification history.
- Export is generated **streamed** (bounded memory) as a background job with a notification + download link when ready; the artifact is stored temporarily and expires.
- Media (activity photos) included when present.
- Explicitly excluded: OAuth tokens/credentials, sessions, other users' data (followers' profiles beyond handle), federation-internal state.
- Not in scope: **import/restore** of the archive (instance migration) — the export format is versioned and documented so a future import change can consume it.

## Capabilities

### New Capabilities
- `account-export`: The full-account export — contents, format guarantees (GPX originals + versioned JSON manifest), generation lifecycle (async job, expiry), and access control.

### Modified Capabilities

<!-- none — account-management's deletion/email requirements are untouched; export is additive -->

## Impact

- `apps/journal`: new settings surface (`/settings/account`), export job in `@trails-cool/jobs` (pg-boss), streaming ZIP assembly, temporary artifact storage (S3/Garage or local disk with expiry), download route with owner-only auth.
- `packages/db`: small `export_jobs` table (or reuse job state) for status + artifact pointer + expiry.
- Notifications: reuses existing notification pattern for "your export is ready".
- Privacy manifest: document what the export contains (it's the user's own data leaving via the user's own request).
