import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { YjsState } from "~/lib/use-yjs";
import type { DayStage } from "@trails-cool/gpx";
import { setOvernight } from "~/lib/overnight";
import { DayBreakdown } from "./DayBreakdown";
import { useNearbyPois } from "~/lib/use-nearby-pois";
import { poiCategories } from "@trails-cool/map-core";
import type { Poi } from "~/lib/pois";
import {
  extractWaypointData,
  waypointFromYMap,
  waypointToYMap,
  type WaypointData,
} from "~/lib/waypoint-ymap";

const NOTE_MAX = 500;

interface WaypointSidebarProps {
  yjs: YjsState;
  routeStats?: {
    distance?: number;
    elevationGain?: number;
    elevationLoss?: number;
  };
  days: DayStage[];
  onWaypointHover?: (index: number | null) => void;
  onWaypointSelect?: (index: number | null) => void;
}

export function WaypointSidebar({ yjs, routeStats, days, onWaypointHover, onWaypointSelect }: WaypointSidebarProps) {
  const { t } = useTranslation("planner");
  const [waypoints, setWaypoints] = useState<WaypointData[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [noteEditValue, setNoteEditValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const update = () => setWaypoints(extractWaypointData(yjs.waypoints));
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
      const wp = waypointFromYMap(item);
      yjs.doc.transact(() => {
        yjs.waypoints.delete(from, 1);
        yjs.waypoints.insert(to, [waypointToYMap(wp)]);
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

  const setNote = useCallback(
    (index: number, note: string) => {
      const yMap = yjs.waypoints.get(index);
      if (!yMap) return;
      yjs.doc.transact(() => {
        if (note.trim()) {
          yMap.set("note", note.trim());
        } else {
          yMap.delete("note");
        }
      }, "local");
    },
    [yjs],
  );

  const selectWaypoint = useCallback(
    (index: number | null) => {
      setSelectedIndex(index);
      onWaypointSelect?.(index);
    },
    [onWaypointSelect],
  );

  const openNoteEditor = useCallback(
    (index: number) => {
      setNoteEditValue(waypoints[index]?.note ?? "");
      setEditingNoteIndex(index);
      setTimeout(() => {
        textareaRef.current?.focus();
        // auto-resize
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
        }
      }, 0);
    },
    [waypoints],
  );

  const snapToPoi = useCallback(
    (poi: Poi) => {
      if (selectedIndex === null) return;
      const yMap = yjs.waypoints.get(selectedIndex);
      if (!yMap) return;
      const cat = poiCategories.find((c) => c.id === poi.category);
      const notePrefix = cat ? `${cat.icon} ${poi.name ?? cat.id}` : (poi.name ?? "");
      yjs.doc.transact(() => {
        yMap.set("lat", poi.lat);
        yMap.set("lon", poi.lon);
        if (poi.name && !yMap.get("name")) yMap.set("name", poi.name);
        const existing = yMap.get("note") as string | undefined;
        yMap.set("note", existing ? `${notePrefix}\n${existing}` : notePrefix);
        if (poi.id) yMap.set("osmId", poi.id);
      }, "local");
    },
    [selectedIndex, yjs, poiCategories],
  );

  const selectedWp = selectedIndex !== null ? waypoints[selectedIndex] : undefined;
  const nearbyPoisState = useNearbyPois(selectedWp?.lat, selectedWp?.lon);
  const [showAllNearby, setShowAllNearby] = useState(false);

  const hasMultipleDays = days.length > 1;

  const renderWaypointRow = (wp: WaypointData, i: number) => (
    <li
      key={i}
      className={`group flex items-start gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer ${selectedIndex === i ? "bg-blue-50" : ""}`}
      onClick={() => selectWaypoint(selectedIndex === i ? null : i)}
      onMouseEnter={() => onWaypointHover?.(i)}
      onMouseLeave={() => onWaypointHover?.(null)}
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
        {i + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-700">
          {wp.name ?? `${wp.lat.toFixed(4)}, ${wp.lon.toFixed(4)}`}
        </p>
        {/* Note display / editor */}
        {editingNoteIndex === i ? (
          <div onClick={(e) => e.stopPropagation()}>
            <textarea
              ref={textareaRef}
              value={noteEditValue}
              maxLength={NOTE_MAX}
              className="mt-1 w-full resize-none rounded border border-blue-300 bg-white px-2 py-1 text-xs italic text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
              rows={2}
              onChange={(e) => {
                setNoteEditValue(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onBlur={() => {
                setNote(i, noteEditValue);
                setEditingNoteIndex(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditingNoteIndex(null);
                  setNoteEditValue("");
                }
              }}
            />
            <p className="mt-0.5 text-right text-[10px] text-gray-400">
              {noteEditValue.length} / {NOTE_MAX}
            </p>
          </div>
        ) : (
          <p
            className="mt-0.5 line-clamp-2 cursor-text text-xs italic text-gray-400 hover:text-gray-600"
            onClick={(e) => {
              e.stopPropagation();
              openNoteEditor(i);
            }}
          >
            {wp.note ?? t("waypoint.notePlaceholder")}
          </p>
        )}
      </div>
      {wp.overnight && (
        <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200">
          {t("multiDay.overnight")}
        </span>
      )}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
        {/* Overnight toggle — not on first or last waypoint */}
        {i > 0 && i < waypoints.length - 1 && (
          <button
            onClick={() => toggleOvernight(i)}
            className={`rounded p-1 ${wp.overnight ? "text-amber-600 hover:bg-amber-100" : "text-gray-400 hover:bg-gray-200 hover:text-gray-600"}`}
            title={wp.overnight ? t("multiDay.removeOvernight") : t("multiDay.markOvernight")}
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
          {t("sidebar.waypoints")} ({waypoints.length})
        </h2>
        {routeStats && routeStats.distance !== undefined && (
          <p className="mt-0.5 text-xs text-gray-500">
            {(routeStats.distance / 1000).toFixed(1)} km
            {routeStats.elevationGain !== undefined && ` · ↑${routeStats.elevationGain} m`}
            {hasMultipleDays && ` · ${t("multiDay.dayCount", { count: days.length })}`}
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

      {/* Nearby POIs for selected waypoint */}
      {selectedIndex !== null && (
        <div className="border-t border-gray-200 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-gray-700">{t("nearbyPoi.heading")}</p>
          {nearbyPoisState.status === "loading" && (
            <p className="text-xs text-gray-400">{t("nearbyPoi.loading")}</p>
          )}
          {nearbyPoisState.status === "rate_limited" && (
            <p className="text-xs text-gray-400">{t("nearbyPoi.rateLimited")}</p>
          )}
          {(nearbyPoisState.status === "done" || nearbyPoisState.status === "error") && nearbyPoisState.pois.length === 0 && (
            <p className="text-xs text-gray-400">{t("nearbyPoi.empty")}</p>
          )}
          {nearbyPoisState.pois.length > 0 && (
            <>
              <ul className="space-y-1">
                {(showAllNearby ? nearbyPoisState.pois : nearbyPoisState.pois.slice(0, 5)).map((poi) => {
                  const cat = poiCategories.find((c) => c.id === poi.category);
                  return (
                    <li key={poi.id} className="flex items-center gap-2">
                      <span className="shrink-0 text-sm">{cat?.icon ?? "📍"}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-gray-700">
                        {poi.name ?? cat?.id ?? poi.category}
                      </span>
                      <button
                        onClick={() => snapToPoi(poi)}
                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50"
                      >
                        {t("nearbyPoi.snap")}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {nearbyPoisState.pois.length > 5 && !showAllNearby && (
                <button
                  onClick={() => setShowAllNearby(true)}
                  className="mt-1 text-[11px] text-blue-500 hover:underline"
                >
                  {t("nearbyPoi.showMore")}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Stats footer — only shown for single-day view (multi-day shows per-day stats inline) */}
      {!hasMultipleDays && routeStats && routeStats.distance !== undefined && (
        <div className="border-t border-gray-200 px-4 py-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="font-medium text-gray-900">
                {(routeStats.distance / 1000).toFixed(1)} km
              </p>
              <p className="text-gray-500">{t("multiDay.distance")}</p>
            </div>
            {routeStats.elevationGain !== undefined && (
              <div>
                <p className="font-medium text-gray-900">
                  ↑ {routeStats.elevationGain} m
                </p>
                <p className="text-gray-500">{t("multiDay.ascent")}</p>
              </div>
            )}
            {routeStats.elevationLoss !== undefined && (
              <div>
                <p className="font-medium text-gray-900">
                  ↓ {routeStats.elevationLoss} m
                </p>
                <p className="text-gray-500">{t("multiDay.descent")}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
