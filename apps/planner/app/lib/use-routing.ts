import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import type { YjsState } from "./use-yjs.ts";
import { electHost } from "./host-election.ts";
import {
  hashNoGoAreas,
  mergeGeoJsonSegments,
  pairKey,
  type NoGoArea,
} from "./route-merge.ts";
import { SegmentCache } from "./segment-cache.ts";

interface RouteStats {
  distance?: number;
  elevationGain?: number;
  elevationLoss?: number;
}

interface WaypointData {
  lat: number;
  lon: number;
}

function getWaypointsFromYjs(waypoints: Y.Array<Y.Map<unknown>>): WaypointData[] {
  return waypoints.toArray().map((yMap) => ({
    lat: yMap.get("lat") as number,
    lon: yMap.get("lon") as number,
  }));
}

function restoreWaypoints(yjs: YjsState, snapshot: WaypointData[], restoringRef: React.RefObject<boolean>) {
  restoringRef.current = true;
  yjs.doc.transact(() => {
    for (let i = 0; i < snapshot.length && i < yjs.waypoints.length; i++) {
      const yMap = yjs.waypoints.get(i);
      const wp = snapshot[i]!;
      if (yMap) {
        yMap.set("lat", wp.lat);
        yMap.set("lon", wp.lon);
      }
    }
    // Remove extra waypoints added since snapshot
    if (yjs.waypoints.length > snapshot.length) {
      yjs.waypoints.delete(snapshot.length, yjs.waypoints.length - snapshot.length);
    }
  });
  // Reset after microtask so Yjs observers fire first
  queueMicrotask(() => { restoringRef.current = false; });
}

export type RouteError = "no_route" | "failed" | "rate_limit" | null;

export function useRouting(yjs: YjsState | null, sessionId: string) {
  const [isHost, setIsHost] = useState(false);
  const [computing, setComputing] = useState(false);
  const [routeError, setRouteError] = useState<RouteError>(null);
  const [routeStats, setRouteStats] = useState<RouteStats>({});
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastGoodWaypointsRef = useRef<WaypointData[] | null>(null);
  const restoringRef = useRef(false);
  // Cancels the in-flight fetch when a newer computeRoute starts. Without
  // this, rapid edits pile up on BRouter's thread pool and older requests
  // get killed by its contention watchdog, surfacing as spurious errors.
  const inflightAbortRef = useRef<AbortController | null>(null);
  // Host-local segment cache. Moving a single waypoint invalidates only
  // the two adjacent pair keys, so we fetch 2 segments from the server
  // instead of N-1 on every recompute.
  const segmentCacheRef = useRef<SegmentCache>(new SegmentCache());

  // Host election via Yjs awareness
  useEffect(() => {
    if (!yjs) return;

    const checkHost = () => {
      const states = yjs.awareness.getStates() as Map<number, Record<string, unknown>>;
      const localId = yjs.awareness.clientID;
      const { isHost: amHost, role } = electHost(states, localId);
      setIsHost(amHost);
      yjs.awareness.setLocalStateField("role", role);
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

      // Collect no-go areas from Yjs
      const noGoAreas: NoGoArea[] = yjs.noGoAreas.toArray().map((yMap) => ({
        points: (yMap.get("points") as Array<{ lat: number; lon: number }>) ?? [],
      })).filter((a) => a.points.length >= 3);

      // Save current waypoints so we can restore on failure
      const snapshotBeforeCompute = getWaypointsFromYjs(yjs.waypoints);

      setComputing(true);
      inflightAbortRef.current?.abort();
      const controller = new AbortController();
      inflightAbortRef.current = controller;

      const profile = (yjs.routeData.get("profile") as string) ?? "fastbike";
      const noGoHash = hashNoGoAreas(noGoAreas);
      const cache = segmentCacheRef.current;

      // Build the ordered pair list. Each pair has a cache key; missing
      // ones get collected for a single round-trip to the server.
      const pairs = waypoints.slice(0, -1).map((from, i) => ({
        from,
        to: waypoints[i + 1]!,
      }));
      const pairKeys = pairs.map((p) => pairKey(p.from, p.to, profile, noGoHash));
      const missingPairs: typeof pairs = [];
      const missingIdx: number[] = [];
      pairKeys.forEach((k, i) => {
        if (!cache.has(k)) {
          missingPairs.push(pairs[i]!);
          missingIdx.push(i);
        }
      });

      try {
        // Only hit the server when we actually need a segment we don't
        // have. A pure drag-refinement that happens to re-land on cached
        // coordinates short-circuits here.
        if (missingPairs.length > 0) {
          const response = await fetch("/api/route-segments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pairs: missingPairs,
              profile,
              noGoAreas: noGoAreas.length > 0 ? noGoAreas : undefined,
              sessionId,
            }),
            signal: controller.signal,
          });

          if (response.status === 429) {
            setRouteError("rate_limit");
            restoreWaypoints(yjs, lastGoodWaypointsRef.current ?? snapshotBeforeCompute, restoringRef);
            return;
          }
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const code = (body as { code?: string }).code;
            setRouteError(code === "no_route" ? "no_route" : "failed");
            restoreWaypoints(yjs, lastGoodWaypointsRef.current ?? snapshotBeforeCompute, restoringRef);
            return;
          }

          const payload = (await response.json()) as {
            segments: Record<string, unknown>[];
          };
          payload.segments.forEach((seg, i) => {
            cache.set(pairKeys[missingIdx[i]!]!, seg);
          });
        }

        // Assemble the merged route from the cache. Guard against being
        // superseded between the fetch completing and the merge — a newer
        // call already owns the in-flight ref and will drive state.
        if (inflightAbortRef.current !== controller) return;

        const orderedSegments = pairKeys.map((k) => cache.get(k)!);
        const enriched = mergeGeoJsonSegments(orderedSegments);

        setRouteError(null);
        lastGoodWaypointsRef.current = snapshotBeforeCompute;
        setRouteStats({
          distance: enriched.totalLength || undefined,
          elevationGain: enriched.totalAscend || undefined,
        });

        // Store enriched route data in Yjs for all participants
        yjs.doc.transact(() => {
          yjs.routeData.set("geojson", JSON.stringify(enriched.geojson));
          yjs.routeData.set("coordinates", JSON.stringify(enriched.coordinates));
          yjs.routeData.set("segmentBoundaries", JSON.stringify(enriched.segmentBoundaries));
          if (enriched.surfaces?.length) {
            yjs.routeData.set("surfaces", JSON.stringify(enriched.surfaces));
          }
          if (enriched.highways?.length) {
            yjs.routeData.set("highways", JSON.stringify(enriched.highways));
          }
          if (enriched.maxspeeds?.length) {
            yjs.routeData.set("maxspeeds", JSON.stringify(enriched.maxspeeds));
          }
          if (enriched.smoothnesses?.length) {
            yjs.routeData.set("smoothnesses", JSON.stringify(enriched.smoothnesses));
          }
          if (enriched.tracktypes?.length) {
            yjs.routeData.set("tracktypes", JSON.stringify(enriched.tracktypes));
          }
          if (enriched.cycleways?.length) {
            yjs.routeData.set("cycleways", JSON.stringify(enriched.cycleways));
          }
          if (enriched.bikeroutes?.length) {
            yjs.routeData.set("bikeroutes", JSON.stringify(enriched.bikeroutes));
          }
        });
      } catch (err) {
        // A superseding request aborted this one — leave state alone so
        // the newer call's result becomes authoritative.
        if ((err as Error)?.name === "AbortError") return;
        setRouteError("failed");
        restoreWaypoints(yjs, lastGoodWaypointsRef.current ?? snapshotBeforeCompute, restoringRef);
      } finally {
        if (inflightAbortRef.current === controller) {
          inflightAbortRef.current = null;
          setComputing(false);
        }
      }
    },
    [yjs, isHost],
  );

  const requestRoute = useCallback(
    (waypoints: WaypointData[]) => {
      if (!isHost || restoringRef.current) return;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => computeRoute(waypoints), 500);
    },
    [isHost, computeRoute],
  );

  // Watch for profile changes and trigger recompute
  useEffect(() => {
    if (!yjs || !isHost) return;

    const triggerRecompute = () => {
      const wps = getWaypointsFromYjs(yjs.waypoints);
      if (wps.length >= 2) {
        requestRoute(wps);
      }
    };

    // Observe routeData for profile changes
    const profileObserver = (event: Y.YMapEvent<unknown>) => {
      if (event.keysChanged.has("profile")) {
        triggerRecompute();
      }
    };

    // Observe noGoAreas for changes
    const noGoObserver = () => {
      triggerRecompute();
    };

    yjs.routeData.observe(profileObserver);
    yjs.noGoAreas.observeDeep(noGoObserver);
    return () => {
      yjs.routeData.unobserve(profileObserver);
      yjs.noGoAreas.unobserveDeep(noGoObserver);
    };
  }, [yjs, isHost, requestRoute]);

  return { isHost, computing, routeError, routeStats, requestRoute };
}
