import * as Y from "yjs";
import {
  encodePolyline, decodePolyline,
  encodeElevations, decodeElevations,
  encodeRuns, decodeRuns,
  isEncodedPolyline, isEncodedElevations, isEncodedRuns,
} from "@trails-cool/map-core";
import type { EnrichedRoute } from "./route-merge.ts";

// The schema of the shared `routeData` Y.Map (and the `noGoAreas` Y.Array).
// This module is the only place that knows the key strings and JSON
// encoding of the collaborative document's route state — consumers read
// and write through the typed functions below. Waypoints have their own
// schema module: waypoint-ymap.ts.

export type ColorMode =
  | "plain"
  | "elevation"
  | "surface"
  | "grade"
  | "highway"
  | "maxspeed"
  | "smoothness"
  | "tracktype"
  | "cycleway"
  | "bikeroute";

export const DEFAULT_PROFILE = "fastbike";

/** routeData key observed externally (use-routing recomputes on change). */
export const PROFILE_KEY = "profile";

/** Per-coordinate road attributes BRouter enriches the route with. */
export const ROAD_METADATA_KEYS = [
  "surfaces",
  "highways",
  "maxspeeds",
  "smoothnesses",
  "tracktypes",
  "cycleways",
  "bikeroutes",
] as const;

export type RoadMetadataKey = (typeof ROAD_METADATA_KEYS)[number];
export type RoadMetadata = Record<RoadMetadataKey, string[]>;

/** The computed-route portion of routeData, decoded. */
export interface ComputedRoute extends RoadMetadata {
  /** [lon, lat, ele] triples, GeoJSON axis order. */
  coordinates: [number, number, number][] | null;
  segmentBoundaries: number[];
}

export interface NoGoAreaData {
  points: Array<{ lat: number; lon: number }>;
}

export function parseJsonArray<T>(json: string | undefined): T[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

/** Like parseJsonArray, but distinguishes "absent or unparseable" from "empty". */
function parseJsonArrayOrUndefined<T>(json: string | undefined): T[] | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

// --- Computed route (written by the routing host, read by everyone) ---

/**
 * Route coordinates as [lon, lat, ele] triples. Reads the "coordinates"
 * key, transparently handling three formats (spec: planner-route-encoding):
 *  - new: compact encoded polyline ([lon,lat]) + "elevations" channel,
 *  - legacy: JSON [lon,lat,ele][],
 *  - oldest: extracted from a stored "geojson" LineString.
 */
export function getCoordinates(routeData: Y.Map<unknown>): [number, number, number][] | null {
  const coordsVal = routeData.get("coordinates") as string | undefined;
  if (coordsVal) {
    if (isEncodedPolyline(coordsVal)) {
      const lonlat = decodePolyline(coordsVal);
      const elevVal = routeData.get("elevations") as string | undefined;
      const eles = elevVal && isEncodedElevations(elevVal) ? decodeElevations(elevVal) : [];
      return lonlat.map(([lon, lat], i) => [lon, lat, eles[i] ?? 0] as [number, number, number]);
    }
    try {
      return JSON.parse(coordsVal); // legacy JSON
    } catch {
      /* fall through to geojson */
    }
  }
  const geojson = routeData.get("geojson") as string | undefined;
  if (geojson) {
    try {
      const parsed = JSON.parse(geojson);
      const coords: number[][] | undefined = parsed.features?.[0]?.geometry?.coordinates;
      if (coords) {
        return coords.map((c) => [c[0]!, c[1]!, c[2] ?? 0] as [number, number, number]);
      }
    } catch {
      /* invalid geojson */
    }
  }
  return null;
}

/**
 * GeoJSON FeatureCollection string for the route. Returns a stored
 * "geojson" for legacy documents, else assembles one from the decoded
 * coordinates (new documents don't persist geojson — it's derivable).
 */
export function readGeojson(routeData: Y.Map<unknown>): string | undefined {
  const stored = routeData.get("geojson") as string | undefined;
  if (stored) return stored;
  const coordinates = getCoordinates(routeData);
  if (!coordinates) return undefined;
  return JSON.stringify({
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } }],
  });
}

/** Decode one road-metadata channel — new run-length encoding or legacy JSON array. */
function decodeMetaChannel(value: string | undefined): string[] {
  if (!value) return [];
  if (isEncodedRuns(value)) return decodeRuns(value);
  return parseJsonArray<string>(value);
}

export function readRoadMetadata(routeData: Y.Map<unknown>): RoadMetadata {
  const metadata = {} as RoadMetadata;
  for (const key of ROAD_METADATA_KEYS) {
    metadata[key] = decodeMetaChannel(routeData.get(key) as string | undefined);
  }
  return metadata;
}

export function readComputedRoute(routeData: Y.Map<unknown>): ComputedRoute {
  return {
    coordinates: getCoordinates(routeData),
    segmentBoundaries: parseJsonArray<number>(
      routeData.get("segmentBoundaries") as string | undefined,
    ),
    ...readRoadMetadata(routeData),
  };
}

/**
 * Stores an enriched route for all participants in one transaction.
 * Metadata keys are only written when non-empty, mirroring what the
 * routing host has always done — a recompute that yields no metadata
 * leaves the previous arrays in place.
 */
export function writeComputedRoute(
  doc: Y.Doc,
  routeData: Y.Map<unknown>,
  enriched: EnrichedRoute,
): void {
  doc.transact(() => {
    // Compact encoding (spec: planner-route-encoding): geometry stored once
    // as an encoded [lon,lat] polyline + a separate elevation channel; no
    // redundant "geojson" copy (derived on read); road metadata run-length
    // encoded. Drop any legacy "geojson" so re-encoding a legacy doc shrinks it.
    const coords = enriched.coordinates;
    routeData.set("coordinates", encodePolyline(coords.map((c) => [c[0], c[1]] as [number, number])));
    routeData.set("elevations", encodeElevations(coords.map((c) => c[2])));
    routeData.delete("geojson");
    routeData.set("segmentBoundaries", JSON.stringify(enriched.segmentBoundaries));
    for (const key of ROAD_METADATA_KEYS) {
      if (enriched[key]?.length) {
        routeData.set(key, encodeRuns(enriched[key]));
      }
    }
  });
}

/** Debug/recovery escape hatch: store a raw GeoJSON route without enrichment. */
export function setGeojson(routeData: Y.Map<unknown>, geojson: unknown): void {
  routeData.set("geojson", JSON.stringify(geojson));
}

/** Removes the computed route and profile (view preferences are kept). */
/**
 * Clear the computed route geometry + per-coordinate road metadata, but keep
 * the routing profile. Used when the route can no longer exist (fewer than two
 * waypoints) so the stale line stops rendering without resetting the profile.
 */
export function clearComputedRoute(doc: Y.Doc, routeData: Y.Map<unknown>): void {
  doc.transact(() => {
    routeData.delete("geojson");
    routeData.delete("coordinates");
    routeData.delete("elevations");
    routeData.delete("segmentBoundaries");
    for (const key of ROAD_METADATA_KEYS) {
      routeData.delete(key);
    }
  });
}

/** True if the route data currently holds computed geometry. */
export function hasComputedRoute(routeData: Y.Map<unknown>): boolean {
  return routeData.get("coordinates") !== undefined || routeData.get("geojson") !== undefined;
}

export function clearRouteData(doc: Y.Doc, routeData: Y.Map<unknown>): void {
  doc.transact(() => {
    clearComputedRoute(doc, routeData);
    routeData.delete(PROFILE_KEY);
  });
}

// --- Routing profile ---

export function getProfile(routeData: Y.Map<unknown>): string | undefined {
  return routeData.get(PROFILE_KEY) as string | undefined;
}

export function setProfile(routeData: Y.Map<unknown>, profile: string): void {
  routeData.set(PROFILE_KEY, profile);
}

// --- View preferences (shared across participants) ---

export function getColorMode(routeData: Y.Map<unknown>): ColorMode {
  return (routeData.get("colorMode") as ColorMode | undefined) ?? "plain";
}

export function setColorMode(routeData: Y.Map<unknown>, mode: ColorMode): void {
  routeData.set("colorMode", mode);
}

export function getBaseLayer(routeData: Y.Map<unknown>): string | undefined {
  return routeData.get("baseLayer") as string | undefined;
}

export function setBaseLayer(routeData: Y.Map<unknown>, name: string): void {
  routeData.set("baseLayer", name);
}

export function getOverlays(routeData: Y.Map<unknown>): string[] | undefined {
  return parseJsonArrayOrUndefined<string>(routeData.get("overlays") as string | undefined);
}

export function setOverlays(routeData: Y.Map<unknown>, ids: string[]): void {
  routeData.set("overlays", JSON.stringify(ids));
}

export function getPoiCategories(routeData: Y.Map<unknown>): string[] | undefined {
  return parseJsonArrayOrUndefined<string>(
    routeData.get("poiCategories") as string | undefined,
  );
}

export function setPoiCategories(routeData: Y.Map<unknown>, categories: string[]): void {
  routeData.set("poiCategories", JSON.stringify(categories));
}

// --- No-go areas (their own Y.Array on the document) ---

/** Reads all no-go areas, dropping degenerate ones (fewer than 3 points). */
export function extractNoGoAreas(noGoAreas: Y.Array<Y.Map<unknown>>): NoGoAreaData[] {
  return noGoAreas
    .toArray()
    .map((yMap) => ({
      points: (yMap.get("points") as Array<{ lat: number; lon: number }>) ?? [],
    }))
    .filter((a) => a.points.length >= 3);
}
