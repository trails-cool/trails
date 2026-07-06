## Why

The only way to show a private route or activity to someone today is to change its visibility (`unlisted`/`public`) or share per-user (`route-sharing`, which requires the recipient to have an account). There's no way to send a private hike to a partner or a guide without either publishing it or onboarding them. wanderer's `trail_link_share` model (reviewed 2026-07-06, `docs/inspirations.md`) fills exactly this gap: revocable tokenized links that grant access to one resource, no account required — sharper than `unlisted` because links can be individually created, tracked, and revoked without touching the content's visibility.

## What Changes

- **Share links** for routes and activities: the owner can create one or more links per resource, each carrying an unguessable token; anyone opening the link sees the resource read-only, regardless of its `private` visibility.
- Links are **revocable individually**, support optional expiry, and show created/last-used timestamps in a management UI on the resource's share dialog.
- Tokens are stored **hashed** (the plaintext appears only once at creation), following the API-token hygiene wanderer and Endurain both apply.
- **Privacy flags still apply**: a link viewer is a non-owner, so `activity-privacy-controls` masking governs what they see; link access never includes GPX download when `hideMap` is set, etc.
- Link-shared content is **never federated, listed, or indexed** — the link grants direct access only.
- View-only. Edit sharing remains `route-sharing`'s per-user model and the Planner's JWT callback flow.
- Not in scope: edit-capable links, link passwords, per-link view counters beyond last-used, and OG-preview unfurling for link-shared private content (deliberately withheld — an unfurl would leak content to chat servers).

## Capabilities

### New Capabilities
- `link-sharing`: Tokenized share links for routes and activities — creation, access semantics relative to visibility and privacy flags, revocation/expiry, and the non-listing/non-federation guarantees.

### Modified Capabilities

<!-- none — visibility semantics ("private: only the owner") gain a documented exception defined wholly in the new capability; route-sharing's per-user requirements are untouched and complementary -->

## Impact

- `packages/db`: `share_links` table (token hash, resource type+id, owner, expiry, revoked, last-used) + migration.
- Journal: loader access checks for route/activity detail (and their read-only sub-resources: elevation data, thumbnail — but not GPX download unless privacy flags allow) accept a valid token; share dialog UI for create/copy/revoke; i18n.
- Rate limiting on token lookup to blunt brute-force scanning (tokens are 128-bit+, so this is belt-and-braces).
- Privacy manifest: document the feature (access records limited to last-used timestamp).
