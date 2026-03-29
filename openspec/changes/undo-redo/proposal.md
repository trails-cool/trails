## Why

Route editing mistakes in the Planner have no recovery path. Accidentally
deleting a waypoint, dragging to the wrong spot, or removing a no-go area
requires manually recreating the change. This is especially frustrating during
complex multi-waypoint edits where a single misclick can undo minutes of work.

Every desktop editing tool supports Ctrl+Z. Users expect it. Its absence is
the most obvious missing affordance in the Planner.

## What Changes

- Add undo/redo support to the Planner's route editor using Yjs's built-in
  `UndoManager`
- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo)
- Undo/redo buttons in the topbar with disabled state when the stack is empty
- Only the current user's changes are undone -- collaborative-safe by design.
  Other participants' edits are never affected by your undo.

## Scope

Tracked types:
- `waypoints` (Y.Array) -- add, remove, reorder, drag-move
- `noGoAreas` (Y.Array) -- add, remove
- `notes` (Y.Text) -- text edits

`routeData` (Y.Map) is **not** tracked. It contains derived data (route
geometry, segment boundaries) computed by BRouter, not direct user input.
Undoing a waypoint change will trigger a re-route automatically.

## Non-Goals

- Infinite undo history -- UndoManager keeps a reasonable in-memory stack,
  no persistence needed
- Undo across sessions -- the undo stack is in-memory and resets when
  the page is closed or the WebSocket reconnects
- Undo for route options (profile selection, color mode) -- these are
  infrequent, low-risk changes that don't warrant undo tracking
- Granular undo for individual keystrokes in notes -- Y.Text undo groups
  by capture timeout, which is good enough

## Capabilities

### New Capabilities

- `undo-redo`: Undo/redo for route editing operations in the Planner via
  keyboard shortcuts and topbar buttons, scoped to the local user's changes

### Modified Capabilities

(None)

## Impact

- **Files**: New hook (`use-undo.ts`), modified `use-yjs.ts` (transaction
  origins), modified `SessionView.tsx` (buttons + keyboard handler), modified
  mutation sites in `PlannerMap.tsx`, `WaypointSidebar.tsx`,
  `NoGoAreaLayer.tsx`, `NotesPanel.tsx`
- **Dependencies**: None -- Yjs `UndoManager` is built into the `yjs` package
  already in use
- **i18n**: Tooltip strings for undo/redo buttons
