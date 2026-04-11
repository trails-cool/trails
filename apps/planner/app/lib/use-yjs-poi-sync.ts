import { useEffect, useRef } from "react";
import type { YjsState } from "./use-yjs.ts";
import type { PoiState } from "./use-pois.ts";

const YJS_KEY_POI_CATEGORIES = "poiCategories";

/**
 * Bidirectional sync between POI/overlay state and Yjs routeData.
 * - When local state changes → write to Yjs
 * - When Yjs changes (from another participant) → update local state
 */
export function useYjsPoiSync(yjs: YjsState | null, poiState: PoiState): void {
  const suppressYjsUpdate = useRef(false);
  const prevCategories = useRef<string[]>([]);

  // Local → Yjs: write enabledCategories to Yjs when they change
  useEffect(() => {
    if (!yjs) return;
    const current = poiState.enabledCategories;
    if (arraysEqual(current, prevCategories.current)) return;
    prevCategories.current = current;

    suppressYjsUpdate.current = true;
    yjs.routeData.set(YJS_KEY_POI_CATEGORIES, JSON.stringify(current));
    // Allow Yjs observer to fire but suppress our handler
    queueMicrotask(() => { suppressYjsUpdate.current = false; });
  }, [yjs, poiState.enabledCategories]);

  // Yjs → Local: observe Yjs changes from other participants
  useEffect(() => {
    if (!yjs) return;

    const handleChange = () => {
      if (suppressYjsUpdate.current) return;

      const raw = yjs.routeData.get(YJS_KEY_POI_CATEGORIES) as string | undefined;
      if (!raw) return;

      try {
        const categories = JSON.parse(raw) as string[];
        if (!arraysEqual(categories, prevCategories.current)) {
          prevCategories.current = categories;
          poiState.setEnabledCategories(categories);
        }
      } catch {
        // Invalid JSON in Yjs — ignore
      }
    };

    yjs.routeData.observe(handleChange);

    // On initial connect, load from Yjs if state exists
    handleChange();

    return () => yjs.routeData.unobserve(handleChange);
  }, [yjs, poiState.setEnabledCategories]);
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
