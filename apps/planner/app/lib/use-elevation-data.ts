import { useEffect, useState } from "react";
import * as Y from "yjs";
import type { ElevationPoint } from "~/lib/elevation-chart-draw";
import {
  getColorMode,
  getGeojson,
  readRoadMetadata,
  type ColorMode,
  type RoadMetadata,
} from "~/lib/route-data";

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

export interface ElevationData extends RoadMetadata {
  points: ElevationPoint[];
  colorMode: ColorMode;
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
      const geojson = getGeojson(routeData);
      setData({
        points: geojson ? extractElevation(geojson) : [],
        colorMode: getColorMode(routeData),
        ...readRoadMetadata(routeData),
      });
    };
    routeData.observe(update);
    update();
    return () => routeData.unobserve(update);
  }, [routeData]);

  return data;
}
