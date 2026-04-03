import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as Y from "yjs";
import type { YjsState } from "~/lib/use-yjs";
import { generateGpx } from "@trails-cool/gpx";
import type { TrackPoint } from "@trails-cool/gpx";

export function ExportButton({ yjs }: { yjs: YjsState }) {
  const { t } = useTranslation("planner");

  const handleExport = useCallback(() => {
    // Export only the computed track, not editing waypoints.
    // The track already reflects no-go area avoidance and BRouter's routing.
    // On reimport, waypoints are extracted from the track shape.
    let tracks: TrackPoint[][] = [];
    const geojsonStr = yjs.routeData.get("geojson") as string | undefined;
    if (geojsonStr) {
      try {
        const geojson = JSON.parse(geojsonStr);
        const coords: number[][] = geojson.features?.[0]?.geometry?.coordinates ?? [];
        if (coords.length > 0) {
          tracks = [
            coords.map((c) => ({
              lat: c[1]!,
              lon: c[0]!,
              ele: c[2],
            })),
          ];
        }
      } catch {
        // Invalid GeoJSON
      }
    }

    const gpx = generateGpx({ name: "trails.cool route", waypoints: [], tracks });

    // Download
    const blob = new Blob([gpx], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "route.gpx";
    a.click();
    URL.revokeObjectURL(url);
  }, [yjs.waypoints, yjs.routeData]);

  return (
    <button
      onClick={handleExport}
      className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
    >
      {t("exportGpx")}
    </button>
  );
}
