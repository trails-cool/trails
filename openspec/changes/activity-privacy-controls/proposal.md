## Why

Activity visibility today is all-or-nothing (`private`/`unlisted`/`public`): sharing a ride means sharing exactly when you left home, where the track starts, and your pace. For a privacy-first platform this forces the wrong trade — users who'd happily share the route and photos keep activities private because one field is sensitive. Endurain (reviewed 2026-07-06) demonstrates the answer: independent per-signal hide flags with per-user defaults, per-activity overrides, and a single server-side mask for non-owners. trails should offer the equivalent for the signals it actually stores.

## What Changes

- **Four per-activity privacy flags**, each independent of `visibility`: `hideStartTime` (viewers see the date, not the time), `hideLocation` (no location label, per `activity-locations`), `hideMap` (no map, geometry, elevation-chart positions, or GPX download for non-owners — stats remain), `hidePace` (no pace/speed/moving time; distance and duration remain).
- **Per-user defaults** in profile settings, stamped onto each new activity at creation/import; each activity's flags editable afterward on its edit surface.
- **One server-side mask** applied everywhere a non-owner receives activity data: detail loaders, feeds, public API, GPX download, map thumbnails, and — critically — **federation**: masked fields are omitted from ActivityPub objects so they never leave the instance.
- Scope: activities only (recorded presence is the sensitive data). Routes keep plain visibility; extending flags to routes is a possible follow-up.
- Not in scope: privacy zones (geometry trimming/blurring near saved locations) — a natural later layer on top of this masking infrastructure; per-follower exceptions; retroactive re-federation of already-published objects (changing flags affects what is served/federated from then on; note in UI).

## Capabilities

### New Capabilities
- `activity-privacy`: The per-signal privacy flags — their semantics, user defaults, stamping, the non-owner mask, and its enforcement surface including federation.

### Modified Capabilities

<!-- none — visibility requirements in existing specs are unchanged; masking is an additional filter applied on top. The mask's federation behavior is specified in the new capability rather than as a social-federation delta because no existing federation requirement is contradicted. -->

## Impact

- `packages/db`: `activities.privacy` jsonb (typed four-flag object, default all-false) + `users.activity_privacy_defaults` jsonb + migration.
- Journal: `applyPrivacyMask(activity, viewerIsOwner)` helper used by detail loaders, feed/listing serializers, `api.v1` activity routes, GPX download route, thumbnail/elevation endpoints, and `federation-objects.server.ts` / outbox emission.
- UI: defaults section in profile/privacy settings; per-activity toggles on the activity edit surface; owner-visible "hidden from others" indicators on masked fields (i18n en/de).
- Interacts with in-flight changes: `activity-locations` (label obeys `hideLocation`), `activity-duplicate-review` (quarantine is orthogonal), privacy manifest update.
