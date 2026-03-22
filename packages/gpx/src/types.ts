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

export interface GpxData {
  name?: string;
  waypoints: Waypoint[];
  tracks: TrackPoint[][];
  elevation: {
    gain: number;
    loss: number;
    profile: ElevationProfile[];
  };
}
