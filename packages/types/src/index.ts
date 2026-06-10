/**
 * Shared TypeScript types for trails.cool — the Waypoint wire format
 * used by both the Planner and Journal apps (Yjs document, GPX
 * extensions, handoff payloads).
 *
 * Not here on purpose: database row types are derived from the Drizzle
 * schema (@trails-cool/db, e.g. RouteRow), and API response shapes are
 * the Zod contracts in @trails-cool/api. Earlier hand-written Route /
 * Activity interfaces in this file drifted from both and had zero
 * importers when they were removed.
 */

export interface WaypointPoiTags {
  phone?: string;
  website?: string;
  opening_hours?: string;
  "addr:street"?: string;
  "addr:housenumber"?: string;
  "addr:postcode"?: string;
  "addr:city"?: string;
  amenity?: string;
  tourism?: string;
  shop?: string;
}

export interface Waypoint {
  lat: number;
  lon: number;
  name?: string;
  note?: string;
  isDayBreak?: boolean;
  osmId?: number;
  poiTags?: WaypointPoiTags;
}
