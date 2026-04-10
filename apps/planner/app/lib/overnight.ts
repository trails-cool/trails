import * as Y from "yjs";
import type { YjsState } from "./use-yjs.ts";

/**
 * Set or clear the overnight flag on a waypoint.
 */
export function setOvernight(yjs: YjsState, index: number, value: boolean): void {
  const waypointMap = yjs.waypoints.get(index);
  if (!waypointMap) return;
  yjs.doc.transact(() => {
    if (value) {
      waypointMap.set("overnight", true);
    } else {
      waypointMap.delete("overnight");
    }
  }, "local");
}

/**
 * Check if a waypoint Y.Map has the overnight flag set.
 */
export function isOvernight(yMap: Y.Map<unknown>): boolean {
  return yMap.get("overnight") === true;
}
