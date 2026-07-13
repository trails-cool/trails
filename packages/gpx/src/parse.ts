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
    const note = wpt.querySelector("desc")?.textContent ?? undefined;
    const type = wpt.querySelector("type")?.textContent ?? undefined;
    const isDayBreak = type === "overnight" ? true : undefined;

    const poiEl = wpt.querySelector("poi, trails\\:poi");
    let osmId: number | undefined;
    let poiTags: Waypoint["poiTags"] | undefined;
    if (poiEl) {
      const rawOsmId = poiEl.getAttribute("osmId");
      if (rawOsmId) osmId = parseInt(rawOsmId, 10);
      const tagEls = poiEl.querySelectorAll("tag, trails\\:tag");
      if (tagEls.length > 0) {
        poiTags = {};
        for (const tagEl of Array.from(tagEls)) {
          const k = tagEl.getAttribute("k");
          const v = tagEl.getAttribute("v");
          if (k && v) (poiTags as Record<string, string>)[k] = v;
        }
      }
    }

    return { lat, lon, name, note, isDayBreak, osmId, poiTags };
  });
}

/**
 * Parse one `trkpt`/`rtept` element into a TrackPoint, or null if it is
 * unusable. Parsing stays `parseFloat`-lenient (accepts leading `+`,
 * tolerates trailing junk like `471.0m` that real exporters emit), but a
 * point whose `lat`/`lon` is missing or does not parse to a finite number
 * is skipped rather than defaulted to `0,0` (which would land on Null
 * Island and pass range validation) — spec: gpx-parser-robustness
 * "Invalid point handling". A non-finite `<ele>` becomes `undefined` (the
 * existing "no elevation" representation) so it never poisons gain/loss
 * totals with `NaN`.
 */
function parsePoint(pt: Element): TrackPoint | null {
  const lat = parseFloat(pt.getAttribute("lat") ?? "");
  const lon = parseFloat(pt.getAttribute("lon") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const eleText = pt.querySelector("ele")?.textContent;
  const ele = eleText != null ? parseFloat(eleText) : NaN;
  const time = pt.querySelector("time")?.textContent ?? undefined;
  return { lat, lon, ele: Number.isFinite(ele) ? ele : undefined, time };
}

function parseSegmentPoints(pts: ArrayLike<Element>): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (const pt of Array.from(pts)) {
    const parsed = parsePoint(pt);
    if (parsed) points.push(parsed);
  }
  return points;
}

function parseTracks(doc: Document): TrackPoint[][] {
  const segments: TrackPoint[][] = [];

  // Standard tracks: <trk><trkseg><trkpt>.
  for (const seg of Array.from(doc.querySelectorAll("trk > trkseg"))) {
    segments.push(parseSegmentPoints(seg.querySelectorAll("trkpt")));
  }
  // Routes: <rte><rtept>. Many exporters (Garmin Connect courses,
  // gpx.studio, planner exports) emit only routes; each becomes one
  // segment appended after the track segments, with rtept handled
  // identically to trkpt — spec: gpx-parser-robustness "Route support".
  for (const rte of Array.from(doc.querySelectorAll("rte"))) {
    segments.push(parseSegmentPoints(rte.querySelectorAll("rtept")));
  }

  // Drop empty or single-point segments: they render nothing and break
  // distance-math assumptions (spec: "Invalid point handling").
  return segments.filter((seg) => seg.length >= 2);
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
