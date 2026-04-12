import type { Waypoint } from "@trails-cool/types";
import type { GpxData, TrackPoint, ElevationProfile, NoGoArea } from "./types.ts";

/**
 * Parse a GPX XML string into structured data.
 */
let _LinkedDOMParser: typeof DOMParser | null = null;

async function getDOMParser(): Promise<typeof DOMParser> {
  if (typeof DOMParser !== "undefined") return DOMParser;
  if (!_LinkedDOMParser) {
    const linkedom = await import("linkedom");
    _LinkedDOMParser = linkedom.DOMParser as unknown as typeof DOMParser;
  }
  return _LinkedDOMParser;
}

export function parseGpx(xml: string): GpxData {
  // Synchronous path for browser
  if (typeof DOMParser !== "undefined") {
    return parseGpxWithParser(new DOMParser(), xml);
  }
  // Fallback: try linkedom synchronously (works in Node with top-level await or CJS)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DOMParser: LP } = require("linkedom");
    return parseGpxWithParser(new LP() as unknown as DOMParser, xml);
  } catch {
    throw new Error("DOMParser not available — install linkedom");
  }
}

export async function parseGpxAsync(xml: string): Promise<GpxData> {
  const Parser = await getDOMParser();
  return parseGpxWithParser(new Parser(), xml);
}

function parseGpxWithParser(parser: DOMParser, xml: string): GpxData {
  const doc = parser.parseFromString(xml, "application/xml") as unknown as Document;

  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error(`Invalid GPX XML: ${parserError.textContent}`);
  }

  const name = doc.querySelector("metadata > name")?.textContent ?? undefined;
  const description = doc.querySelector("metadata > desc")?.textContent ?? undefined;
  const waypoints = parseWaypoints(doc);
  const tracks = parseTracks(doc);
  const noGoAreas = parseNoGoAreas(doc);
  const { totalDistance, ...elevation } = computeElevation(tracks);

  return { name, description, waypoints, tracks, noGoAreas, distance: totalDistance, elevation };
}

function parseWaypoints(doc: Document): Waypoint[] {
  const wpts = doc.querySelectorAll("wpt");
  return Array.from(wpts).map((wpt) => {
    const lat = parseFloat(wpt.getAttribute("lat") ?? "0");
    const lon = parseFloat(wpt.getAttribute("lon") ?? "0");
    const name = wpt.querySelector("name")?.textContent ?? undefined;
    const type = wpt.querySelector("type")?.textContent ?? undefined;
    const isDayBreak = type === "overnight" ? true : undefined;
    return { lat, lon, name, isDayBreak };
  });
}

function parseTracks(doc: Document): TrackPoint[][] {
  const tracks: TrackPoint[][] = [];
  const trksegs = doc.querySelectorAll("trk > trkseg");

  for (const seg of trksegs) {
    const points: TrackPoint[] = [];
    for (const pt of seg.querySelectorAll("trkpt")) {
      const lat = parseFloat(pt.getAttribute("lat") ?? "0");
      const lon = parseFloat(pt.getAttribute("lon") ?? "0");
      const eleText = pt.querySelector("ele")?.textContent;
      const time = pt.querySelector("time")?.textContent ?? undefined;
      points.push({
        lat,
        lon,
        ele: eleText ? parseFloat(eleText) : undefined,
        time,
      });
    }
    tracks.push(points);
  }

  return tracks;
}

function parseNoGoAreas(doc: Document): NoGoArea[] {
  const areas: NoGoArea[] = [];
  // Match both unprefixed and prefixed (trails:nogo) elements
  const nogos = doc.querySelectorAll("nogo, trails\\:nogo");
  for (const nogo of Array.from(nogos)) {
    const points: Array<{ lat: number; lon: number }> = [];
    const pts = nogo.querySelectorAll("point, trails\\:point");
    for (const pt of Array.from(pts)) {
      const lat = parseFloat(pt.getAttribute("lat") ?? "0");
      const lon = parseFloat(pt.getAttribute("lon") ?? "0");
      points.push({ lat, lon });
    }
    if (points.length >= 3) areas.push({ points });
  }
  return areas;
}

function computeElevation(tracks: TrackPoint[][]): GpxData["elevation"] & { totalDistance: number } {
  let gain = 0;
  let loss = 0;
  const profile: ElevationProfile[] = [];
  let totalDistance = 0;

  for (const track of tracks) {
    for (let i = 0; i < track.length; i++) {
      const pt = track[i]!;

      if (i > 0) {
        const prev = track[i - 1]!;
        totalDistance += haversineDistance(prev.lat, prev.lon, pt.lat, pt.lon);

        if (pt.ele !== undefined && prev.ele !== undefined) {
          const diff = pt.ele - prev.ele;
          if (diff > 0) gain += diff;
          else loss += Math.abs(diff);
        }
      }

      if (pt.ele !== undefined) {
        profile.push({ distance: totalDistance, elevation: pt.ele });
      }
    }
  }

  return { totalDistance: Math.round(totalDistance), gain: Math.round(gain), loss: Math.round(loss), profile };
}

/** Haversine distance between two points in meters */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
