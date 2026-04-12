import { useEffect, useRef } from "react";
import type { YjsState } from "./use-yjs.ts";
import type { PoiState } from "./use-pois.ts";
import { getCategoriesForProfile } from "@trails-cool/map-core";

/**
 * Auto-enable relevant POI categories when the routing profile changes.
 * Only triggers on explicit profile changes (not initial load).
 */
export function useProfileDefaults(yjs: YjsState | null, poiState: PoiState): void {
  const initializedRef = useRef(false);
  const prevProfileRef = useRef<string | null>(null);

  useEffect(() => {
    if (!yjs) return;

    const handleChange = () => {
      const profile = yjs.routeData.get("profile") as string | undefined;
      if (!profile) return;

      // Skip initial load — respect existing state
      if (!initializedRef.current) {
        initializedRef.current = true;
        prevProfileRef.current = profile;
        return;
      }

      // Only act on actual profile changes
      if (profile === prevProfileRef.current) return;
      prevProfileRef.current = profile;

      // Auto-enable POI categories for this profile
      const defaultCategories = getCategoriesForProfile(profile);
      if (defaultCategories.length > 0) {
        poiState.setEnabledCategories((prev: string[]) => {
          const merged = new Set([...prev, ...defaultCategories]);
          return [...merged];
        });
      }
    };

    yjs.routeData.observe(handleChange);
    return () => yjs.routeData.unobserve(handleChange);
  }, [yjs, poiState.setEnabledCategories]);
}
