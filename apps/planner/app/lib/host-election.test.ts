import { describe, it, expect } from "vitest";
import { electHost } from "./host-election";

function makeStates(
  entries: Array<{ id: number; user?: boolean; role?: string }>,
): Map<number, Record<string, unknown>> {
  const map = new Map<number, Record<string, unknown>>();
  for (const e of entries) {
    const state: Record<string, unknown> = {};
    if (e.user) state.user = { color: "#000", name: "Test" };
    if (e.role) state.role = e.role;
    map.set(e.id, state);
  }
  return map;
}

describe("electHost", () => {
  it("elects the only real client as host", () => {
    const states = makeStates([
      { id: 100, user: true },
    ]);
    expect(electHost(states, 100)).toEqual({ isHost: true, role: "host" });
  });

  it("elects lowest ID among two real clients", () => {
    const states = makeStates([
      { id: 200, user: true },
      { id: 100, user: true },
    ]);
    expect(electHost(states, 100)).toEqual({ isHost: true, role: "host" });
    expect(electHost(states, 200)).toEqual({ isHost: false, role: "participant" });
  });

  it("ignores server docs (no user state)", () => {
    const states = makeStates([
      { id: 50 },             // server doc — lowest ID but no user
      { id: 200, user: true },
      { id: 100, user: true },
    ]);
    expect(electHost(states, 100)).toEqual({ isHost: true, role: "host" });
    expect(electHost(states, 200)).toEqual({ isHost: false, role: "participant" });
  });

  it("always assigns a role (never undefined)", () => {
    const states = makeStates([
      { id: 300, user: true },
      { id: 100, user: true },
      { id: 200, user: true },
    ]);
    const result = electHost(states, 200);
    expect(result.role).toBeDefined();
    expect(result.role).toBe("participant");
  });

  it("handles single client with server doc", () => {
    const states = makeStates([
      { id: 999 },           // server
      { id: 500, user: true },
    ]);
    expect(electHost(states, 500)).toEqual({ isHost: true, role: "host" });
  });

  it("handles no real clients (defensive)", () => {
    const states = makeStates([
      { id: 10 },  // server only
    ]);
    // localId not in states — still returns host as fallback
    expect(electHost(states, 42)).toEqual({ isHost: true, role: "host" });
  });

  it("ignores existing role claims — always uses lowest ID", () => {
    const states = makeStates([
      { id: 200, user: true, role: "host" },
      { id: 100, user: true, role: "participant" },
    ]);
    // ID 100 should be host regardless of current role claims
    expect(electHost(states, 100)).toEqual({ isHost: true, role: "host" });
    expect(electHost(states, 200)).toEqual({ isHost: false, role: "participant" });
  });

  it("works with many clients", () => {
    const states = makeStates([
      { id: 999, user: true },
      { id: 500, user: true },
      { id: 42 },  // server
      { id: 200, user: true },
      { id: 100, user: true },
      { id: 800, user: true },
    ]);
    expect(electHost(states, 100)).toEqual({ isHost: true, role: "host" });
    expect(electHost(states, 500)).toEqual({ isHost: false, role: "participant" });
    expect(electHost(states, 999)).toEqual({ isHost: false, role: "participant" });
  });
});
