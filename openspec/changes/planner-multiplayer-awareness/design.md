## Context

Yjs awareness already tracks users with `{ color, name }` state and renders
map cursors via `CursorTracker` in `PlannerMap.tsx`. The current implementation
has issues: random names can't be changed, cursor labels are unstyled, and
there's no participant list showing who's in the session.

## Goals / Non-Goals

**Goals:**
- See all participants in the session (name, color, host/participant role)
- Edit your own name (saved to localStorage, synced via awareness)
- Polished cursor rendering on the map
- Visual feedback when someone joins or leaves

**Non-Goals:**
- Chat or messaging between participants
- Cursor position sharing outside the map (e.g., in the sidebar)
- Participant permissions or kicking (admin-only debug feature already exists)

## Decisions

### D1: Participant list in session header

Show colored dots + names in the header bar (already has space between profile
selector and connection status). Clicking your own name opens an inline edit.
Keeps the sidebar free for waypoints.

### D2: Name persisted in localStorage, synced via awareness

Current approach: random name from a list, stored in localStorage as
`trails:user`. Enhancement: let users edit it. On change, update localStorage
AND call `awareness.setLocalStateField("user", { color, name })`. All other
clients see the update immediately.

### D3: Cursor as SVG pointer with name tag

Replace the current `divIcon` cursor label with: a small SVG arrow in the
user's color + a name tag with background, shadow, and rounded corners.
Position offset so the pointer tip is at the actual lat/lng.

### D4: Join/leave toasts

When awareness detects a new client or a client leaving, show a brief toast
("Alice joined" / "Bob left") that auto-dismisses after 3 seconds. Use a
simple absolute-positioned div, no toast library.
