import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";
import FitParser from "fit-file-parser";

import { parseGpxAsync } from "@trails-cool/gpx";

import { gpxToFitCourse } from "./gpx-to-fit-course.ts";

const FIXTURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../__fixtures__");

async function loadFixture(name: string): Promise<string> {
  return readFile(resolve(FIXTURES_DIR, name), "utf8");
}

interface ParsedFit {
  records: Array<{ position_lat?: number; position_long?: number; altitude?: number }>;
  course?: Array<{ name?: string; sport?: string }> | { name?: string; sport?: string };
  laps?: Array<unknown>;
}

function decode(bytes: Uint8Array): Promise<ParsedFit> {
  return new Promise((res, rej) => {
    const parser = new FitParser({ force: true, mode: "list", lengthUnit: "m", speedUnit: "m/s" });
    parser.parse(Buffer.from(bytes), (err, data) => {
      if (err) rej(new Error(err));
      else res(data as unknown as ParsedFit);
    });
  });
}

const FIXTURES = ["short-flat.gpx", "alpine.gpx", "multi-day.gpx", "single-point.gpx"] as const;

describe("gpxToFitCourse", () => {
  for (const fixture of FIXTURES) {
    it(`encodes ${fixture} round-trip via fit-file-parser`, async () => {
      const gpx = await loadFixture(fixture);
      const source = await parseGpxAsync(gpx);
      const sourcePoints = source.tracks.flat();

      const bytes = await gpxToFitCourse({ gpx, name: `Test ${fixture}` });
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.byteLength).toBeGreaterThan(20);

      const parsed = await decode(bytes);
      const records = parsed.records ?? [];
      expect(records.length).toBe(sourcePoints.length);

      for (let i = 0; i < sourcePoints.length; i++) {
        const src = sourcePoints[i]!;
        const got = records[i]!;
        expect(got.position_lat).toBeCloseTo(src.lat, 4);
        expect(got.position_long).toBeCloseTo(src.lon, 4);
        if (src.ele !== undefined && got.altitude !== undefined) {
          expect(Math.abs(got.altitude - src.ele)).toBeLessThan(0.5);
        }
      }
    });
  }

  it("throws on a GPX with zero track points", async () => {
    const gpx = await loadFixture("empty.gpx");
    await expect(gpxToFitCourse({ gpx, name: "Empty" })).rejects.toThrow(/zero track points/);
  });

  it("encodes course name and sport", async () => {
    const gpx = await loadFixture("short-flat.gpx");
    const bytes = await gpxToFitCourse({ gpx, name: "Loop Test", sport: "cycling" });
    const parsed = await decode(bytes);
    const course = Array.isArray(parsed.course) ? parsed.course[0] : parsed.course;
    expect(course?.name).toBe("Loop Test");
    expect(course?.sport).toBe("cycling");
  });
});
