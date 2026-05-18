import { useState, useRef, useCallback } from "react";
import * as Y from "yjs";
import { useTranslation } from "react-i18next";
import { parseGpxAsync, extractWaypoints } from "@trails-cool/gpx";
import type { YjsState } from "~/lib/use-yjs";
import { waypointToYMap } from "~/lib/waypoint-ymap";

export function useGpxDrop(yjs: YjsState, onImportError?: (message: string) => void) {
  const { t } = useTranslation("planner");
  const [draggingOver, setDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setDraggingOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDraggingOver(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".gpx")) {
      onImportError?.(t("importGpxError"));
      return;
    }

    try {
      const text = await file.text();
      const gpxData = await parseGpxAsync(text);
      const newWaypoints = extractWaypoints(gpxData);
      if (newWaypoints.length < 2) return;

      if (!window.confirm(t("replaceRouteConfirm"))) return;

      yjs.doc.transact(() => {
        yjs.waypoints.delete(0, yjs.waypoints.length);
        for (const wp of newWaypoints) {
          yjs.waypoints.push([waypointToYMap(wp)]);
        }

        yjs.noGoAreas.delete(0, yjs.noGoAreas.length);
        for (const area of gpxData.noGoAreas) {
          const yMap = new Y.Map();
          yMap.set("points", area.points);
          yjs.noGoAreas.push([yMap]);
        }

        if (gpxData.description) {
          yjs.notes.delete(0, yjs.notes.length);
          yjs.notes.insert(0, gpxData.description);
        }
      }, "local");
    } catch {
      onImportError?.(t("importGpxError"));
    }
  }, [yjs, t, onImportError]);

  return { draggingOver, handleDragEnter, handleDragLeave, handleDragOver, handleDrop };
}
