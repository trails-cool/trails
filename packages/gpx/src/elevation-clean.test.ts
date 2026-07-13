import { describe, it, expect } from "vitest";
import {
  despike,
  filteredTotals,
  cumulativeFilteredTotals,
  type ElevPoint,
} from "./elevation-clean.ts";

// Points 10 m apart horizontally unless a test needs otherwise.
const seq = (elevations: number[], step = 10): ElevPoint[] =>
  elevations.map((elevation, i) => ({ distance: i * step, elevation }));

describe("despike", () => {
  it("interpolates an isolated peak spike out", () => {
    // A 100 m spike over 10 m horizontally = 1000% slope up then down.
    const out = despike(seq([100, 100, 200, 100, 100]));
    expect(out[2]!.elevation).toBeCloseTo(100, 6); // interpolated between neighbours
  });

  it("interpolates an isolated pit spike out", () => {
    const out = despike(seq([200, 200, 100, 200, 200]));
    expect(out[2]!.elevation).toBeCloseTo(200, 6);
  });

  it("leaves a steep monotonic climb untouched (same-sign slopes)", () => {
    // Each step +60 m / 10 m = 600% — steep, but climbing, so never a spike.
    const input = seq([0, 60, 120, 180, 240]);
    const out = despike(input);
    expect(out.map((p) => p.elevation)).toEqual([0, 60, 120, 180, 240]);
  });

  it("does not touch endpoints or short segments", () => {
    expect(despike(seq([500, 0])).map((p) => p.elevation)).toEqual([500, 0]);
    expect(despike(seq([0])).map((p) => p.elevation)).toEqual([0]);
  });
});

describe("filteredTotals", () => {
  it("suppresses sub-threshold jitter to zero", () => {
    const t = filteredTotals(seq([100, 102, 99, 101, 98, 100]), { noiseThresholdM: 5 });
    expect(t.gain).toBe(0);
    expect(t.loss).toBe(0);
    expect(t.gainRaw).toBeGreaterThan(0); // raw sees every wobble
  });

  it("counts a multi-leg climb fully when legs exceed the threshold", () => {
    // +10 m per step, 5 steps = 100 m; each leg > 5 m threshold.
    const t = filteredTotals(seq([0, 10, 20, 30, 40, 50]), { noiseThresholdM: 5 });
    expect(t.gain).toBe(50);
    expect(t.loss).toBe(0);
  });

  it("counts descent and separates it from ascent", () => {
    const t = filteredTotals(seq([100, 130, 100]), { noiseThresholdM: 5 });
    expect(t.gain).toBe(30);
    expect(t.loss).toBe(30);
  });

  it("falls back to net change (not raw sum) when a direction filters to zero", () => {
    // Sub-threshold steps that net +3 m: filtered gain is 0, so report the
    // net (+3), NOT the raw sum-of-deltas (which would re-inflate jitter).
    const points = seq([100, 102, 101, 103]);
    const t = filteredTotals(points, { noiseThresholdM: 5 });
    expect(t.gain).toBe(3); // net = 103 − 100
    expect(t.gainRaw).toBeGreaterThan(t.gain); // raw sum (+2 −1 +2 = 4) is larger
  });
});

describe("cumulativeFilteredTotals", () => {
  it("produces running arrays whose last values equal the filtered totals", () => {
    const points = seq([0, 10, 20, 10, 0]);
    const { ascent, descent } = cumulativeFilteredTotals(points, { noiseThresholdM: 5 });
    expect(ascent).toHaveLength(points.length);
    expect(descent).toHaveLength(points.length);
    expect(ascent[0]).toBe(0);
    const totals = filteredTotals(points, { noiseThresholdM: 5 });
    expect(ascent[ascent.length - 1]).toBe(totals.gain);
    expect(descent[descent.length - 1]).toBe(totals.loss);
  });

  it("is monotonically non-decreasing (a day split can subtract two indices)", () => {
    const { ascent, descent } = cumulativeFilteredTotals(seq([0, 20, 10, 40, 40]), { noiseThresholdM: 5 });
    for (let i = 1; i < ascent.length; i++) {
      expect(ascent[i]!).toBeGreaterThanOrEqual(ascent[i - 1]!);
      expect(descent[i]!).toBeGreaterThanOrEqual(descent[i - 1]!);
    }
  });
});
