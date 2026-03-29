## Context

The Planner uses Yjs for collaborative CRDT state with four shared types:
`waypoints` (Y.Array), `noGoAreas` (Y.Array), `routeData` (Y.Map), and
`notes` (Y.Text). All mutations happen through Yjs transactions. The editor
supports multiple simultaneous users via y-websocket.

Yjs provides a built-in `UndoManager` class that tracks changes to specified
shared types, scoped by transaction origin, with configurable capture
timeouts for grouping related changes.

## Goals / Non-Goals

**Goals:**
- Undo/redo for waypoint operations (add, delete, reorder, drag-move)
- Undo/redo for no-go area operations (add, delete)
- Undo/redo for notes text edits
- Keyboard shortcuts that work naturally (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y)
- Topbar buttons with visual disabled state
- Collaborative-safe: only undo your own changes, never other users'
- Drag operations grouped as a single undo step

**Non-Goals:**
- Undo for routeData (derived data, not user input)
- Undo for route options / color mode changes
- Persistent undo history across page reloads
- Customizable undo stack depth

## Decisions

### D1: Single UndoManager tracking waypoints, noGoAreas, and notes

Create one `Y.UndoManager` instance in `use-yjs.ts`, tracking all three
user-editable shared types: `waypoints`, `noGoAreas`, and `notes`.

```ts
const undoManager = new Y.UndoManager(
  [waypoints, noGoAreas, notes],
  {
    captureTimeout: 500,
    trackedOrigins: new Set(["local"]),
  }
);
```

A single UndoManager means undo walks back through all user actions in order,
regardless of which shared type was modified. This matches user expectations:
"undo my last thing" not "undo my last waypoint thing."

The UndoManager is created inside the `useYjs` hook and exposed on the
`YjsState` interface so all components can access it.

### D2: Transaction origins for local vs. remote scoping

All local mutations must use the origin `"local"` so UndoManager can
distinguish them from remote changes arriving via y-websocket:

```ts
doc.transact(() => {
  waypoints.push([yMap]);
}, "local");
```

Current code has some `doc.transact()` calls without an origin and some
direct mutations (e.g., `yjs.waypoints.push([yMap])`) outside a transaction.
All mutation sites need to be wrapped in `doc.transact(() => { ... }, "local")`.

Mutation sites to update:
- `PlannerMap.tsx`: `addWaypoint`, `insertWaypointAtSegment`, `moveWaypoint`,
  `deleteWaypoint`
- `WaypointSidebar.tsx`: `deleteWaypoint`, `moveWaypoint`
- `NoGoAreaLayer.tsx`: no-go area creation (`pm:create` handler), no-go area
  deletion (contextmenu handler)
- `NotesPanel.tsx`: `handleInput` (already uses `doc.transact`, needs origin)
- `use-yjs.ts`: initial waypoint seeding (use `"init"` origin, not `"local"`,
  so it's not undoable)

### D3: Keyboard shortcuts

Register a global `keydown` listener (in a `useUndoShortcuts` hook or
similar) that handles:
- **Ctrl+Z** (or Cmd+Z on macOS): `undoManager.undo()`
- **Ctrl+Shift+Z** or **Ctrl+Y** (Cmd+Shift+Z on macOS): `undoManager.redo()`

The listener must suppress when the active element is an `<input>`,
`<textarea>`, or `[contenteditable]` -- these elements have their own
browser-native undo/redo behavior. The notes textarea is the main case.

However, since notes Y.Text is tracked by our UndoManager, we may want to
**not** suppress in the notes textarea and instead use the Yjs undo there
too. Decision: suppress for now and let the browser handle textarea undo
natively. This avoids complexity around cursor position restoration.

### D4: Topbar undo/redo buttons

Add two icon buttons to the header in `SessionView.tsx`, positioned in the
left group next to the participant list:

- Undo button: left-curved arrow icon, `title` with shortcut hint
- Redo button: right-curved arrow icon, `title` with shortcut hint
- Both disabled (grayed out) when their respective stack is empty

Use simple inline SVG or Unicode arrows (e.g., `\u21B6` / `\u21B7` or
custom SVG) to avoid adding an icon library dependency.

### D5: Undo granularity and drag grouping

The `captureTimeout` of 500ms means rapid successive changes (within 500ms)
are grouped into one undo step. This works well for:
- Quick waypoint additions (each click is >500ms apart, so separate steps)
- Text typing in notes (keystrokes within 500ms grouped together)

For **drag operations** (waypoint drag on map), the marker `dragstart` fires
once, then multiple `drag` events update position, then `dragend` fires. The
intermediate positions should not be separate undo steps.

Strategy: Call `undoManager.stopCapturing()` at `dragstart`. This forces the
next change to start a new capture group. Then all position updates during
the drag happen within the capture timeout window and merge into one step.
After `dragend`, no special action needed -- the next user action will
naturally start a new group after 500ms.

Note: Currently `moveWaypoint` in `PlannerMap.tsx` is only called on
`dragend`, not during drag, so intermediate positions are not stored in Yjs.
This means drag is already a single undo step. The `stopCapturing()` call is
still useful as a safeguard in case drag behavior changes later, and to
separate the drag from any preceding action within the capture window.

### D6: Stack state reactivity

`UndoManager` fires `stack-item-added`, `stack-item-popped`,
`stack-item-updated` events. Use these to maintain reactive `canUndo` /
`canRedo` booleans in a `useUndo` hook:

```ts
export function useUndo(undoManager: Y.UndoManager | null) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (!undoManager) return;
    const update = () => {
      setCanUndo(undoManager.undoStack.length > 0);
      setCanRedo(undoManager.redoStack.length > 0);
    };
    undoManager.on("stack-item-added", update);
    undoManager.on("stack-item-popped", update);
    undoManager.on("stack-item-updated", update);
    update();
    return () => {
      undoManager.off("stack-item-added", update);
      undoManager.off("stack-item-popped", update);
      undoManager.off("stack-item-updated", update);
    };
  }, [undoManager]);

  return { canUndo, canRedo };
}
```

The buttons read `canUndo` / `canRedo` and set `disabled` accordingly.

### D7: Notes undo interaction

`notes` (Y.Text) is included in the UndoManager's tracked types. However,
keyboard shortcuts are suppressed when the textarea is focused (D3), so:

- **In the textarea**: Browser-native undo (Ctrl+Z) handles text editing.
  This is familiar and handles cursor position correctly.
- **Outside the textarea**: Yjs undo can revert notes changes as part of the
  global undo stack. This means if you edit notes, click on the map, then
  press Ctrl+Z, the notes edit will be undone via Yjs.

This is a pragmatic split. If it causes confusion (users expecting Ctrl+Z in
textarea to use the Yjs stack), we can revisit.

## Risks / Trade-offs

- **Undo after remote changes can be surprising** -- If another user adds a
  waypoint between your two actions, undoing your second action still works
  correctly (Yjs handles this), but the route may look unexpected because the
  remote waypoint remains. This is inherent to collaborative undo and
  acceptable.
- **No cursor restoration for notes** -- When undoing a notes change via the
  Yjs UndoManager (from outside the textarea), the textarea content updates
  but the cursor position is not restored. This is a minor UX gap.
- **captureTimeout grouping edge cases** -- Two rapid distinct actions
  (e.g., delete waypoint then immediately add no-go area) within 500ms will
  be grouped as one undo step. Unlikely in practice and acceptable.
