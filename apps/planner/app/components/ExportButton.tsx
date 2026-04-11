import { useCallback, useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import * as Y from "yjs";
import type { YjsState } from "~/lib/use-yjs";
import { generateGpx, computeDays } from "@trails-cool/gpx";
import type { TrackPoint, NoGoArea } from "@trails-cool/gpx";

function getTracks(yjs: YjsState): TrackPoint[][] {
  const geojsonStr = yjs.routeData.get("geojson") as string | undefined;
  if (!geojsonStr) return [];
  try {
    const geojson = JSON.parse(geojsonStr);
    const coords: number[][] = geojson.features?.[0]?.geometry?.coordinates ?? [];
    if (coords.length > 0) {
      return [coords.map((c) => ({ lat: c[1]!, lon: c[0]!, ele: c[2] }))];
    }
  } catch { /* invalid geojson */ }
  return [];
}

function getWaypoints(yjs: YjsState) {
  return yjs.waypoints.toArray().map((yMap: Y.Map<unknown>) => ({
    lat: yMap.get("lat") as number,
    lon: yMap.get("lon") as number,
    name: yMap.get("name") as string | undefined,
    isDayBreak: yMap.get("overnight") === true ? true : undefined,
  }));
}

function getNoGoAreas(yjs: YjsState): NoGoArea[] {
  return yjs.noGoAreas.toArray().map((yMap: Y.Map<unknown>) => ({
    points: (yMap.get("points") as Array<{ lat: number; lon: number }>) ?? [],
  })).filter((a) => a.points.length >= 3);
}

function download(gpx: string, filename: string) {
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({ yjs }: { yjs: YjsState }) {
  const { t } = useTranslation("planner");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside mousedown
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleExportRoute = useCallback(() => {
    const tracks = getTracks(yjs);
    const gpx = generateGpx({ name: "trails.cool route", waypoints: [], tracks });
    download(gpx, "route.gpx");
    setOpen(false);
  }, [yjs]);

  const handleExportPlan = useCallback(() => {
    const tracks = getTracks(yjs);
    const waypoints = getWaypoints(yjs);
    const noGoAreas = getNoGoAreas(yjs);
    const gpx = generateGpx({ name: "trails.cool route", waypoints, tracks, noGoAreas });
    download(gpx, "route-plan.gpx");
    setOpen(false);
  }, [yjs]);

  const handleExportDays = useCallback(() => {
    const tracks = getTracks(yjs);
    const waypoints = getWaypoints(yjs);
    const allPoints = tracks.flat();
    if (allPoints.length === 0 || waypoints.length === 0) return;

    const days = computeDays(waypoints, tracks);
    if (days.length <= 1) {
      // Single day — just export the full route
      const gpx = generateGpx({ name: "trails.cool route", tracks });
      download(gpx, "route.gpx");
      setOpen(false);
      return;
    }

    // Find closest track index for each waypoint
    const wpTrackIndices = waypoints.map((wp) => {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < allPoints.length; i++) {
        const dx = allPoints[i]!.lat - wp.lat;
        const dy = allPoints[i]!.lon - wp.lon;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      return bestIdx;
    });

    for (const day of days) {
      const startIdx = wpTrackIndices[day.startWaypointIndex]!;
      const endIdx = wpTrackIndices[day.endWaypointIndex]!;
      const dayPoints = allPoints.slice(startIdx, endIdx + 1);
      const dayName = day.startName && day.endName
        ? `Day ${day.dayNumber}: ${day.startName} - ${day.endName}`
        : `Day ${day.dayNumber}`;
      const gpx = generateGpx({ name: dayName, tracks: [dayPoints] });
      const filename = `day-${day.dayNumber}${day.startName ? `-${day.startName.toLowerCase().replace(/\s+/g, "-")}` : ""}.gpx`;
      download(gpx, filename);
    }
    setOpen(false);
  }, [yjs]);

  const hasMultipleDays = (() => {
    const waypoints = getWaypoints(yjs);
    return waypoints.some((w) => w.isDayBreak);
  })();

  return (
    <div ref={ref} className="relative z-[1001]">
      <div className="flex">
        <button
          onClick={handleExportRoute}
          className="rounded-l bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
        >
          {t("exportGpx")}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className="rounded-r border-l border-gray-300 bg-gray-100 px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-200"
        >
          ▾
        </button>
      </div>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded border border-gray-200 bg-white py-1 shadow-lg">
          <button
            onClick={handleExportRoute}
            className="block w-full px-3 py-1.5 text-left hover:bg-gray-100"
          >
            <span className="text-sm text-gray-700">{t("exportRoute")}</span>
            <span className="block text-xs text-gray-400">{t("exportRouteDesc")}</span>
          </button>
          <button
            onClick={handleExportPlan}
            className="block w-full px-3 py-1.5 text-left hover:bg-gray-100"
          >
            <span className="text-sm text-gray-700">{t("exportPlan")}</span>
            <span className="block text-xs text-gray-400">{t("exportPlanDesc")}</span>
          </button>
          {hasMultipleDays && (
            <button
              onClick={handleExportDays}
              className="block w-full px-3 py-1.5 text-left hover:bg-gray-100"
            >
              <span className="text-sm text-gray-700">{t("exportDays")}</span>
              <span className="block text-xs text-gray-400">{t("exportDaysDesc")}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
