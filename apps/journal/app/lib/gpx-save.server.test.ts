import { describe, it, expect } from "vitest";
import { generateGpx } from "@trails-cool/gpx";
import { processGpx, validateGpx, GpxValidationError } from "./gpx-save.server.ts";

const VALID_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="47.0" lon="8.0"><ele>500</ele></trkpt>
      <trkpt lat="47.1" lon="8.1"><ele>520</ele></trkpt>
      <trkpt lat="47.2" lon="8.2"><ele>510</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const ONE_POINT_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="47.0" lon="8.0"><ele>500</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const EMPTY_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg></trkseg></trk>
</gpx>`;

const OUT_OF_RANGE_LAT_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="91.0" lon="8.0"></trkpt>
      <trkpt lat="47.0" lon="8.0"></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const OUT_OF_RANGE_LON_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="47.0" lon="181.0"></trkpt>
      <trkpt lat="47.1" lon="8.0"></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("validateGpx", () => {
  it("returns parsed GpxData for valid GPX", async () => {
    const result = await validateGpx(VALID_GPX);
    expect(result.tracks.flat().length).toBe(3);
    expect(result.tracks[0]![0]!.lat).toBeCloseTo(47.0);
  });

  it("throws GpxValidationError for GPX with fewer than 2 track points", async () => {
    await expect(validateGpx(ONE_POINT_GPX)).rejects.toThrow(GpxValidationError);
    await expect(validateGpx(ONE_POINT_GPX)).rejects.toThrow("at least 2 track points");
  });

  it("throws GpxValidationError for GPX with zero track points", async () => {
    await expect(validateGpx(EMPTY_GPX)).rejects.toThrow(GpxValidationError);
    await expect(validateGpx(EMPTY_GPX)).rejects.toThrow("at least 2 track points");
  });

  it("throws GpxValidationError for out-of-range latitude", async () => {
    await expect(validateGpx(OUT_OF_RANGE_LAT_GPX)).rejects.toThrow(GpxValidationError);
    await expect(validateGpx(OUT_OF_RANGE_LAT_GPX)).rejects.toThrow("out-of-range coordinates");
  });

  it("throws GpxValidationError for out-of-range longitude", async () => {
    await expect(validateGpx(OUT_OF_RANGE_LON_GPX)).rejects.toThrow(GpxValidationError);
    await expect(validateGpx(OUT_OF_RANGE_LON_GPX)).rejects.toThrow("out-of-range coordinates");
  });

  it("throws GpxValidationError for unparseable XML", async () => {
    await expect(validateGpx("not xml at all")).rejects.toThrow(GpxValidationError);
    await expect(validateGpx("<broken<xml")).rejects.toThrow(GpxValidationError);
  });

  it("GpxValidationError has the correct name", async () => {
    const err = await validateGpx(EMPTY_GPX).catch((e) => e);
    expect(err).toBeInstanceOf(GpxValidationError);
    expect(err.name).toBe("GpxValidationError");
  });
});

const TIMED_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><desc>An alpine loop</desc></metadata>
  <trk>
    <trkseg>
      <trkpt lat="47.0" lon="8.0"><ele>500</ele><time>2026-06-01T08:00:00Z</time></trkpt>
      <trkpt lat="47.1" lon="8.1"><ele>520</ele><time>2026-06-01T09:00:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("processGpx", () => {
  it("extracts coords in [lon, lat] PostGIS axis order", async () => {
    const { coords } = await processGpx(VALID_GPX);
    expect(coords).toEqual([
      [8.0, 47.0],
      [8.1, 47.1],
      [8.2, 47.2],
    ]);
  });

  it("derives distance, elevation, description, and start time", async () => {
    const { stats } = await processGpx(TIMED_GPX);
    expect(stats.distance).toBeGreaterThan(0);
    expect(stats.elevationGain).not.toBeNull();
    expect(stats.elevationLoss).not.toBeNull();
    expect(stats.description).toBe("An alpine loop");
    expect(stats.startTime).toEqual(new Date("2026-06-01T08:00:00Z"));
  });

  it("returns null startTime and empty dayBreaks when absent", async () => {
    const { stats } = await processGpx(VALID_GPX);
    expect(stats.startTime).toBeNull();
    expect(stats.dayBreaks).toEqual([]);
  });

  it("derives dayBreaks from day-break waypoints (round-trip via generateGpx)", async () => {
    const gpx = generateGpx({
      name: "Multi-day",
      waypoints: [
        { lat: 47.0, lon: 8.0, name: "Start" },
        { lat: 47.1, lon: 8.1, name: "Hut", isDayBreak: true },
        { lat: 47.2, lon: 8.2, name: "End" },
      ],
      tracks: [[
        { lat: 47.0, lon: 8.0 },
        { lat: 47.1, lon: 8.1 },
        { lat: 47.2, lon: 8.2 },
      ]],
    });

    const { stats } = await processGpx(gpx);
    expect(stats.dayBreaks).toEqual([1]);
  });

  it("propagates GpxValidationError from validation", async () => {
    await expect(processGpx(ONE_POINT_GPX)).rejects.toThrow(GpxValidationError);
  });

  it("returns the parsed GpxData so callers never re-parse", async () => {
    const { parsed } = await processGpx(VALID_GPX);
    expect(parsed.tracks.flat()).toHaveLength(3);
  });
});
