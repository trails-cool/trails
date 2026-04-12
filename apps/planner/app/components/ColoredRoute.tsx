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

export type ColorMode = "plain" | "elevation" | "surface" | "grade" | "highway" | "maxspeed" | "smoothness" | "tracktype" | "cycleway" | "bikeroute";

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
    if (colorMode === "plain" || coordinates.length < 2) {
      return null;
    }

    if (colorMode === "elevation") {
      const elevations = coordinates.map((c) => c[2]);
      const minEle = Math.min(...elevations);
      const maxEle = Math.max(...elevations);
      const range = maxEle - minEle || 1;

      const result: { positions: L.LatLngExpression[]; color: string }[] = [];
      for (let i = 0; i < coordinates.length - 1; i++) {
        const t = (elevations[i]! - minEle) / range;
        result.push({
          positions: [
            [coordinates[i]![1], coordinates[i]![0]],
            [coordinates[i + 1]![1], coordinates[i + 1]![0]],
          ],
          color: elevationColor(t),
        });
      }
      return result;
    }

    if (colorMode === "grade") {
      const result: { positions: L.LatLngExpression[]; color: string }[] = [];
      for (let i = 0; i < coordinates.length - 1; i++) {
        const c0 = coordinates[i]!;
        const c1 = coordinates[i + 1]!;
        // Approximate distance in meters using lat/lon diff
        const dLat = (c1[1] - c0[1]) * 111320;
        const dLon = (c1[0] - c0[0]) * 111320 * Math.cos((c0[1] * Math.PI) / 180);
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        const grade = dist > 0 ? ((c1[2] - c0[2]) / dist) * 100 : 0;
        result.push({
          positions: [
            [c0[1], c0[0]],
            [c1[1], c1[0]],
          ],
          color: routeGradeColor(grade),
        });
      }
      return result;
    }

    // highway mode
    if (colorMode === "highway") {
      if (!highways || highways.length < coordinates.length) return null;

      const result: { positions: L.LatLngExpression[]; color: string }[] = [];
      for (let i = 0; i < coordinates.length - 1; i++) {
        const highway = highways[i] ?? "unknown";
        result.push({
          positions: [
            [coordinates[i]![1], coordinates[i]![0]],
            [coordinates[i + 1]![1], coordinates[i + 1]![0]],
          ],
          color: HIGHWAY_COLORS[highway] ?? DEFAULT_HIGHWAY_COLOR,
        });
      }
      return result;
    }

    // maxspeed mode
    if (colorMode === "maxspeed") {
      if (!maxspeeds || maxspeeds.length < coordinates.length) return null;

      const result: { positions: L.LatLngExpression[]; color: string }[] = [];
      for (let i = 0; i < coordinates.length - 1; i++) {
        const speed = maxspeeds[i] ?? "unknown";
        result.push({
          positions: [
            [coordinates[i]![1], coordinates[i]![0]],
            [coordinates[i + 1]![1], coordinates[i + 1]![0]],
          ],
          color: maxspeedColor(speed),
        });
      }
      return result;
    }

    // smoothness mode
    if (colorMode === "smoothness") {
      if (!smoothnesses || smoothnesses.length < coordinates.length) return null;

      const result: { positions: L.LatLngExpression[]; color: string }[] = [];
      for (let i = 0; i < coordinates.length - 1; i++) {
        const smoothness = smoothnesses[i] ?? "unknown";
        result.push({
          positions: [
            [coordinates[i]![1], coordinates[i]![0]],
            [coordinates[i + 1]![1], coordinates[i + 1]![0]],
          ],
          color: SMOOTHNESS_COLORS[smoothness] ?? DEFAULT_SMOOTHNESS_COLOR,
        });
      }
      return result;
    }

    // tracktype mode
    if (colorMode === "tracktype") {
      if (!tracktypes || tracktypes.length < coordinates.length) return null;

      const result: { positions: L.LatLngExpression[]; color: string }[] = [];
      for (let i = 0; i < coordinates.length - 1; i++) {
        const tracktype = tracktypes[i] ?? "unknown";
        result.push({
          positions: [
            [coordinates[i]![1], coordinates[i]![0]],
            [coordinates[i + 1]![1], coordinates[i + 1]![0]],
          ],
          color: TRACKTYPE_COLORS[tracktype] ?? DEFAULT_TRACKTYPE_COLOR,
        });
      }
      return result;
    }

    // cycleway mode
    if (colorMode === "cycleway") {
      if (!cycleways || cycleways.length < coordinates.length) return null;

      const result: { positions: L.LatLngExpression[]; color: string }[] = [];
      for (let i = 0; i < coordinates.length - 1; i++) {
        const cycleway = cycleways[i] ?? "unknown";
        result.push({
          positions: [
            [coordinates[i]![1], coordinates[i]![0]],
            [coordinates[i + 1]![1], coordinates[i + 1]![0]],
          ],
          color: CYCLEWAY_COLORS[cycleway] ?? DEFAULT_CYCLEWAY_COLOR,
        });
      }
      return result;
    }

    // bikeroute mode
    if (colorMode === "bikeroute") {
      if (!bikeroutes || bikeroutes.length < coordinates.length) return null;

      const result: { positions: L.LatLngExpression[]; color: string }[] = [];
      for (let i = 0; i < coordinates.length - 1; i++) {
        const bikeroute = bikeroutes[i] ?? "none";
        result.push({
          positions: [
            [coordinates[i]![1], coordinates[i]![0]],
            [coordinates[i + 1]![1], coordinates[i + 1]![0]],
          ],
          color: BIKEROUTE_COLORS[bikeroute] ?? DEFAULT_BIKEROUTE_COLOR,
        });
      }
      return result;
    }

    // surface mode
    if (!surfaces || surfaces.length < coordinates.length) return null;

    const result: { positions: L.LatLngExpression[]; color: string }[] = [];
    for (let i = 0; i < coordinates.length - 1; i++) {
      const surface = surfaces[i] ?? "unknown";
      result.push({
        positions: [
          [coordinates[i]![1], coordinates[i]![0]],
          [coordinates[i + 1]![1], coordinates[i + 1]![0]],
        ],
        color: SURFACE_COLORS[surface] ?? DEFAULT_SURFACE_COLOR,
      });
    }
    return result;
  }, [coordinates, colorMode, surfaces, highways, maxspeeds, smoothnesses, tracktypes, cycleways, bikeroutes]);

  const plainPositions = useMemo(
    () => coordinates.map((c) => [c[1], c[0]] as L.LatLngExpression),
    [coordinates],
  );

  if (!segments) {
    return (
      <Polyline
        positions={plainPositions}
        pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.8 }}
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

