import { describe, it, expect } from "vitest";
import * as Y from "yjs";

/**
 * Tests the crash recovery encode/decode logic used in use-yjs.ts.
 * The actual hook wiring is tested via E2E; these verify the data round-trip.
 */
describe("crash recovery", () => {
  it("round-trips Yjs state through base64 localStorage format", () => {
    const doc = new Y.Doc();
    const waypoints = doc.getArray("waypoints");
    const wp = new Y.Map();
    wp.set("lat", 52.52);
    wp.set("lon", 13.405);
    waypoints.push([wp]);

    // Encode (same as use-yjs.ts save)
    const state = Y.encodeStateAsUpdate(doc);
    const b64 = btoa(String.fromCharCode(...state));

    // Decode (same as use-yjs.ts restore)
    const restored = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, restored);

    const restoredWaypoints = doc2.getArray("waypoints");
    expect(restoredWaypoints.length).toBe(1);
    const restoredWp = restoredWaypoints.get(0) as Y.Map<unknown>;
    expect(restoredWp.get("lat")).toBe(52.52);
    expect(restoredWp.get("lon")).toBe(13.405);
  });

  it("merges local and remote state without conflict", () => {
    // Simulate: local has waypoint A, server has waypoint B
    const local = new Y.Doc();
    const localWps = local.getArray("waypoints");
    const wpA = new Y.Map();
    wpA.set("lat", 52.0);
    wpA.set("lon", 13.0);
    localWps.push([wpA]);

    const remote = new Y.Doc();
    const remoteWps = remote.getArray("waypoints");
    const wpB = new Y.Map();
    wpB.set("lat", 48.0);
    wpB.set("lon", 11.0);
    remoteWps.push([wpB]);

    // Merge remote into local (simulates reconnect)
    const remoteState = Y.encodeStateAsUpdate(remote);
    Y.applyUpdate(local, remoteState);

    // Both waypoints should exist
    expect(localWps.length).toBe(2);
  });
});
