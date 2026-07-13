/**
 * @vitest-environment node
 *
 * These tests run WITHOUT jsdom to verify GPX parsing and generation
 * work in environments without a native DOMParser (Node.js, React Native).
 * The linkedom fallback must handle all XML parsing.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { parseGpxAsync } from "./parse.ts";
import { generateGpx } from "./generate.ts";
import type { GpxData } from "./types.ts";

const sampleGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Test Route</name><desc>A test description</desc></metadata>
  <wpt lat="52.52" lon="13.405"><name>Berlin</name></wpt>
  <wpt lat="51.84" lon="12.243"><name>Dessau</name><type>overnight</type></wpt>
  <wpt lat="48.137" lon="11.576"><name>Munich</name></wpt>
  <trk>
    <trkseg>
      <trkpt lat="52.52" lon="13.405"><ele>34</ele></trkpt>
      <trkpt lat="51.84" lon="12.243"><ele>80</ele></trkpt>
      <trkpt lat="48.137" lon="11.576"><ele>519</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("parseGpxAsync (node environment, no DOMParser)", () => {
  it("parses route name and description", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.name).toBe("Test Route");
    expect(result.description).toBe("A test description");
  });

  it("parses waypoints", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.waypoints).toHaveLength(3);
    expect(result.waypoints[0]).toEqual({ lat: 52.52, lon: 13.405, name: "Berlin" });
  });

  it("parses isDayBreak from overnight type", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.waypoints[1]!.isDayBreak).toBe(true);
    expect(result.waypoints[0]!.isDayBreak).toBeUndefined();
  });

  it("parses tracks with elevation", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toHaveLength(3);
    expect(result.tracks[0]![0]!.ele).toBe(34);
  });

  it("computes elevation gain and distance", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.elevation.gain).toBe(485);
    expect(result.elevation.loss).toBe(0);
    expect(result.distance).toBeGreaterThan(400_000);
  });
});

// Fixture corpus (spec: gpx-parser-robustness "Fixture corpus"). Every
// *.gpx under fixtures/ is loaded from disk and checked against an entry
// here. Adding a file without an expectation FAILS loudly — the corpus is
// the regression mechanism, so a new bug report becomes a new fixture.
const FIXTURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../fixtures");

const flat = (r: GpxData) => r.tracks.flat();
const allFinite = (r: GpxData) =>
  Number.isFinite(r.distance) &&
  Number.isFinite(r.elevation.gain) &&
  Number.isFinite(r.elevation.loss) &&
  flat(r).every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

const EXPECTATIONS: Record<string, (r: GpxData) => void> = {
  "route-only.gpx": (r) => {
    expect(r.tracks).toHaveLength(1);
    expect(r.tracks[0]).toHaveLength(4);
    expect(r.name).toBe("Harz Ridge Course");
  },
  "missing-coords.gpx": (r) => {
    // Two points (missing lon, empty lat/lon) are skipped; three survive.
    expect(flat(r)).toHaveLength(3);
    expect(flat(r).some((p) => p.lat === 0 && p.lon === 0)).toBe(false);
  },
  "garbage-ele.gpx": (r) => {
    expect(r.tracks[0]).toHaveLength(4);
    expect(r.tracks[0]![1]!.ele).toBeUndefined();
    expect(r.tracks[0]![2]!.ele).toBeUndefined();
  },
  "timestamps-partial.gpx": (r) => {
    expect(r.tracks[0]).toHaveLength(4);
    // The one invalid timestamp is repaired to a parseable value.
    expect(flat(r).every((p) => Number.isFinite(Date.parse(p.time!)))).toBe(true);
  },
  "timestamps-mostly-invalid.gpx": (r) => {
    expect(r.tracks[0]).toHaveLength(4);
    // >50% invalid → the whole segment's timestamps are dropped.
    expect(flat(r).every((p) => p.time === undefined)).toBe(true);
  },
  "multi-track.gpx": (r) => {
    expect(r.tracks).toHaveLength(2);
    expect(r.name).toBe("Two-part outing");
  },
  "unicode-name.gpx": (r) => {
    expect(r.name).toContain("Zürich");
    expect(r.name).toContain("🏔");
  },
  "namespaced-extensions.gpx": (r) => {
    // Extensions are ignored; the points parse intact.
    expect(r.tracks[0]).toHaveLength(2);
    expect(r.name).toBe("Extensions ignored");
  },
  "komoot-export.gpx": (r) => {
    expect(r.name).toBe("Rheinsteig Sampler");
    expect(r.tracks[0]).toHaveLength(4);
    expect(r.distance).toBeGreaterThan(0);
  },
  "wahoo-export.gpx": (r) => {
    expect(r.tracks[0]).toHaveLength(3);
    // All timestamps valid → preserved unchanged.
    expect(flat(r).every((p) => p.time !== undefined)).toBe(true);
  },
};

describe("fixture corpus (node environment)", () => {
  const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".gpx")).sort();

  it("has at least the documented fixtures and every file is described", () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
    const undescribed = files.filter((f) => !(f in EXPECTATIONS));
    expect(undescribed, `add an EXPECTATIONS entry for: ${undescribed.join(", ")}`).toEqual([]);
  });

  for (const file of Object.keys(EXPECTATIONS)) {
    it(`parses ${file} with finite stats and expected shape`, async () => {
      const result = await parseGpxAsync(readFileSync(resolve(FIXTURES_DIR, file), "utf8"));
      expect(allFinite(result)).toBe(true);
      EXPECTATIONS[file]!(result);
    });
  }
});

describe("generateGpx + parseGpxAsync round-trip (node environment)", () => {
  it("round-trips waypoints, tracks, and metadata", async () => {
    const gpx = generateGpx({
      name: "Round Trip",
      description: "Testing",
      waypoints: [
        { lat: 52.52, lon: 13.405, name: "Start" },
        { lat: 51.0, lon: 12.0, name: "Camp", isDayBreak: true },
        { lat: 48.137, lon: 11.576, name: "End" },
      ],
      tracks: [[
        { lat: 52.52, lon: 13.405, ele: 34 },
        { lat: 51.0, lon: 12.0, ele: 200 },
        { lat: 48.137, lon: 11.576, ele: 519 },
      ]],
    });

    const parsed = await parseGpxAsync(gpx);
    expect(parsed.name).toBe("Round Trip");
    expect(parsed.description).toBe("Testing");
    expect(parsed.waypoints).toHaveLength(3);
    expect(parsed.waypoints[1]!.isDayBreak).toBe(true);
    expect(parsed.tracks[0]).toHaveLength(3);
  });
});
