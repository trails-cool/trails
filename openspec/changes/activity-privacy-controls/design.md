## Context

Activities carry `visibility` (private/unlisted/public) plus `audience` for federation; non-owner access control happens in the detail loaders and list scopes, and federation publishes activity objects via `federation-objects.server.ts`/outbox. Signals stored per activity: `startedAt`, geometry/GPX, elevation series (whose samples include lat/lng for chart↔map sync), distance, duration, moving time, derived pace/speed (`stats.ts`), photos, and (per the `activity-locations` change) a location label.

Endurain's reference: 13 boolean `hide_*` columns + user defaults stamped at import + `apply_visibility_mask()` nulling fields for non-owners + one frontend gate. trails needs fewer flags (no HR/power/cadence stored) but a wider enforcement surface (federation).

## Goals / Non-Goals

**Goals:**
- Share a ride without sharing when you left, where exactly, or how fast — four independent, comprehensible flags.
- Masked data never reaches a non-owner through *any* surface, including ActivityPub objects, GPX downloads, and chart data.
- Defaults make it a set-once decision; per-activity override stays available.

**Non-Goals:**
- Privacy zones (geometry editing near saved places) — separate change layered on this mask.
- Route-level flags, per-follower exceptions, HR/power flags (nothing stored to hide).
- Retracting already-federated copies on flag changes (Update activities may be sent, but remote caches are best-effort — honest UI note instead of a false promise).

## Decisions

### 1. Four flags, jsonb, typed

`activities.privacy: { hideStartTime, hideLocation, hideMap, hidePace }` (jsonb, default `{}` = nothing hidden) and `users.activity_privacy_defaults` with the same shape. Jsonb over boolean columns: the set will grow (privacy zones, photo location stripping), flags are never queried server-side as predicates (masking is row-level at serialization), and the schema convention already favors typed jsonb for extensible shapes (cf. `SurfaceBreakdown`).

Flag semantics (what a non-owner loses):
- `hideStartTime` → `startedAt` truncated to date (feed ordering uses the real value server-side).
- `hideLocation` → no location label; start/end markers not distinguished on the map (map itself governed by `hideMap`).
- `hideMap` → no geometry, no map, no thumbnail, no GPX download, elevation profile served as distance/elevation only (positions stripped) or omitted.
- `hidePace` → no pace/speed/moving time; distance + elapsed duration remain.

### 2. One mask at the serialization boundary

`applyActivityPrivacyMask(data, { isOwner })` lives beside `stats.ts` and is the only place flag semantics are implemented. Loaders/serializers call it before returning non-owner payloads; the GPX/thumbnail/elevation endpoints check `hideMap` explicitly (they return binary, not the masked object). Owners always receive everything plus the flag state (so the UI can show "hidden from others" badges).

*Alternative:* masking in the frontend gate (Endurain's `VisibilityGate`) — rejected as the primary mechanism: data must not reach the client at all; a UI gate is cosmetic. Frontend only renders what it receives.

### 3. Federation: mask at object-build time

`federation-objects.server.ts` builds AP objects through the same mask with `isOwner: false` — a hidden map means the published object carries no geometry attachment; hidden start time publishes date precision only. Flag changes after publish affect subsequent serves and trigger an AP `Update`; remote re-fetch honesty is best-effort (documented in UI copy: "already-shared copies may persist on other instances").

### 4. Stamping and editing

Defaults stamp at creation in the shared save path (upload, provider import, planner handoff). The activity edit surface exposes the four toggles; the settings page edits defaults (affecting future activities only, stated in copy). Demo-bot and e2e fixtures default to nothing hidden.

## Risks / Trade-offs

- [A new endpoint forgets the mask] → Single helper + a table-driven regression test that walks every activity-serving route as a non-owner and asserts hidden fields absent for a fully-flagged fixture; code-review rule noted in the spec.
- [Elevation chart without positions degrades chart↔map sync] → Intended: with `hideMap` there is no map to sync to; chart renders standalone.
- [Federated copies predate a newly-set flag] → Honest UI note + AP Update on change; no false retraction promise.
- [Flag sprawl later] → jsonb shape + single mask keep additions one-file changes.

## Migration Plan

Additive columns (default `{}` = current behavior — nothing hidden). Ship mask + UI together; existing activities unaffected until a user sets flags. Rollback = revert; stored flags become inert.

## Open Questions

- None blocking. Privacy zones (trim/blur geometry within N meters of saved locations) are the designed-for follow-up on top of `hideMap`'s enforcement points.
