import { describe, it, expect } from "vitest";
import { buildColorRuns } from "./color-runs.ts";

// coord i = [lon=i, lat=100+i, ele=0]  →  emitted point = [lat, lon] = [100+i, i]
const coords = (n: number): [number, number, number][] =>
  Array.from({ length: n }, (_, i) => [i, 100 + i, 0]);

describe("buildColorRuns", () => {
  it("returns nothing for fewer than 2 coordinates", () => {
    expect(buildColorRuns([], () => "a")).toEqual([]);
    expect(buildColorRuns(coords(1), () => "a")).toEqual([]);
  });

  it("collapses a uniform-color route to a single polyline", () => {
    const runs = buildColorRuns(coords(1000), () => "#abc");
    expect(runs).toHaveLength(1);
    expect(runs[0]!.color).toBe("#abc");
    // one polyline through all 1000 points (not ~999 segments)
    expect(runs[0]!.positions).toHaveLength(1000);
    expect(runs[0]!.positions[0]).toEqual([100, 0]);
    expect(runs[0]!.positions[999]).toEqual([1099, 999]);
  });

  it("splits into contiguous runs at color changes, sharing boundary points", () => {
    // 5 coords → segments 0..3; colors: A A B A
    const seg = ["A", "A", "B", "A"];
    const runs = buildColorRuns(coords(5), (i) => seg[i]!);
    expect(runs.map((r) => r.color)).toEqual(["A", "B", "A"]);
    // run A: points 0,1,2 ; run B: points 2,3 ; run A: points 3,4
    expect(runs[0]!.positions).toEqual([[100, 0], [101, 1], [102, 2]]);
    expect(runs[1]!.positions).toEqual([[102, 2], [103, 3]]);
    expect(runs[2]!.positions).toEqual([[103, 3], [104, 4]]);
    // boundary points are shared so the drawn line stays continuous
    expect(runs[0]!.positions.at(-1)).toEqual(runs[1]!.positions[0]);
    expect(runs[1]!.positions.at(-1)).toEqual(runs[2]!.positions[0]);
  });

  it("every-segment-different still works (worst case)", () => {
    const runs = buildColorRuns(coords(4), (i) => `c${i}`);
    // segments 0,1,2 all distinct → 3 runs, each a 2-point polyline
    expect(runs.map((r) => r.color)).toEqual(["c0", "c1", "c2"]);
    expect(runs.every((r) => r.positions.length === 2)).toBe(true);
  });
});
