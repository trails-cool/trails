import type { Waypoint } from "@trails-cool/types";
import type { TrackPoint } from "./types";

/**
 * Generate a GPX XML string from waypoints and track points.
 */
export function generateGpx(options: {
  name?: string;
  waypoints?: Waypoint[];
  tracks?: TrackPoint[][];
}): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="trails.cool"',
    '  xmlns="http://www.topografix.com/GPX/1/1">',
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
      lines.push("  </wpt>");
    }
  }

  if (options.tracks) {
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

  lines.push("</gpx>");
  return lines.join("\n");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
