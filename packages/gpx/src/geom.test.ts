import { describe, it, expect } from "vitest";
import { parseGpxAsync } from "./parse.ts";

const sampleGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="52.52" lon="13.405"><ele>34</ele></trkpt>
      <trkpt lat="51.05" lon="13.74"><ele>113</ele></trkpt>
      <trkpt lat="48.137" lon="11.576"><ele>519</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("GPX to geometry coordinates", () => {
  it("extracts [lon, lat] coordinates from track points", async () => {
    const gpxData = await parseGpxAsync(sampleGpx);
    const coords = gpxData.tracks.flat().map((p) => [p.lon, p.lat] as [number, number]);

    expect(coords).toHaveLength(3);
    // GeoJSON order: [lon, lat]
    expect(coords[0]).toEqual([13.405, 52.52]);
    expect(coords[1]).toEqual([13.74, 51.05]);
    expect(coords[2]).toEqual([11.576, 48.137]);
  });

  it("produces valid GeoJSON LineString", async () => {
    const gpxData = await parseGpxAsync(sampleGpx);
    const coords = gpxData.tracks.flat().map((p) => [p.lon, p.lat] as [number, number]);
    const geojson = { type: "LineString", coordinates: coords };

    expect(geojson.type).toBe("LineString");
    expect(geojson.coordinates).toHaveLength(3);
    // Verify serialization doesn't throw
    expect(() => JSON.stringify(geojson)).not.toThrow();
  });

  it("handles empty GPX gracefully", async () => {
    const emptyGpx = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
      <trk><trkseg></trkseg></trk>
    </gpx>`;
    const gpxData = await parseGpxAsync(emptyGpx);
    const coords = gpxData.tracks.flat().map((p) => [p.lon, p.lat] as [number, number]);

    expect(coords).toHaveLength(0);
  });

  it("handles single point (insufficient for LineString)", async () => {
    const singlePointGpx = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
      <trk><trkseg>
        <trkpt lat="52.52" lon="13.405"><ele>34</ele></trkpt>
      </trkseg></trk>
    </gpx>`;
    const gpxData = await parseGpxAsync(singlePointGpx);
    const coords = gpxData.tracks.flat().map((p) => [p.lon, p.lat] as [number, number]);

    expect(coords).toHaveLength(1);
    // Caller should check coords.length >= 2 before creating LineString
  });
});
