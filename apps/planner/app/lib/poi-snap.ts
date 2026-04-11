import type { Poi } from "./overpass.ts";

const SNAP_DISTANCE_METERS = 50;

export interface SnapResult {
  lat: number;
  lon: number;
  name?: string;
  snapped: boolean;
  /** OSM node ID if snapped */
  osmId?: number;
  /** Key POI tags if snapped */
  poiTags?: Record<string, string>;
}

/**
 * Snap a coordinate to the nearest visible POI if within threshold.
 * Returns the snapped position and POI name, or the original position.
 */
export function snapToPoi(lat: number, lon: number, pois: Poi[]): SnapResult {
  if (pois.length === 0) return { lat, lon, snapped: false };

  let bestPoi: Poi | null = null;
  let bestDist = Infinity;

  for (const poi of pois) {
    const dist = haversine(lat, lon, poi.lat, poi.lon);
    if (dist < bestDist) {
      bestDist = dist;
      bestPoi = poi;
    }
  }

  if (bestPoi && bestDist <= SNAP_DISTANCE_METERS) {
    // Pick key tags worth persisting with the waypoint
    const keepTags = ["phone", "contact:phone", "website", "opening_hours",
      "addr:street", "addr:housenumber", "addr:postcode", "addr:city",
      "description", "amenity", "tourism", "shop"];
    const poiTags: Record<string, string> = {};
    for (const key of keepTags) {
      if (bestPoi.tags[key]) poiTags[key] = bestPoi.tags[key];
    }

    return {
      lat: bestPoi.lat,
      lon: bestPoi.lon,
      name: bestPoi.name,
      snapped: true,
      osmId: bestPoi.id,
      poiTags: Object.keys(poiTags).length > 0 ? poiTags : undefined,
    };
  }

  return { lat, lon, snapped: false };
}

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
