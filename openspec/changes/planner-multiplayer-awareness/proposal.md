## Why

The Planner supports collaborative editing but the multiplayer experience is
bare. Users can't see who else is in the session. Cursor labels are small
floating divs that look broken (no proper styling, overlap with map controls).
Users get randomly assigned names like "Hiker" or "Explorer" with no way to
change them. This makes collaboration confusing — you can't tell who is who.

## What Changes

- **Participant list**: Show who's in the session (name, color, host badge)
  in the sidebar or header
- **Name editing**: Let users set their name after joining (persisted in
  localStorage, synced via Yjs awareness)
- **Cursor styling**: Fix cursor labels — proper pointer icon, name tag with
  shadow, avoid overlap with map controls
- **Connection indicators**: Show when participants join/leave

## Capabilities

### New Capabilities

(None — this enhances existing Yjs awareness features.)

### Modified Capabilities

- `planner-session`: Session view gains participant list and name editing
- `map-display`: Map cursor rendering improved

## Impact

- **Files**: `PlannerMap.tsx` (cursor styling), `SessionView.tsx` (participant
  list), `use-yjs.ts` (name editing), new `ParticipantList` component
- **Dependencies**: None
- **i18n**: New keys for participant labels and name editing
