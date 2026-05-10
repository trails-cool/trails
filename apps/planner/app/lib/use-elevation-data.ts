import { useEffect, useState } from "react";
import * as Y from "yjs";
import type { ColorMode } from "~/components/ColoredRoute";
import type { ElevationPoint } from "~/lib/elevation-chart-draw";

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function extractElevation(geojsonStr: string): ElevationPoint[] {
  try {
    const geojson = JSON.parse(geojsonStr);
    const coords: number[][] = geojson.features?.[0]?.geometry?.coordinates ?? [];
    if (coords.length === 0) return [];

    const points: ElevationPoint[] = [];
    let totalDist = 0;

    for (let i = 0; i < coords.length; i++) {
      if (i > 0) {
        const prev = coords[i - 1]!;
        const curr = coords[i]!;
        totalDist += haversine(prev[1]!, prev[0]!, curr[1]!, curr[0]!);
      }
      if (coords[i]![2] !== undefined) {
        points.push({
          distance: totalDist,
          elevation: coords[i]![2]!,
          lat: coords[i]![1]!,
          lon: coords[i]![0]!,
        });
      }
    }
    return points;
  } catch {
    return [];
  }
}

function parseJsonArray(json: string | undefined): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

export interface ElevationData {
  points: ElevationPoint[];
  colorMode: ColorMode;
  surfaces: string[];
  highways: string[];
  maxspeeds: string[];
  smoothnesses: string[];
  tracktypes: string[];
  cycleways: string[];
  bikeroutes: string[];
}

export function useElevationData(routeData: Y.Map<unknown>): ElevationData {
  const [data, setData] = useState<ElevationData>({
    points: [],
    colorMode: "plain",
    surfaces: [],
    highways: [],
    maxspeeds: [],
    smoothnesses: [],
    tracktypes: [],
    cycleways: [],
    bikeroutes: [],
  });

  useEffect(() => {
    const update = () => {
      const geojson = routeData.get("geojson") as string | undefined;
      setData({
        points: geojson ? extractElevation(geojson) : [],
        colorMode: (routeData.get("colorMode") as ColorMode | undefined) ?? "plain",
        surfaces: parseJsonArray(routeData.get("surfaces") as string | undefined),
        highways: parseJsonArray(routeData.get("highways") as string | undefined),
        maxspeeds: parseJsonArray(routeData.get("maxspeeds") as string | undefined),
        smoothnesses: parseJsonArray(routeData.get("smoothnesses") as string | undefined),
        tracktypes: parseJsonArray(routeData.get("tracktypes") as string | undefined),
        cycleways: parseJsonArray(routeData.get("cycleways") as string | undefined),
        bikeroutes: parseJsonArray(routeData.get("bikeroutes") as string | undefined),
      });
    };
    routeData.observe(update);
    update();
    return () => routeData.unobserve(update);
  }, [routeData]);

  return data;
}
