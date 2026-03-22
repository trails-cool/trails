import { useCallback, useEffect, useRef, useState } from "react";
import type { YjsState } from "./use-yjs";

interface RouteStats {
  distance?: number;
  elevationGain?: number;
  elevationLoss?: number;
}

interface WaypointData {
  lat: number;
  lon: number;
}

export function useRouting(yjs: YjsState | null) {
  const [isHost, setIsHost] = useState(false);
  const [computing, setComputing] = useState(false);
  const [routeStats, setRouteStats] = useState<RouteStats>({});
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Host election via Yjs awareness
  useEffect(() => {
    if (!yjs) return;

    const checkHost = () => {
      const states = yjs.awareness.getStates();
      const localId = yjs.awareness.clientID;

      // Find the client with the lowest ID (longest connected approximation)
      let lowestId = Infinity;
      states.forEach((_state, clientId) => {
        if (clientId < lowestId) lowestId = clientId;
      });

      const amHost = localId === lowestId;
      setIsHost(amHost);
      yjs.awareness.setLocalStateField("role", amHost ? "host" : "participant");
    };

    yjs.awareness.on("change", checkHost);
    checkHost();

    return () => {
      yjs.awareness.off("change", checkHost);
    };
  }, [yjs]);

  const computeRoute = useCallback(
    async (waypoints: WaypointData[]) => {
      if (!yjs || !isHost || waypoints.length < 2) return;

      setComputing(true);
      try {
        const response = await fetch("/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            waypoints,
            profile: (yjs.routeData.get("profile") as string) ?? "trekking",
          }),
        });

        if (!response.ok) return;

        const geojson = await response.json();

        // Extract stats from BRouter response
        const props = geojson.features?.[0]?.properties;
        if (props) {
          setRouteStats({
            distance: props["track-length"] ? parseInt(props["track-length"]) : undefined,
            elevationGain: props["filtered ascend"] ? parseInt(props["filtered ascend"]) : undefined,
            elevationLoss: props["plain-ascend"]
              ? Math.abs(parseInt(props["plain-ascend"]))
              : undefined,
          });
        }

        // Store route in Yjs for all participants
        yjs.routeData.set("geojson", JSON.stringify(geojson));
      } catch {
        // Route computation failed — don't crash
      } finally {
        setComputing(false);
      }
    },
    [yjs, isHost],
  );

  const requestRoute = useCallback(
    (waypoints: WaypointData[]) => {
      if (!isHost) return;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => computeRoute(waypoints), 500);
    },
    [isHost, computeRoute],
  );

  return { isHost, computing, routeStats, requestRoute };
}
