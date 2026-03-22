/**
 * Shared TypeScript types for trails.cool
 *
 * These types are used by both the Planner and Journal apps.
 */

export interface Waypoint {
  lat: number;
  lon: number;
  name?: string;
  isDayBreak?: boolean;
}

export interface RouteMetadata {
  created: Date;
  updated: Date;
  owner: string;
  contributors: string[];
  routingProfile: string;
  dayBreaks: number[];
  distance: number;
  elevation: {
    gain: number;
    loss: number;
  };
  tags: string[];
}

export interface Route {
  id: string;
  name: string;
  description: string;
  gpx: string;
  metadata: RouteMetadata;
  plannerState?: Uint8Array;
  versions: RouteVersion[];
}

export interface RouteVersion {
  version: number;
  gpx: string;
  createdAt: Date;
  createdBy: string;
  changeDescription?: string;
}

export interface Activity {
  id: string;
  routeId?: string;
  name: string;
  description: string;
  gpx: string;
  startedAt: Date;
  duration: number;
  photos: string[];
  participants: string[];
}
