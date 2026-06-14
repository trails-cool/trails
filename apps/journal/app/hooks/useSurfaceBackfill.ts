import { useEffect } from "react";
import { useRevalidator } from "react-router";

/**
 * Live-updates a route/activity detail page when its async surface backfill
 * completes. Subscribes to `/api/events` and, on a `surface_breakdown` event
 * matching this row, re-runs the loader (so the bars appear without a reload).
 *
 * Enable only while it's worth it — i.e. the viewer is the owner (the backfill
 * emits to the owner's user stream) and the breakdown isn't present yet. Once
 * the breakdown lands, the loader revalidates, `enabled` flips false, and the
 * connection is torn down.
 */
export function useSurfaceBackfillUpdates(
  kind: "route" | "activity",
  id: string,
  enabled: boolean,
): void {
  const revalidator = useRevalidator();
  useEffect(() => {
    if (!enabled) return;
    if (typeof EventSource === "undefined") return;
    const es = new EventSource("/api/events");
    const onEvent = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as { kind?: string; id?: string };
        if (parsed.kind === kind && parsed.id === id) revalidator.revalidate();
      } catch {
        // Malformed payload — ignore.
      }
    };
    es.addEventListener("surface_breakdown", onEvent as EventListener);
    return () => {
      es.removeEventListener("surface_breakdown", onEvent as EventListener);
      es.close();
    };
  }, [kind, id, enabled, revalidator]);
}
