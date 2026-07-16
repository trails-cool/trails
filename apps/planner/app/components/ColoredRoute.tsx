import { useMemo } from "react";
import { Polyline } from "react-leaflet";
import type L from "leaflet";
import {
  SURFACE_COLORS, DEFAULT_SURFACE_COLOR,
  HIGHWAY_COLORS, DEFAULT_HIGHWAY_COLOR,
  SMOOTHNESS_COLORS, DEFAULT_SMOOTHNESS_COLOR,
  TRACKTYPE_COLORS, DEFAULT_TRACKTYPE_COLOR,
  CYCLEWAY_COLORS, DEFAULT_CYCLEWAY_COLOR,
  BIKEROUTE_COLORS, DEFAULT_BIKEROUTE_COLOR,
  elevationColor, routeGradeColor, maxspeedColor,
} from "@trails-cool/map-core";

import type { ColorMode } from "~/lib/route-data";
import { buildColorRuns } from "~/lib/color-runs";

// ColorMode lives in the routeData schema module; re-exported here for
// existing importers.
export type { ColorMode };

interface ColoredRouteProps {
  coordinates: [number, number, number][]; // [lon, lat, ele]
  colorMode: ColorMode;
  surfaces?: string[];
  highways?: string[];
  maxspeeds?: string[];
  smoothnesses?: string[];
  tracktypes?: string[];
  cycleways?: string[];
  bikeroutes?: string[];
}

export function ColoredRoute({ coordinates, colorMode, surfaces, highways, maxspeeds, smoothnesses, tracktypes, cycleways, bikeroutes }: ColoredRouteProps) {
  const segments = useMemo(() => {
    const n = coordinates.length;
    if (colorMode === "plain" || n < 2) return null;

    // Build a per-segment color function (segment i spans coord i → i+1).
    // Return null when the required data channel isn't available yet.
    let colorAt: (i: number) => string;

    if (colorMode === "elevation") {
      const eles = coordinates.map((c) => c[2]);
      const minEle = Math.min(...eles);
      const range = Math.max(...eles) - minEle || 1;
      // Quantize the gradient into buckets so equal-color runs can merge —
      // otherwise every segment is a distinct color (one polyline each).
      const BUCKETS = 24;
      colorAt = (i) => {
        const t = (eles[i]! - minEle) / range;
        return elevationColor(Math.round(t * BUCKETS) / BUCKETS);
      };
    } else if (colorMode === "grade") {
      colorAt = (i) => {
        const c0 = coordinates[i]!;
        const c1 = coordinates[i + 1]!;
        const dLat = (c1[1] - c0[1]) * 111320;
        const dLon = (c1[0] - c0[0]) * 111320 * Math.cos((c0[1] * Math.PI) / 180);
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        const grade = dist > 0 ? ((c1[2] - c0[2]) / dist) * 100 : 0;
        return routeGradeColor(grade);
      };
    } else if (colorMode === "highway") {
      if (!highways || highways.length < n) return null;
      colorAt = (i) => HIGHWAY_COLORS[highways[i] ?? "unknown"] ?? DEFAULT_HIGHWAY_COLOR;
    } else if (colorMode === "maxspeed") {
      if (!maxspeeds || maxspeeds.length < n) return null;
      colorAt = (i) => maxspeedColor(maxspeeds[i] ?? "unknown");
    } else if (colorMode === "smoothness") {
      if (!smoothnesses || smoothnesses.length < n) return null;
      colorAt = (i) => SMOOTHNESS_COLORS[smoothnesses[i] ?? "unknown"] ?? DEFAULT_SMOOTHNESS_COLOR;
    } else if (colorMode === "tracktype") {
      if (!tracktypes || tracktypes.length < n) return null;
      colorAt = (i) => TRACKTYPE_COLORS[tracktypes[i] ?? "unknown"] ?? DEFAULT_TRACKTYPE_COLOR;
    } else if (colorMode === "cycleway") {
      if (!cycleways || cycleways.length < n) return null;
      colorAt = (i) => CYCLEWAY_COLORS[cycleways[i] ?? "unknown"] ?? DEFAULT_CYCLEWAY_COLOR;
    } else if (colorMode === "bikeroute") {
      if (!bikeroutes || bikeroutes.length < n) return null;
      colorAt = (i) => BIKEROUTE_COLORS[bikeroutes[i] ?? "none"] ?? DEFAULT_BIKEROUTE_COLOR;
    } else {
      // surface
      if (!surfaces || surfaces.length < n) return null;
      colorAt = (i) => SURFACE_COLORS[surfaces[i] ?? "unknown"] ?? DEFAULT_SURFACE_COLOR;
    }

    return buildColorRuns(coordinates, colorAt);
  }, [coordinates, colorMode, surfaces, highways, maxspeeds, smoothnesses, tracktypes, cycleways, bikeroutes]);

  const plainPositions = useMemo(
    () => coordinates.map((c) => [c[1], c[0]] as L.LatLngExpression),
    [coordinates],
  );

  if (!segments) {
    return (
      <Polyline
        positions={plainPositions}
        pathOptions={{ color: "#4a6b40", weight: 4, opacity: 0.85 }}
        interactive={false}
      />
    );
  }

  return (
    <>
      {segments.map((seg, i) => (
        <Polyline
          key={i}
          positions={seg.positions}
          pathOptions={{ color: seg.color, weight: 4, opacity: 0.9 }}
          interactive={false}
        />
      ))}
    </>
  );
}

export function findSegmentForPoint(
  pointIndex: number,
  segmentBoundaries: number[],
): number {
  for (let i = segmentBoundaries.length - 1; i >= 0; i--) {
    if (pointIndex >= segmentBoundaries[i]!) return i;
  }
  return 0;
}

