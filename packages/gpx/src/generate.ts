import type { Waypoint } from "@trails-cool/types";
import type { TrackPoint } from "./types.ts";

/**
 * Generate a GPX XML string from waypoints and track points.
 */
export interface NoGoArea {
  points: Array<{ lat: number; lon: number }>;
}

export function generateGpx(options: {
  name?: string;
  waypoints?: Waypoint[];
  tracks?: TrackPoint[][];
  noGoAreas?: NoGoArea[];
  /** When true, splits tracks at overnight waypoints into separate <trk> elements per day */
  splitByDay?: boolean;
}): string {
  const hasExtensions = options.noGoAreas && options.noGoAreas.length > 0;
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="trails.cool"',
    '  xmlns="http://www.topografix.com/GPX/1/1"' +
      (hasExtensions ? '\n  xmlns:trails="https://trails.cool/gpx/1"' : "") +
      ">",
  ];

  if (options.name) {
    lines.push("  <metadata>", `    <name>${escapeXml(options.name)}</name>`, "  </metadata>");
  }

  if (options.waypoints) {
    for (const wpt of options.waypoints) {
      lines.push(`  <wpt lat="${wpt.lat}" lon="${wpt.lon}">`);
      if (wpt.name) {
        lines.push(`    <name>${escapeXml(wpt.name)}</name>`);
      }
      if (wpt.isDayBreak) {
        lines.push("    <type>overnight</type>");
      }
      lines.push("  </wpt>");
    }
  }

  if (options.tracks) {
    const allPoints = options.tracks.flat();

    if (options.splitByDay && options.waypoints) {
      // Split track into per-day segments at overnight waypoints
      const dayTracks = splitTrackByDays(allPoints, options.waypoints);
      for (const dayTrack of dayTracks) {
        lines.push("  <trk>");
        if (dayTrack.name) {
          lines.push(`    <name>${escapeXml(dayTrack.name)}</name>`);
        }
        lines.push("    <trkseg>");
        for (const pt of dayTrack.points) {
          lines.push(`      <trkpt lat="${pt.lat}" lon="${pt.lon}">`);
          if (pt.ele !== undefined) {
            lines.push(`        <ele>${pt.ele}</ele>`);
          }
          if (pt.time) {
            lines.push(`        <time>${escapeXml(pt.time)}</time>`);
          }
          lines.push("      </trkpt>");
        }
        lines.push("    </trkseg>", "  </trk>");
      }
    } else {
      for (const track of options.tracks) {
        lines.push("  <trk>", "    <trkseg>");
        for (const pt of track) {
          lines.push(`      <trkpt lat="${pt.lat}" lon="${pt.lon}">`);
          if (pt.ele !== undefined) {
            lines.push(`        <ele>${pt.ele}</ele>`);
          }
          if (pt.time) {
            lines.push(`        <time>${escapeXml(pt.time)}</time>`);
          }
          lines.push("      </trkpt>");
        }
        lines.push("    </trkseg>", "  </trk>");
      }
    }
  }

  if (options.noGoAreas && options.noGoAreas.length > 0) {
    lines.push("  <extensions>", "    <trails:planning>");
    for (const area of options.noGoAreas) {
      lines.push("      <trails:nogo>");
      for (const pt of area.points) {
        lines.push(`        <trails:point lat="${pt.lat}" lon="${pt.lon}"/>`);
      }
      lines.push("      </trails:nogo>");
    }
    lines.push("    </trails:planning>", "  </extensions>");
  }

  lines.push("</gpx>");
  return lines.join("\n");
}

function splitTrackByDays(
  points: TrackPoint[],
  waypoints: Waypoint[],
): Array<{ name: string; points: TrackPoint[] }> {
  if (points.length === 0 || waypoints.length === 0) return [];

  // Find closest track point index for each waypoint
  const wpTrackIndices = waypoints.map((wp) => {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dx = points[i]!.lat - wp.lat;
      const dy = points[i]!.lon - wp.lon;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  });

  // Build day boundaries from overnight waypoints
  const breakWpIndices = waypoints
    .map((wp, i) => (wp.isDayBreak ? i : -1))
    .filter((i) => i >= 0);

  if (breakWpIndices.length === 0) {
    return [{ name: "Day 1", points }];
  }

  const boundaries = [0, ...breakWpIndices.map((i) => wpTrackIndices[i]!), points.length];
  const dayTracks: Array<{ name: string; points: TrackPoint[] }> = [];

  for (let d = 0; d < boundaries.length - 1; d++) {
    const start = boundaries[d]!;
    const end = boundaries[d + 1]!;
    const startWp = d === 0 ? waypoints[0] : waypoints[breakWpIndices[d - 1]!];
    const endWp = d < breakWpIndices.length ? waypoints[breakWpIndices[d]!] : waypoints[waypoints.length - 1];
    const startName = startWp?.name ?? "";
    const endName = endWp?.name ?? "";
    const name = startName && endName ? `Day ${d + 1}: ${startName} - ${endName}` : `Day ${d + 1}`;
    dayTracks.push({ name, points: points.slice(start, end) });
  }

  return dayTracks;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
