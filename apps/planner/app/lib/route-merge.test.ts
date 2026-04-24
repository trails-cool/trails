import { describe, expect, it } from "vitest";
import { hashNoGoAreas, pairKey } from "./route-merge";

describe("pairKey", () => {
  it("is stable for the same inputs", () => {
    const a = pairKey({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, "trekking", "abc");
    const b = pairKey({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, "trekking", "abc");
    expect(a).toBe(b);
  });

  it("changes when the profile changes", () => {
    const a = pairKey({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, "trekking", "");
    const b = pairKey({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, "fastbike", "");
    expect(a).not.toBe(b);
  });

  it("changes when either endpoint moves", () => {
    const base = pairKey({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, "p", "");
    const moveFrom = pairKey({ lat: 1.0001, lon: 2 }, { lat: 3, lon: 4 }, "p", "");
    const moveTo = pairKey({ lat: 1, lon: 2 }, { lat: 3, lon: 4.0001 }, "p", "");
    expect(base).not.toBe(moveFrom);
    expect(base).not.toBe(moveTo);
  });

  it("is direction-sensitive (A→B and B→A are distinct)", () => {
    const forward = pairKey({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, "p", "");
    const reverse = pairKey({ lat: 3, lon: 4 }, { lat: 1, lon: 2 }, "p", "");
    expect(forward).not.toBe(reverse);
  });

  it("changes when the no-go hash changes", () => {
    const a = pairKey({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, "p", "h1");
    const b = pairKey({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, "p", "h2");
    expect(a).not.toBe(b);
  });
});

describe("hashNoGoAreas", () => {
  it("returns empty string for no areas", () => {
    expect(hashNoGoAreas()).toBe("");
    expect(hashNoGoAreas([])).toBe("");
  });

  it("is stable for equal inputs", () => {
    const areas = [
      { points: [{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, { lat: 5, lon: 6 }] },
    ];
    expect(hashNoGoAreas(areas)).toBe(hashNoGoAreas(areas));
  });

  it("differs when a polygon changes", () => {
    const a = hashNoGoAreas([
      { points: [{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, { lat: 5, lon: 6 }] },
    ]);
    const b = hashNoGoAreas([
      { points: [{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, { lat: 5, lon: 7 }] },
    ]);
    expect(a).not.toBe(b);
  });
});
