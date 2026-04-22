import { describe, it, expect } from "vitest";
import { countActiveSessions } from "./yjs-server.ts";

describe("countActiveSessions", () => {
  it("is 0 for an empty iterable (regression: prod gauge saw -182 drift)", () => {
    expect(countActiveSessions([])).toBe(0);
  });

  it("counts a single session with one client as 1", () => {
    expect(countActiveSessions([{ sessionId: "s1" }])).toBe(1);
  });

  it("deduplicates multiple clients on the same session", () => {
    expect(
      countActiveSessions([
        { sessionId: "s1" },
        { sessionId: "s1" },
        { sessionId: "s1" },
      ]),
    ).toBe(1);
  });

  it("counts distinct sessions across clients", () => {
    expect(
      countActiveSessions([
        { sessionId: "s1" },
        { sessionId: "s2" },
        { sessionId: "s1" },
        { sessionId: "s3" },
      ]),
    ).toBe(3);
  });

  it("doesn't go negative under the reconnect pattern that broke the old inc/dec logic", () => {
    // Simulate: client connects, client disconnects, reconnects,
    // disconnects again — five times over. The old code would have
    // decremented once per cycle (because `docs` stayed cached, so
    // the re-connect's `isNewSession` check skipped inc). Here we
    // derive from live state, so each empty snapshot is 0, not -N.
    for (let i = 0; i < 5; i++) {
      expect(countActiveSessions([{ sessionId: "s1" }])).toBe(1); // reconnect
      expect(countActiveSessions([])).toBe(0); // disconnect
    }
  });
});
