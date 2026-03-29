## 1. Core: UndoManager Setup

- [ ] 1.1 Create `apps/planner/app/lib/use-undo.ts` hook that takes a `Y.UndoManager` and exposes `canUndo`, `canRedo`, `undo()`, `redo()` via UndoManager event listeners (`stack-item-added`, `stack-item-popped`, `stack-item-updated`)
- [ ] 1.2 Create the `Y.UndoManager` in `use-yjs.ts`, tracking `[waypoints, noGoAreas, notes]` with `captureTimeout: 500` and `trackedOrigins: new Set(["local"])`. Expose it on the `YjsState` interface. Destroy it in the cleanup function.
- [ ] 1.3 Add `"local"` origin to all mutation sites:
  - `PlannerMap.tsx`: wrap `addWaypoint`, `insertWaypointAtSegment`, `moveWaypoint`, `deleteWaypoint` in `doc.transact(() => { ... }, "local")`
  - `WaypointSidebar.tsx`: wrap `deleteWaypoint` and `moveWaypoint` in `doc.transact(() => { ... }, "local")`
  - `NoGoAreaLayer.tsx`: add `"local"` origin to the `pm:create` and contextmenu delete transactions
  - `NotesPanel.tsx`: add `"local"` origin to the existing `doc.transact()` call
  - `use-yjs.ts`: use `"init"` (not `"local"`) as origin for initial waypoint seeding so it is not undoable

## 2. Keyboard Shortcuts

- [ ] 2.1 Create a `useUndoShortcuts` hook (in `use-undo.ts` or separate file) that registers a global `keydown` listener for Ctrl+Z / Cmd+Z (undo) and Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y (redo). Calls `undoManager.undo()` / `undoManager.redo()` and calls `e.preventDefault()`.
- [ ] 2.2 Suppress the shortcut when the active element is `<input>`, `<textarea>`, or `[contenteditable]` so browser-native undo works in text fields (especially the notes textarea).

## 3. UI: Topbar Buttons

- [ ] 3.1 Add undo and redo icon buttons to the `SessionView.tsx` header, in the left group near the participant list. Use inline SVG arrows. Wire to `undo()` / `redo()` from the `useUndo` hook.
- [ ] 3.2 Disable buttons when `canUndo` / `canRedo` is false (gray out, set `disabled` attribute). Add `title` tooltips showing the keyboard shortcut (platform-aware: Cmd on macOS, Ctrl elsewhere).

## 4. Drag Operation Grouping

- [ ] 4.1 In `PlannerMap.tsx`, call `undoManager.stopCapturing()` before the drag transaction to ensure the drag is isolated as its own undo step (separated from any preceding action within the capture timeout window). Access `undoManager` from the `yjs` prop.

## 5. i18n

- [ ] 5.1 Add translation keys for undo/redo button tooltips (`undo.tooltip`, `redo.tooltip`) in both English and German translation files for the planner namespace.

## 6. Testing

- [ ] 6.1 Unit tests for `use-undo.ts`: verify `canUndo`/`canRedo` reactivity, verify `undo()` and `redo()` call through to UndoManager, verify state updates on stack events. Use a real `Y.Doc` + `Y.UndoManager` (not mocks).
- [ ] 6.2 Unit test for transaction origins: create a Y.Doc with UndoManager, perform mutations with `"local"` origin, verify they appear on the undo stack. Perform mutations with no origin or `"init"` origin, verify they do not appear on the undo stack.
- [ ] 6.3 E2E test: add two waypoints, press Ctrl+Z, verify last waypoint is removed. Press Ctrl+Shift+Z, verify it reappears. Test undo/redo buttons in the topbar (click, verify disabled state).
