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
  description?: string;
  waypoints: Waypoint[];
  tracks: TrackPoint[][];
  noGoAreas: NoGoArea[];
  /** Total distance in meters (haversine, works with or without elevation data) */
  distance: number;
  elevation: {
    /** Noise-filtered ascent in metres (hysteresis; the headline number). */
    gain: number;
    /** Noise-filtered descent in metres. */
    loss: number;
    /** Unfiltered ascent (sum of every positive delta) — diagnostic/fallback. */
    gainRaw: number;
    /** Unfiltered descent. */
    lossRaw: number;
    profile: ElevationProfile[];
  };
}
