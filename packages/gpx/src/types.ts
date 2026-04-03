import type { Waypoint } from "@trails-cool/types";

export interface TrackPoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
}

export interface ElevationProfile {
  /** Distance from start in meters */
  distance: number;
  /** Elevation in meters */
  elevation: number;
}

export interface NoGoArea {
  points: Array<{ lat: number; lon: number }>;
}

export interface GpxData {
  name?: string;
  waypoints: Waypoint[];
  tracks: TrackPoint[][];
  noGoAreas: NoGoArea[];
  /** Total distance in meters (haversine, works with or without elevation data) */
  distance: number;
  elevation: {
    gain: number;
    loss: number;
    profile: ElevationProfile[];
  };
}
