import { useState, useEffect, useRef } from "react";
import { fetchNearbyPois, OverpassRateLimitError, type Poi } from "./overpass.ts";
import { poiCategories } from "@trails-cool/map-core";

const NEARBY_RADIUS_METERS = 500;
const DEBOUNCE_MS = 500;
const TIMEOUT_MS = 10_000;
const RATE_LIMIT_SUPPRESS_MS = 60_000;

export type NearbyPoisStatus = "idle" | "loading" | "done" | "rate_limited" | "error";

export interface NearbyPoisState {
  pois: Poi[];
  status: NearbyPoisStatus;
}

const rateLimitedUntilRef = { current: 0 };

export function useNearbyPois(
  lat: number | undefined,
  lon: number | undefined,
): NearbyPoisState {
  const [state, setState] = useState<NearbyPoisState>({ pois: [], status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (lat === undefined || lon === undefined) {
      setState({ pois: [], status: "idle" });
      return;
    }

    // Clear previous debounce
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();

    timerRef.current = setTimeout(async () => {
      if (Date.now() < rateLimitedUntilRef.current) {
        setState({ pois: [], status: "rate_limited" });
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      setState((prev) => ({ ...prev, status: "loading" }));

      try {
        const pois = await fetchNearbyPois(lat, lon, NEARBY_RADIUS_METERS, poiCategories, controller.signal);
        if (!controller.signal.aborted) {
          setState({ pois, status: "done" });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof OverpassRateLimitError) {
          rateLimitedUntilRef.current = Date.now() + RATE_LIMIT_SUPPRESS_MS;
          setState({ pois: [], status: "rate_limited" });
        } else {
          setState({ pois: [], status: "error" });
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [lat, lon]);

  return state;
}
