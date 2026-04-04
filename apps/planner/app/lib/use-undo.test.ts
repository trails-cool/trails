import { describe, it, expect } from "vitest";
import * as Y from "yjs";

describe("Y.UndoManager with tracked origins", () => {
  it("tracks mutations with 'local' origin", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray("test");
    const um = new Y.UndoManager([arr], { trackedOrigins: new Set(["local"]) });

    doc.transact(() => arr.push(["a"]), "local");
    expect(arr.toArray()).toEqual(["a"]);
    expect(um.undoStack.length).toBe(1);

    um.undo();
    expect(arr.toArray()).toEqual([]);
    expect(um.redoStack.length).toBe(1);

    um.redo();
    expect(arr.toArray()).toEqual(["a"]);
  });

  it("does not track mutations without 'local' origin", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray("test");
    const um = new Y.UndoManager([arr], { trackedOrigins: new Set(["local"]) });

    // No origin
    doc.transact(() => arr.push(["init"]));
    expect(arr.toArray()).toEqual(["init"]);
    expect(um.undoStack.length).toBe(0);

    // Different origin
    doc.transact(() => arr.push(["remote"]), "remote");
    expect(arr.toArray()).toEqual(["init", "remote"]);
    expect(um.undoStack.length).toBe(0);
  });

  it("groups rapid changes within captureTimeout", async () => {
    const doc = new Y.Doc();
    const arr = doc.getArray("test");
    const um = new Y.UndoManager([arr], {
      trackedOrigins: new Set(["local"]),
      captureTimeout: 100,
    });

    doc.transact(() => arr.push(["a"]), "local");
    doc.transact(() => arr.push(["b"]), "local");
    // Both within timeout — should be one undo step
    expect(um.undoStack.length).toBe(1);

    um.undo();
    expect(arr.toArray()).toEqual([]);
  });

  it("stopCapturing separates undo steps", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray("test");
    const um = new Y.UndoManager([arr], {
      trackedOrigins: new Set(["local"]),
      captureTimeout: 10000,
    });

    doc.transact(() => arr.push(["a"]), "local");
    um.stopCapturing();
    doc.transact(() => arr.push(["b"]), "local");

    expect(um.undoStack.length).toBe(2);

    um.undo();
    expect(arr.toArray()).toEqual(["a"]);

    um.undo();
    expect(arr.toArray()).toEqual([]);
  });

  it("tracks multiple shared types", () => {
    const doc = new Y.Doc();
    const waypoints = doc.getArray("waypoints");
    const noGoAreas = doc.getArray("noGoAreas");
    const notes = doc.getText("notes");
    const um = new Y.UndoManager([waypoints, noGoAreas, notes], {
      trackedOrigins: new Set(["local"]),
    });

    doc.transact(() => waypoints.push(["wp1"]), "local");
    um.stopCapturing();
    doc.transact(() => notes.insert(0, "hello"), "local");
    um.stopCapturing();
    doc.transact(() => noGoAreas.push(["nogo1"]), "local");

    expect(um.undoStack.length).toBe(3);

    // Undo in reverse order
    um.undo(); // undo noGoAreas
    expect(noGoAreas.toArray()).toEqual([]);
    expect(notes.toString()).toBe("hello");

    um.undo(); // undo notes
    expect(notes.toString()).toBe("");
    expect(waypoints.toArray()).toEqual(["wp1"]);

    um.undo(); // undo waypoints
    expect(waypoints.toArray()).toEqual([]);
  });
});
