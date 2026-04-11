import { useMemo } from "react";
import { Polyline } from "react-leaflet";
import type L from "leaflet";

export type ColorMode = "plain" | "elevation" | "surface" | "grade" | "highway" | "maxspeed";

interface ColoredRouteProps {
  coordinates: [number, number, number][]; // [lon, lat, ele]
  colorMode: ColorMode;
  surfaces?: string[];
  highways?: string[];
  maxspeeds?: string[];
}

const SURFACE_COLORS: Record<string, string> = {
  asphalt: "#6b7280",
  concrete: "#9ca3af",
  paved: "#6b7280",
  paving_stones: "#78716c",
  cobblestone: "#a8a29e",
  gravel: "#92400e",
  compacted: "#b45309",
  "fine_gravel": "#d97706",
  ground: "#65a30d",
  dirt: "#84cc16",
  grass: "#22c55e",
  sand: "#fbbf24",
  mud: "#713f12",
  wood: "#a16207",
  unpaved: "#ca8a04",
  path: "#16a34a",
  track: "#ea580c",
};

const DEFAULT_SURFACE_COLOR = "#9ca3af";

const HIGHWAY_COLORS: Record<string, string> = {
  // Major roads — warm tones (caution for cyclists)
  motorway: "#dc2626",
  motorway_link: "#dc2626",
  trunk: "#ea580c",
  trunk_link: "#ea580c",
  primary: "#f97316",
  primary_link: "#f97316",
  // Urban roads — neutral tones
  secondary: "#6366f1",
  secondary_link: "#6366f1",
  tertiary: "#818cf8",
  tertiary_link: "#818cf8",
  residential: "#6b7280",
  unclassified: "#9ca3af",
  living_street: "#a78bfa",
  // Paths & cycling infrastructure — green tones
  cycleway: "#16a34a",
  path: "#22c55e",
  footway: "#4ade80",
  track: "#65a30d",
  bridleway: "#84cc16",
  // Service & other — muted tones
  service: "#d4d4d8",
  pedestrian: "#c084fc",
  steps: "#f472b6",
};

const DEFAULT_HIGHWAY_COLOR = "#9ca3af";

export function routeGradeColor(grade: number): string {
  const absGrade = Math.abs(grade);
  if (absGrade < 3) return "#22c55e";
  if (absGrade < 6) return "#eab308";
  if (absGrade < 10) return "#f97316";
  if (absGrade < 15) return "#ef4444";
  return "#991b1b";
}

export function elevationColor(t: number): string {
  // green (0) → yellow (0.5) → red (1)
  if (t <= 0.5) {
    const r = Math.round(255 * (t * 2));
    return `rgb(${r}, 200, 50)`;
  }
  const g = Math.round(200 * (1 - (t - 0.5) * 2));
  return `rgb(255, ${g}, 50)`;
}

export function maxspeedColor(speed: string): string {
  if (speed === "walk") return "#22c55e";
  if (speed === "none") return "#991b1b";
  const num = parseInt(speed, 10);
  if (isNaN(num)) return "#9ca3af"; // unknown/gray
  if (num <= 20) return "#22c55e";
  if (num <= 30) return "#22c55e";
  if (num <= 50) return "#eab308";
  if (num <= 70) return "#f97316";
  if (num <= 100) return "#ef4444";
  return "#991b1b"; // >100 dark red
}

export function ColoredRoute({ coordinates, colorMode, surfaces, highways, maxspeeds }: ColoredRouteProps) {
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
  }, [coordinates, colorMode, surfaces, highways, maxspeeds]);

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

export { SURFACE_COLORS, DEFAULT_SURFACE_COLOR, HIGHWAY_COLORS, DEFAULT_HIGHWAY_COLOR };
