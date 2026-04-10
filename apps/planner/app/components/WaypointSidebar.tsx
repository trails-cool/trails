import { useEffect, useState, useCallback } from "react";
import * as Y from "yjs";
import { useTranslation } from "react-i18next";
import type { YjsState } from "~/lib/use-yjs";
import type { DayStage } from "@trails-cool/gpx";
import { setOvernight, isOvernight } from "~/lib/overnight";
import { DayBreakdown } from "./DayBreakdown";

interface WaypointData {
  lat: number;
  lon: number;
  name?: string;
  overnight: boolean;
}

function getWaypointsFromYjs(waypoints: Y.Array<Y.Map<unknown>>): WaypointData[] {
  return waypoints.toArray().map((yMap) => ({
    lat: yMap.get("lat") as number,
    lon: yMap.get("lon") as number,
    name: yMap.get("name") as string | undefined,
    overnight: isOvernight(yMap),
  }));
}

interface WaypointSidebarProps {
  yjs: YjsState;
  routeStats?: {
    distance?: number;
    elevationGain?: number;
    elevationLoss?: number;
  };
  days: DayStage[];
}

export function WaypointSidebar({ yjs, routeStats, days }: WaypointSidebarProps) {
  const { t } = useTranslation();
  const [waypoints, setWaypoints] = useState<WaypointData[]>([]);

  useEffect(() => {
    const update = () => setWaypoints(getWaypointsFromYjs(yjs.waypoints));
    yjs.waypoints.observeDeep(update);
    update();
    return () => yjs.waypoints.unobserveDeep(update);
  }, [yjs.waypoints]);

  const deleteWaypoint = useCallback(
    (index: number) => {
      yjs.doc.transact(() => yjs.waypoints.delete(index, 1), "local");
    },
    [yjs.doc, yjs.waypoints],
  );

  const moveWaypoint = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0) return;
      const item = yjs.waypoints.get(from);
      if (!item) return;
      const data = {
        lat: item.get("lat") as number,
        lon: item.get("lon") as number,
        name: item.get("name") as string | undefined,
        overnight: isOvernight(item),
      };
      yjs.doc.transact(() => {
        yjs.waypoints.delete(from, 1);
        const yMap = new Y.Map();
        yMap.set("lat", data.lat);
        yMap.set("lon", data.lon);
        if (data.name) yMap.set("name", data.name);
        if (data.overnight) yMap.set("overnight", true);
        yjs.waypoints.insert(to, [yMap]);
      }, "local");
    },
    [yjs.waypoints, yjs.doc],
  );

  const toggleOvernight = useCallback(
    (index: number) => {
      const wp = waypoints[index];
      if (!wp) return;
      setOvernight(yjs, index, !wp.overnight);
    },
    [yjs, waypoints],
  );

  const hasMultipleDays = days.length > 1;

  const renderWaypointRow = (wp: WaypointData, i: number) => (
    <li key={i} className="group flex items-center gap-2 px-4 py-2 hover:bg-gray-50">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
        {i + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-700">
          {wp.name ?? `${wp.lat.toFixed(4)}, ${wp.lon.toFixed(4)}`}
        </p>
      </div>
      {wp.overnight && (
        <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200">
          {t("planner.multiDay.overnight")}
        </span>
      )}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
        {/* Overnight toggle — not on first or last waypoint */}
        {i > 0 && i < waypoints.length - 1 && (
          <button
            onClick={() => toggleOvernight(i)}
            className={`rounded p-1 ${wp.overnight ? "text-amber-600 hover:bg-amber-100" : "text-gray-400 hover:bg-gray-200 hover:text-gray-600"}`}
            title={wp.overnight ? t("planner.multiDay.removeOvernight") : t("planner.multiDay.markOvernight")}
          >
            ☾
          </button>
        )}
        {i > 0 && (
          <button
            onClick={() => moveWaypoint(i, i - 1)}
            className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            title="Move up"
          >
            ↑
          </button>
        )}
        {i < waypoints.length - 1 && (
          <button
            onClick={() => moveWaypoint(i, i + 1)}
            className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            title="Move down"
          >
            ↓
          </button>
        )}
        <button
          onClick={() => deleteWaypoint(i)}
          className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
          title="Delete"
        >
          ×
        </button>
      </div>
    </li>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header with route summary */}
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-medium text-gray-900">
          {t("planner.sidebar.waypoints")} ({waypoints.length})
        </h2>
        {routeStats && routeStats.distance !== undefined && (
          <p className="mt-0.5 text-xs text-gray-500">
            {(routeStats.distance / 1000).toFixed(1)} km
            {routeStats.elevationGain !== undefined && ` · ↑${routeStats.elevationGain} m`}
            {hasMultipleDays && ` · ${t("planner.multiDay.dayCount", { count: days.length })}`}
          </p>
        )}
      </div>

      {/* Waypoint list */}
      <div className="flex-1 overflow-y-auto">
        {waypoints.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            Click on the map to add waypoints
          </p>
        ) : hasMultipleDays ? (
          <DayBreakdown days={days}>
            {(_day, { start, end }) => (
              <ul className="divide-y divide-gray-100">
                {waypoints.slice(start, end + 1).map((wp, offset) => renderWaypointRow(wp, start + offset))}
              </ul>
            )}
          </DayBreakdown>
        ) : (
          <ul className="divide-y divide-gray-100">
            {waypoints.map((wp, i) => renderWaypointRow(wp, i))}
          </ul>
        )}
      </div>

      {/* Stats footer — only shown for single-day view (multi-day shows per-day stats inline) */}
      {!hasMultipleDays && routeStats && routeStats.distance !== undefined && (
        <div className="border-t border-gray-200 px-4 py-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="font-medium text-gray-900">
                {(routeStats.distance / 1000).toFixed(1)} km
              </p>
              <p className="text-gray-500">{t("planner.multiDay.distance")}</p>
            </div>
            {routeStats.elevationGain !== undefined && (
              <div>
                <p className="font-medium text-gray-900">
                  ↑ {routeStats.elevationGain} m
                </p>
                <p className="text-gray-500">{t("planner.multiDay.ascent")}</p>
              </div>
            )}
            {routeStats.elevationLoss !== undefined && (
              <div>
                <p className="font-medium text-gray-900">
                  ↓ {routeStats.elevationLoss} m
                </p>
                <p className="text-gray-500">{t("planner.multiDay.descent")}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
