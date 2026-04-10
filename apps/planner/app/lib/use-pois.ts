import { useCallback, useEffect, useRef, useState } from "react";
import { queryPois, OverpassRateLimitError, type Poi, type BBox } from "./overpass.ts";
import { getCached, setCached } from "./poi-cache.ts";
import { poiCategories } from "./poi-categories.ts";

const MIN_ZOOM = 12;
const DEBOUNCE_MS = 800;
const MIN_REQUEST_INTERVAL_MS = 2000;
const BACKOFF_BASE_MS = 10000;
const MAX_BACKOFF_MS = 60000;

export type PoiStatus = "idle" | "loading" | "loaded" | "zoom_too_low" | "rate_limited" | "error";

export interface PoiState {
  pois: Poi[];
  status: PoiStatus;
  enabledCategories: string[];
  setEnabledCategories: (ids: string[]) => void;
  toggleCategory: (id: string) => void;
  refresh: (bbox: BBox, zoom: number) => void;
}

export function usePois(): PoiState {
  const [pois, setPois] = useState<Poi[]>([]);
  const [status, setStatus] = useState<PoiStatus>("idle");
  const [enabledCategories, setEnabledCategories] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const backoffRef = useRef(0);
  const lastRequestRef = useRef(0);

  const toggleCategory = useCallback((id: string) => {
    setEnabledCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }, []);

  const refresh = useCallback(
    (bbox: BBox, zoom: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (enabledCategories.length === 0) {
        setPois([]);
        setStatus("idle");
        return;
      }

      if (zoom < MIN_ZOOM) {
        setPois([]);
        setStatus("zoom_too_low");
        return;
      }

      const categories = poiCategories.filter((c) => enabledCategories.includes(c.id));
      const categoriesKey = [...enabledCategories].sort().join(",");

      // Check cache first
      const cached = getCached(bbox, categoriesKey);
      if (cached) {
        setPois(cached);
        setStatus("loaded");
        return;
      }

      setStatus("loading");

      // Calculate delay: debounce + respect minimum interval
      const sinceLastRequest = Date.now() - lastRequestRef.current;
      const delay = Math.max(DEBOUNCE_MS, MIN_REQUEST_INTERVAL_MS - sinceLastRequest);

      debounceRef.current = setTimeout(async () => {
        // Cancel previous request
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        lastRequestRef.current = Date.now();

        try {
          const result = await queryPois(bbox, categories, controller.signal);
          if (controller.signal.aborted) return;

          setCached(bbox, categoriesKey, result);
          setPois(result);
          setStatus("loaded");
          backoffRef.current = 0;
        } catch (err) {
          if (controller.signal.aborted) return;

          if (err instanceof OverpassRateLimitError) {
            setStatus("rate_limited");
            backoffRef.current = Math.min(
              (backoffRef.current || BACKOFF_BASE_MS) * 2,
              MAX_BACKOFF_MS,
            );
          } else {
            setStatus("error");
          }
        }
      }, delay);
    },
    [enabledCategories],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { pois, status, enabledCategories, setEnabledCategories, toggleCategory, refresh };
}
