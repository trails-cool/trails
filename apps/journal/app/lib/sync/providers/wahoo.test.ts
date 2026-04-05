import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { wahooProvider } from "./wahoo";

const fixturePath = resolve(__dirname, "__fixtures__/wahoo-ride.fit");
const fitBuffer = readFileSync(fixturePath);

describe("wahooProvider.convertToGpx", () => {
  it("converts a FIT file to valid GPX with correct coordinates", async () => {
    const gpx = await wahooProvider.convertToGpx(Buffer.from(fitBuffer));

    expect(gpx).not.toBeNull();
    expect(gpx).toContain('<?xml version="1.0"');
    expect(gpx).toContain("<gpx");
    expect(gpx).toContain("<trkpt");
  });

  it("produces coordinates in valid lat/lon range (not semicircles)", async () => {
    const gpx = await wahooProvider.convertToGpx(Buffer.from(fitBuffer));
    expect(gpx).not.toBeNull();

    const latMatches = gpx!.matchAll(/lat="([^"]+)"/g);
    const lonMatches = gpx!.matchAll(/lon="([^"]+)"/g);

    const lats = [...latMatches].map((m) => parseFloat(m[1]!));
    const lons = [...lonMatches].map((m) => parseFloat(m[1]!));

    expect(lats.length).toBeGreaterThan(10);
    expect(lons.length).toBeGreaterThan(10);

    for (const lat of lats) {
      expect(lat).toBeGreaterThan(-90);
      expect(lat).toBeLessThan(90);
      // Should be real-world coords, not near-zero from double-conversion
      expect(Math.abs(lat)).toBeGreaterThan(1);
    }
    for (const lon of lons) {
      expect(lon).toBeGreaterThan(-180);
      expect(lon).toBeLessThan(180);
    }
  });

  it("includes ISO 8601 timestamps (not Date objects)", async () => {
    const gpx = await wahooProvider.convertToGpx(Buffer.from(fitBuffer));
    expect(gpx).not.toBeNull();

    const timeMatches = gpx!.matchAll(/<time>([^<]+)<\/time>/g);
    const times = [...timeMatches].map((m) => m[1]!);

    expect(times.length).toBeGreaterThan(10);
    for (const t of times) {
      expect(t).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(t).toString()).not.toBe("Invalid Date");
    }
  });

  it("includes elevation data", async () => {
    const gpx = await wahooProvider.convertToGpx(Buffer.from(fitBuffer));
    expect(gpx).not.toBeNull();
    expect(gpx).toContain("<ele>");
  });
});
