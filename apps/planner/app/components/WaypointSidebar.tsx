import { useEffect, useState, useCallback } from "react";
import * as Y from "yjs";
import type { YjsState } from "~/lib/use-yjs";

interface WaypointData {
  lat: number;
  lon: number;
  name?: string;
}

function getWaypointsFromYjs(waypoints: Y.Array<Y.Map<unknown>>): WaypointData[] {
  return waypoints.toArray().map((yMap) => ({
    lat: yMap.get("lat") as number,
    lon: yMap.get("lon") as number,
    name: yMap.get("name") as string | undefined,
  }));
}

interface WaypointSidebarProps {
  yjs: YjsState;
  routeStats?: {
    distance?: number;
    elevationGain?: number;
    elevationLoss?: number;
  };
}

export function WaypointSidebar({ yjs, routeStats }: WaypointSidebarProps) {
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
      const data = { lat: item.get("lat") as number, lon: item.get("lon") as number, name: item.get("name") as string | undefined };
      yjs.doc.transact(() => {
        yjs.waypoints.delete(from, 1);
        const yMap = new Y.Map();
        yMap.set("lat", data.lat);
        yMap.set("lon", data.lon);
        if (data.name) yMap.set("name", data.name);
        yjs.waypoints.insert(to, [yMap]);
      }, "local");
    },
    [yjs.waypoints, yjs.doc],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-medium text-gray-900">
          Waypoints ({waypoints.length})
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {waypoints.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            Click on the map to add waypoints
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {waypoints.map((wp, i) => (
              <li key={i} className="group flex items-center gap-2 px-4 py-2 hover:bg-gray-50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-700">
                    {wp.name ?? `${wp.lat.toFixed(4)}, ${wp.lon.toFixed(4)}`}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
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
            ))}
          </ul>
        )}
      </div>

      {routeStats && routeStats.distance !== undefined && (
        <div className="border-t border-gray-200 px-4 py-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="font-medium text-gray-900">
                {(routeStats.distance / 1000).toFixed(1)} km
              </p>
              <p className="text-gray-500">Distance</p>
            </div>
            {routeStats.elevationGain !== undefined && (
              <div>
                <p className="font-medium text-gray-900">
                  ↑ {routeStats.elevationGain} m
                </p>
                <p className="text-gray-500">Ascent</p>
              </div>
            )}
            {routeStats.elevationLoss !== undefined && (
              <div>
                <p className="font-medium text-gray-900">
                  ↓ {routeStats.elevationLoss} m
                </p>
                <p className="text-gray-500">Descent</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
