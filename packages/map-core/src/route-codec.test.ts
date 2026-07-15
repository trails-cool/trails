import { describe, it, expect } from "vitest";
import {
  encodePolyline,
  decodePolyline,
  encodeRuns,
  decodeRuns,
  encodeElevations,
  decodeElevations,
  isEncodedPolyline,
  isEncodedRuns,
  isEncodedElevations,
} from "./route-codec.ts";

describe("polyline codec", () => {
  it("round-trips coordinates within ~1 m", () => {
    const coords: [number, number][] = [
      [13.4051234, 52.5204567],
      [13.4061, 52.5211],
      [13.408912, 52.523401],
      [11.5763, 48.1372],
    ];
    const decoded = decodePolyline(encodePolyline(coords));
    expect(decoded).toHaveLength(coords.length);
    for (let i = 0; i < coords.length; i++) {
      expect(decoded[i]![0]).toBeCloseTo(coords[i]![0], 4); // ~1e-4 deg ≈ 11 m; 5-precision is finer
      expect(decoded[i]![1]).toBeCloseTo(coords[i]![1], 4);
      // Tighter: within the 1e5 quantization (~1.1 m ≈ 1e-5 deg).
      expect(Math.abs(decoded[i]![0] - coords[i]![0])).toBeLessThanOrEqual(1e-5);
      expect(Math.abs(decoded[i]![1] - coords[i]![1])).toBeLessThanOrEqual(1e-5);
    }
  });

  it("handles empty and single-point", () => {
    expect(decodePolyline(encodePolyline([]))).toEqual([]);
    const one = decodePolyline(encodePolyline([[13.405, 52.52]]));
    expect(one).toHaveLength(1);
    expect(one[0]![0]).toBeCloseTo(13.405, 5);
  });

  it("is much smaller than the JSON encoding for a long route", () => {
    const coords: [number, number][] = [];
    let lon = 13.4;
    let lat = 52.5;
    for (let i = 0; i < 4000; i++) {
      lon += 0.0002;
      lat += 0.00005;
      coords.push([Number(lon.toFixed(5)), Number(lat.toFixed(5))]);
    }
    const encoded = encodePolyline(coords);
    const json = JSON.stringify(coords);
    expect(encoded.length).toBeLessThan(json.length / 3); // >3x smaller
    expect(decodePolyline(encoded)).toHaveLength(4000);
  });

  it("tags encoded values so they are distinguishable from legacy JSON", () => {
    expect(isEncodedPolyline(encodePolyline([[13.4, 52.5], [13.5, 52.6]]))).toBe(true);
    expect(isEncodedPolyline("[[13.4,52.5]]")).toBe(false); // legacy JSON
  });
});

describe("elevation codec", () => {
  it("round-trips elevations within decimetre precision", () => {
    const eles = [34, 34.2, 80.5, 519, 518.9, 200, 0, -5.3];
    const decoded = decodeElevations(encodeElevations(eles));
    expect(decoded).toHaveLength(eles.length);
    for (let i = 0; i < eles.length; i++) {
      expect(Math.abs(decoded[i]! - eles[i]!)).toBeLessThanOrEqual(0.05);
    }
  });

  it("handles empty and is much smaller than JSON for a long climb", () => {
    expect(decodeElevations(encodeElevations([]))).toEqual([]);
    const eles = Array.from({ length: 4000 }, (_, i) => 100 + i * 0.1);
    const enc = encodeElevations(eles);
    expect(isEncodedElevations(enc)).toBe(true);
    expect(enc.length).toBeLessThan(JSON.stringify(eles).length / 2);
    expect(decodeElevations(enc)).toHaveLength(4000);
  });
});

describe("run-length codec", () => {
  it("round-trips and collapses uniform runs", () => {
    const values = [
      ...Array(2000).fill("asphalt"),
      ...Array(500).fill("gravel"),
      ...Array(1500).fill("asphalt"),
    ];
    const encoded = encodeRuns(values);
    expect(decodeRuns(encoded)).toEqual(values);
    // Three runs → tiny compared to the 4000-entry JSON array.
    expect(encoded.length).toBeLessThan(JSON.stringify(values).length / 10);
  });

  it("handles all-distinct and empty", () => {
    const distinct = ["a", "b", "c", "d"];
    expect(decodeRuns(encodeRuns(distinct))).toEqual(distinct);
    expect(decodeRuns(encodeRuns([]))).toEqual([]);
  });

  it("tags encoded runs vs legacy JSON", () => {
    expect(isEncodedRuns(encodeRuns(["asphalt"]))).toBe(true);
    expect(isEncodedRuns('["asphalt","gravel"]')).toBe(false);
  });
});
