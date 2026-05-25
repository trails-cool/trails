import { describe, it, expect } from "vitest";
import {
  countActiveSessions,
  docByteSize,
  getOrCreateDoc,
  deleteDoc,
  MAX_MESSAGE_BYTES,
  MAX_DOC_BYTES,
} from "./yjs-server.ts";

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

describe("doc-size caps", () => {
  it("MAX_MESSAGE_BYTES + MAX_DOC_BYTES are positive and ordered sanely", () => {
    expect(MAX_MESSAGE_BYTES).toBeGreaterThan(0);
    expect(MAX_DOC_BYTES).toBeGreaterThan(MAX_MESSAGE_BYTES);
  });

  it("docByteSize returns 0 for an unknown session", () => {
    expect(docByteSize("no-such-session")).toBe(0);
  });

  it("docByteSize tracks growth and stays below MAX_DOC_BYTES for a realistic route", () => {
    const sid = "size-test";
    const doc = getOrCreateDoc(sid);
    try {
      const empty = docByteSize(sid);
      // Push a few hundred waypoints — typical multi-day route.
      const arr = doc.getArray<{ lat: number; lon: number }>("waypoints");
      doc.transact(() => {
        for (let i = 0; i < 500; i++) {
          arr.push([{ lat: 52 + i / 1000, lon: 13 + i / 1000 }]);
        }
      });
      const filled = docByteSize(sid);
      expect(filled).toBeGreaterThan(empty);
      // Several MB is still well under the cap — abuse needs to be much bigger.
      expect(filled).toBeLessThan(MAX_DOC_BYTES);
    } finally {
      deleteDoc(sid);
    }
  });

  it("docByteSize crosses MAX_DOC_BYTES when fed enough garbage (smoke test for the guard)", () => {
    const sid = "size-cap-test";
    const doc = getOrCreateDoc(sid);
    try {
      // Yjs string updates compress, but raw bytes in a Y.Text approach
      // the underlying state size. Push a ~6MB string in one go.
      const txt = doc.getText("blob");
      const chunk = "x".repeat(64 * 1024); // 64 KB per insert
      doc.transact(() => {
        for (let i = 0; i < 100; i++) txt.insert(i * chunk.length, chunk);
      });
      expect(docByteSize(sid)).toBeGreaterThan(MAX_DOC_BYTES);
    } finally {
      deleteDoc(sid);
    }
  });
});
