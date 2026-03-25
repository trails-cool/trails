## Why

The Planner's core editing works but is missing features from the architecture
doc: no-go areas for route avoidance, session notes for collaborative planning
communication, localStorage crash recovery for unsaved work, and rate limiting
to protect the BRouter API from abuse on the public instance.

## What Changes

- **No-go areas**: Draw polygons on the map that BRouter avoids when computing
  routes. Stored as Y.Array in the Yjs doc, synced across participants.
- **Session notes**: Shared text area (Y.Text) for participants to leave notes,
  discuss the route, or plan logistics. Visible in the sidebar.
- **Crash recovery**: Periodically save Yjs state to localStorage. On
  reconnect, merge local state with server state to recover unsaved changes.
- **Rate limiting**: Limit session creation per IP and BRouter API calls per
  session to prevent abuse on the public instance.

## Capabilities

### New Capabilities

- `no-go-areas`: Draw avoidance polygons on the Planner map, passed to BRouter as routing constraints
- `session-notes`: Shared collaborative text in Planner sessions via Yjs Y.Text
- `crash-recovery`: localStorage backup of Yjs state for reconnection after browser crash
- `rate-limiting`: IP-based limits on session creation and route computation

### Modified Capabilities

- `planner-session`: Session data model gains noGoAreas and notes fields
- `brouter-integration`: Routing requests include no-go area polygons
- `map-display`: Map gains polygon drawing tools for no-go areas

## Impact

- **Planner Yjs doc**: New fields (noGoAreas: Y.Array, notes: Y.Text)
- **BRouter API**: No-go areas passed as `nogo` parameter
- **Map**: Leaflet.draw or custom polygon tool for no-go areas
- **Dependencies**: May need `leaflet-draw` for polygon editing
- **Server**: Rate limiting middleware (in-memory store)
