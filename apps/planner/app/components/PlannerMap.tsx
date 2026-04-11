import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, LayersControl, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import * as Y from "yjs";
import { useTranslation } from "react-i18next";
import type { DayStage } from "@trails-cool/gpx";
import type { YjsState } from "~/lib/use-yjs";
import { baseLayers, overlayLayers } from "@trails-cool/map";
import { parseGpxAsync, extractWaypoints } from "@trails-cool/gpx";
import { isOvernight } from "~/lib/overnight";
import { setOvernight } from "~/lib/overnight";
import { usePois } from "~/lib/use-pois";
import { useProfileDefaults } from "~/lib/use-profile-defaults";
import { useYjsPoiSync } from "~/lib/use-yjs-poi-sync";
import { snapToPoi } from "~/lib/poi-snap";
import { Z_CURSOR, Z_WAYPOINT, Z_WAYPOINT_HIGHLIGHTED, Z_HIGHLIGHT } from "~/lib/z-index";
import { NoGoAreaLayer } from "./NoGoAreaLayer";
import { ColoredRoute, findSegmentForPoint, type ColorMode } from "./ColoredRoute";
import { RouteInteraction } from "./RouteInteraction";
import { PoiPanel, PoiMarkers } from "./PoiPanel";
import { WaypointContextMenu } from "./WaypointContextMenu";
import "leaflet/dist/leaflet.css";

/** Distance from a point to a line segment in degrees (approximate) */
function pointToSegmentDist(
  pLat: number, pLon: number,
  aLat: number, aLon: number,
  bLat: number, bLon: number,
): number {
  const dx = bLon - aLon;
  const dy = bLat - aLat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((pLon - aLon) ** 2 + (pLat - aLat) ** 2);
  const t = Math.max(0, Math.min(1, ((pLon - aLon) * dx + (pLat - aLat) * dy) / lenSq));
  const projLon = aLon + t * dx;
  const projLat = aLat + t * dy;
  return Math.sqrt((pLon - projLon) ** 2 + (pLat - projLat) ** 2);
}

function waypointIcon(index: number, overnight?: boolean, highlighted?: boolean): L.DivIcon {
  const bg = overnight ? "#8B6D3A" : "#2563eb";
  const scale = highlighted ? "scale(1.17)" : "scale(1)";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:24px;height:24px;border-radius:50%;
      background:${bg};color:white;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:600;
      border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);
      transform:translate(-12px,-12px) ${scale};
      transition:transform 0.2s ease;
    ">${overnight ? "☾" : index + 1}</div>`,
    iconSize: [0, 0],
  });
}

function dayLabelIcon(dayNumber: number, distanceKm: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="position:absolute;left:50%;transform:translate(-50%,-40px);">
      <div style="
        background:white;color:#1f2937;
        padding:1px 6px;border-radius:8px;
        font-size:10px;font-weight:600;white-space:nowrap;
        box-shadow:0 1px 3px rgba(0,0,0,0.15);
      ">Day ${dayNumber} · ${distanceKm} km</div>
    </div>`,
    iconSize: [0, 0],
  });
}

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

interface PlannerMapProps {
  yjs: YjsState;
  onRouteRequest?: (waypoints: WaypointData[]) => void;
  onImportError?: (message: string) => void;
  highlightPosition?: [number, number] | null;
  highlightedWaypoint?: number | null;
  days?: DayStage[];
}

function MapExposer() {
  const map = useMap();
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__leafletMap = map;
    }
  }, [map]);
  return null;
}

function RouteFitter({ coordinates }: { coordinates: [number, number, number][] | null }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (hasFitted.current || !coordinates || coordinates.length < 2) return;

    // Coordinates are in [lon, lat, elevation] GeoJSON format
    const bounds = L.latLngBounds(
      coordinates.map((c) => [c[1]!, c[0]!] as [number, number]),
    );

    if (!bounds.isValid()) return;

    // Delay fitBounds so the layout has settled (elevation chart may resize the map)
    const raf = requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      hasFitted.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, [coordinates, map]);

  return null;
}

function MapClickHandler({ onAdd, suppressRef }: { onAdd: (lat: number, lng: number) => void; suppressRef: React.RefObject<boolean> }) {
  useMapEvents({
    click(e) {
      if (suppressRef.current) {
        suppressRef.current = false;
        return;
      }
      onAdd(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function CursorTracker({ awareness }: { awareness: YjsState["awareness"] }) {
  const map = useMap();
  const [cursors, setCursors] = useState<Map<number, { lat: number; lng: number; color: string; name: string }>>(new Map());

  useEffect(() => {
    const localId = awareness.clientID;

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      awareness.setLocalStateField("cursor", {
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    };

    const handleMouseOut = () => {
      awareness.setLocalStateField("cursor", null);
    };

    map.on("mousemove", handleMouseMove);
    map.on("mouseout", handleMouseOut);

    const updateCursors = () => {
      const states = awareness.getStates();
      const newCursors = new Map<number, { lat: number; lng: number; color: string; name: string }>();
      states.forEach((state, clientId) => {
        if (clientId !== localId && state.cursor && state.user) {
          newCursors.set(clientId, {
            lat: state.cursor.lat,
            lng: state.cursor.lng,
            color: state.user.color,
            name: state.user.name,
          });
        }
      });
      setCursors(newCursors);
    };

    awareness.on("change", updateCursors);

    return () => {
      map.off("mousemove", handleMouseMove);
      map.off("mouseout", handleMouseOut);
      awareness.off("change", updateCursors);
    };
  }, [map, awareness]);

  return (
    <>
      {Array.from(cursors.entries()).map(([clientId, cursor]) => (
        <Marker
          key={clientId}
          position={[cursor.lat, cursor.lng]}
          zIndexOffset={Z_CURSOR}
          icon={L.divIcon({
            className: "",
            html: `<div style="position:relative;z-index:400;pointer-events:none">
              <svg width="16" height="20" viewBox="0 0 16 20" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))">
                <path d="M0 0L16 12L8 12L4 20Z" fill="${cursor.color}" />
              </svg>
              <span style="
                position:absolute;left:16px;top:2px;
                background:${cursor.color};color:white;
                padding:1px 6px;border-radius:6px;
                font-size:11px;font-weight:500;white-space:nowrap;
                box-shadow:0 1px 3px rgba(0,0,0,0.2);
                line-height:1.4;
              ">${cursor.name}</span>
            </div>`,
            iconSize: [0, 0],
          })}
        />
      ))}
    </>
  );
}

function NoGoAreaButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // Prevent clicks from reaching the Leaflet map (same as built-in controls)
  useEffect(() => {
    if (ref.current) L.DomEvent.disableClickPropagation(ref.current);
  }, []);

  return (
    <div ref={ref} className="leaflet-top leaflet-left" style={{ marginTop: 80 }}>
      <div className="leaflet-control leaflet-bar">
        <a
          href="#"
          role="button"
          title={active ? "Cancel no-go area" : "Draw no-go area"}
          onClick={(e) => { e.preventDefault(); onClick(); }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            fontSize: 16,
            background: active ? "#fecaca" : "white",
            color: active ? "#dc2626" : "#333",
          }}
        >
          ⊘
        </a>
      </div>
    </div>
  );
}

function OverlaySync({ yjs, onOverlayChange, onBaseLayerChange }: { yjs: YjsState; onOverlayChange: (ids: string[]) => void; onBaseLayerChange: (name: string) => void }) {
  const map = useMap();
  const suppressRef = useRef(false);

  // Map events → Yjs
  useEffect(() => {
    const handleAdd = (e: L.LayersControlEvent) => {
      if (suppressRef.current) return;
      const name = e.name;
      const layer = overlayLayers.find((l) => l.name === name);
      if (!layer) return;
      const raw = yjs.routeData.get("overlays") as string | undefined;
      const current: string[] = raw ? JSON.parse(raw) : [];
      if (!current.includes(layer.id)) {
        const updated = [...current, layer.id];
        yjs.routeData.set("overlays", JSON.stringify(updated));
        onOverlayChange(updated);
      }
    };

    const handleRemove = (e: L.LayersControlEvent) => {
      if (suppressRef.current) return;
      const name = e.name;
      const layer = overlayLayers.find((l) => l.name === name);
      if (!layer) return;
      const raw = yjs.routeData.get("overlays") as string | undefined;
      const current: string[] = raw ? JSON.parse(raw) : [];
      const updated = current.filter((id) => id !== layer.id);
      yjs.routeData.set("overlays", JSON.stringify(updated));
      onOverlayChange(updated);
    };

    // Base layer change → Yjs
    const handleBaseChange = (e: L.LayersControlEvent) => {
      if (suppressRef.current) return;
      yjs.routeData.set("baseLayer", e.name);
    };

    map.on("overlayadd", handleAdd as L.LeafletEventHandlerFn);
    map.on("overlayremove", handleRemove as L.LeafletEventHandlerFn);
    map.on("baselayerchange", handleBaseChange as L.LeafletEventHandlerFn);
    return () => {
      map.off("overlayadd", handleAdd as L.LeafletEventHandlerFn);
      map.off("overlayremove", handleRemove as L.LeafletEventHandlerFn);
      map.off("baselayerchange", handleBaseChange as L.LeafletEventHandlerFn);
    };
  }, [map, yjs, onOverlayChange]);

  // Yjs → Map: load initial state from Yjs
  useEffect(() => {
    const handleChange = () => {
      const raw = yjs.routeData.get("overlays") as string | undefined;
      if (raw) {
        try {
          onOverlayChange(JSON.parse(raw));
        } catch { /* ignore */ }
      }
      const base = yjs.routeData.get("baseLayer") as string | undefined;
      if (base) onBaseLayerChange(base);
    };
    yjs.routeData.observe(handleChange);
    handleChange();
    return () => yjs.routeData.unobserve(handleChange);
  }, [yjs, onOverlayChange, onBaseLayerChange]);

  return null;
}

function PoiRefresher({ poiState }: { poiState: ReturnType<typeof usePois> }) {
  const map = useMap();
  const refreshRef = useRef(poiState.refresh);
  refreshRef.current = poiState.refresh;

  useEffect(() => {
    const refresh = () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      refreshRef.current({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      }, zoom);
    };
    map.on("moveend", refresh);
    // Don't call refresh() immediately — let moveend trigger it
    return () => { map.off("moveend", refresh); };
  }, [map]);

  // Trigger refresh when categories change (but not on mount)
  const prevCategories = useRef(poiState.enabledCategories);
  useEffect(() => {
    if (prevCategories.current === poiState.enabledCategories) return;
    prevCategories.current = poiState.enabledCategories;
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    poiState.refresh({
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    }, zoom);
  }, [map, poiState.enabledCategories, poiState.refresh]);

  return null;
}

export function PlannerMap({ yjs, onRouteRequest, highlightPosition, highlightedWaypoint, onImportError, days }: PlannerMapProps) {
  const { t } = useTranslation("planner");
  const [waypoints, setWaypoints] = useState<WaypointData[]>([]);
  const poiState = usePois();
  useProfileDefaults(yjs, poiState);
  useYjsPoiSync(yjs, poiState);
  const [enabledOverlays, setEnabledOverlays] = useState<string[]>([]);
  const [selectedBaseLayer, setSelectedBaseLayer] = useState<string>(baseLayers[0]!.name);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number, number][] | null>(null);
  const [segmentBoundaries, setSegmentBoundaries] = useState<number[]>([]);
  const [surfaces, setSurfaces] = useState<string[]>([]);
  const [colorMode, setColorMode] = useState<ColorMode>("plain");
  const [noGoDrawing, setNoGoDrawing] = useState(false);
  const toggleNoGoDraw = useCallback(() => setNoGoDrawing((v) => !v), []);
  const suppressMapClickRef = useRef(false);
  const routeInteractionSuspendedRef = useRef(false);
  const waypointDraggingRef = useRef(false);

  // Sync waypoints from Yjs
  useEffect(() => {
    const update = () => {
      const wps = getWaypointsFromYjs(yjs.waypoints);
      setWaypoints(wps);
      if (wps.length >= 2 && onRouteRequest) {
        onRouteRequest(wps);
      }
    };

    yjs.waypoints.observeDeep(update);
    update();

    return () => {
      yjs.waypoints.unobserveDeep(update);
    };
  }, [yjs.waypoints, onRouteRequest]);

  // Sync route data from Yjs (enriched: coordinates + segment boundaries)
  useEffect(() => {
    const update = () => {
      const coordsJson = yjs.routeData.get("coordinates") as string | undefined;
      const boundsJson = yjs.routeData.get("segmentBoundaries") as string | undefined;
      const modeVal = yjs.routeData.get("colorMode") as ColorMode | undefined;

      if (coordsJson) {
        try {
          setRouteCoordinates(JSON.parse(coordsJson));
        } catch {
          setRouteCoordinates(null);
        }
      } else {
        // Fallback: parse from geojson for backwards compat
        const geojson = yjs.routeData.get("geojson") as string | undefined;
        if (geojson) {
          try {
            const parsed = JSON.parse(geojson);
            const coords = parsed.features?.[0]?.geometry?.coordinates;
            if (coords) {
              setRouteCoordinates(coords.map((c: number[]) => [c[0]!, c[1]!, c[2] ?? 0] as [number, number, number]));
            }
          } catch { setRouteCoordinates(null); }
        } else {
          setRouteCoordinates(null);
        }
      }

      if (boundsJson) {
        try { setSegmentBoundaries(JSON.parse(boundsJson)); } catch { setSegmentBoundaries([]); }
      } else {
        setSegmentBoundaries([]);
      }

      const surfacesJson = yjs.routeData.get("surfaces") as string | undefined;
      if (surfacesJson) {
        try { setSurfaces(JSON.parse(surfacesJson)); } catch { setSurfaces([]); }
      } else {
        setSurfaces([]);
      }

      if (modeVal) setColorMode(modeVal);
    };

    yjs.routeData.observe(update);
    update();

    return () => {
      yjs.routeData.unobserve(update);
    };
  }, [yjs.routeData]);

  const addWaypoint = useCallback(
    (lat: number, lng: number, name?: string) => {
      const snap = snapToPoi(lat, lng, poiState.pois);
      const finalLat = snap.lat;
      const finalLon = snap.snapped ? snap.lon : lng;

      // Find the best insertion index: if the point is near the route,
      // insert between the closest segment's waypoints instead of appending
      let insertIndex = yjs.waypoints.length; // default: append
      if (routeCoordinates && routeCoordinates.length >= 2 && segmentBoundaries.length > 0) {
        let bestDist = Infinity;
        let bestSegment = -1;
        // For each segment, find the closest point on the route
        for (let seg = 0; seg < segmentBoundaries.length; seg++) {
          const start = segmentBoundaries[seg]!;
          const end = seg + 1 < segmentBoundaries.length ? segmentBoundaries[seg + 1]! : routeCoordinates.length;
          for (let i = start; i < end - 1; i++) {
            const c1 = routeCoordinates[i]!;
            const c2 = routeCoordinates[i + 1]!;
            const dist = pointToSegmentDist(finalLat, finalLon, c1[1]!, c1[0]!, c2[1]!, c2[0]!);
            if (dist < bestDist) {
              bestDist = dist;
              bestSegment = seg;
            }
          }
        }
        // If within ~1km of the route, insert after the segment's waypoint
        if (bestDist < 0.01 && bestSegment >= 0) {
          insertIndex = bestSegment + 1;
        }
      }

      yjs.doc.transact(() => {
        const yMap = new Y.Map();
        yMap.set("lat", finalLat);
        yMap.set("lon", finalLon);
        if (snap.name) yMap.set("name", snap.name);
        else if (name) yMap.set("name", name);
        if (snap.osmId) yMap.set("osmId", snap.osmId);
        if (snap.poiTags) yMap.set("poiTags", snap.poiTags);
        yjs.waypoints.insert(insertIndex, [yMap]);
      }, "local");
    },
    [yjs.doc, yjs.waypoints, poiState.pois, routeCoordinates, segmentBoundaries],
  );

  const insertWaypointAtSegment = useCallback(
    (segmentIndex: number, lat: number, lon: number) => {
      const snap = snapToPoi(lat, lon, poiState.pois);
      yjs.doc.transact(() => {
        const yMap = new Y.Map();
        yMap.set("lat", snap.lat);
        yMap.set("lon", snap.snapped ? snap.lon : lon);
        if (snap.name) yMap.set("name", snap.name);
        if (snap.osmId) yMap.set("osmId", snap.osmId);
        if (snap.poiTags) yMap.set("poiTags", snap.poiTags);
        yjs.waypoints.insert(segmentIndex + 1, [yMap]);
      }, "local");
    },
    [yjs.doc, yjs.waypoints, poiState.pois],
  );

  const handleRouteInsert = useCallback(
    (pointIndex: number, lat: number, lon: number) => {
      suppressMapClickRef.current = true;
      const segIdx = findSegmentForPoint(pointIndex, segmentBoundaries);
      insertWaypointAtSegment(segIdx, lat, lon);
    },
    [segmentBoundaries, insertWaypointAtSegment],
  );

  const moveWaypoint = useCallback(
    (index: number, lat: number, lng: number) => {
      const snap = snapToPoi(lat, lng, poiState.pois);
      const yMap = yjs.waypoints.get(index);
      if (yMap) {
        yjs.doc.transact(() => {
          yMap.set("lat", snap.lat);
          yMap.set("lon", snap.snapped ? snap.lon : lng);
          if (snap.snapped && snap.name) {
            yMap.set("name", snap.name);
          } else {
            yMap.delete("name");
          }
          if (snap.osmId) {
            yMap.set("osmId", snap.osmId);
            if (snap.poiTags) yMap.set("poiTags", snap.poiTags);
          } else {
            yMap.delete("osmId");
            yMap.delete("poiTags");
          }
        }, "local");
      }
    },
    [yjs.waypoints, yjs.doc, poiState.pois],
  );

  const deleteWaypoint = useCallback(
    (index: number) => {
      yjs.doc.transact(() => {
        yjs.waypoints.delete(index, 1);
      }, "local");
    },
    [yjs.waypoints],
  );

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
        // Replace waypoints
        yjs.waypoints.delete(0, yjs.waypoints.length);
        for (const wp of newWaypoints) {
          const yMap = new Y.Map();
          yMap.set("lat", wp.lat);
          yMap.set("lon", wp.lon);
          if (wp.name) yMap.set("name", wp.name);
          if (wp.isDayBreak) yMap.set("overnight", true);
          yjs.waypoints.push([yMap]);
        }

        // Replace no-go areas
        yjs.noGoAreas.delete(0, yjs.noGoAreas.length);
        for (const area of gpxData.noGoAreas) {
          const yMap = new Y.Map();
          yMap.set("points", area.points);
          yjs.noGoAreas.push([yMap]);
        }
      }, "local");
    } catch {
      onImportError?.(t("importGpxError"));
    }
  }, [yjs, t, onImportError]);

  return (
    <div
      className="relative h-full w-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {draggingOver && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-blue-500/20 backdrop-blur-sm">
          <div className="rounded-xl bg-white px-8 py-6 text-lg font-medium text-blue-600 shadow-lg">
            {t("dropGpxHere")}
          </div>
        </div>
      )}
    <MapContainer center={[50.1, 10.0]} zoom={6} className="h-full w-full">
      <LayersControl position="topright">
        {baseLayers.map((layer) => (
          <LayersControl.BaseLayer key={layer.name} checked={layer.name === selectedBaseLayer} name={layer.name}>
            <TileLayer url={layer.url} attribution={layer.attribution} maxZoom={layer.maxZoom} />
          </LayersControl.BaseLayer>
        ))}
        {overlayLayers.map((layer) => (
          <LayersControl.Overlay key={layer.id} checked={enabledOverlays.includes(layer.id)} name={layer.name}>
            <TileLayer url={layer.url} attribution={layer.attribution} maxZoom={layer.maxZoom} opacity={layer.opacity ?? 0.7} />
          </LayersControl.Overlay>
        ))}
      </LayersControl>

      <MapExposer />
      <OverlaySync yjs={yjs} onOverlayChange={setEnabledOverlays} onBaseLayerChange={setSelectedBaseLayer} />
      <RouteFitter coordinates={routeCoordinates} />
      <MapClickHandler onAdd={noGoDrawing ? () => {} : addWaypoint} suppressRef={suppressMapClickRef} />
      <CursorTracker awareness={yjs.awareness} />
      <NoGoAreaLayer noGoAreas={yjs.noGoAreas} doc={yjs.doc} enabled={noGoDrawing} onToggle={toggleNoGoDraw} />
      <NoGoAreaButton active={noGoDrawing} onClick={toggleNoGoDraw} />
      <PoiRefresher poiState={poiState} />
      <PoiMarkers poiState={poiState} onAddWaypoint={addWaypoint} />
      <PoiPanel poiState={poiState} />

      {waypoints.map((wp, i) => (
        <Marker
          key={i}
          position={[wp.lat, wp.lon]}
          draggable
          zIndexOffset={highlightedWaypoint === i ? Z_WAYPOINT_HIGHLIGHTED : Z_WAYPOINT}
          icon={waypointIcon(i, wp.overnight, highlightedWaypoint === i)}
          eventHandlers={{
            mouseover: () => {
              routeInteractionSuspendedRef.current = true;
            },
            mouseout: () => {
              if (!waypointDraggingRef.current) {
                routeInteractionSuspendedRef.current = false;
              }
            },
            dragstart: () => {
              waypointDraggingRef.current = true;
              yjs.undoManager.stopCapturing();
              routeInteractionSuspendedRef.current = true;
            },
            dragend: (e) => {
              waypointDraggingRef.current = false;
              routeInteractionSuspendedRef.current = false;
              const { lat, lng } = e.target.getLatLng();
              moveWaypoint(i, lat, lng);
            },
            contextmenu: (e) => {
              L.DomEvent.preventDefault(e as unknown as Event);
              const orig = e.originalEvent as MouseEvent;
              setContextMenu({ x: orig.clientX, y: orig.clientY, index: i });
            },
          }}
        />
      ))}

      {/* Day boundary labels on map */}
      {days && days.length > 1 && days.map((day) => {
        const wp = waypoints[day.endWaypointIndex];
        if (!wp || day.dayNumber === days.length) return null;
        return (
          <Marker
            key={`day-${day.dayNumber}`}
            position={[wp.lat, wp.lon]}
            icon={dayLabelIcon(day.dayNumber, (day.distance / 1000).toFixed(1))}
            interactive={false}
          />
        );
      })}

      {routeCoordinates && routeCoordinates.length >= 2 && (
        <>
          <ColoredRoute
            coordinates={routeCoordinates}
            colorMode={colorMode}
            surfaces={surfaces}
          />
          <RouteInteraction
            coordinates={routeCoordinates}
            segmentBoundaries={segmentBoundaries}
            onInsertWaypoint={handleRouteInsert}
            suspendedRef={routeInteractionSuspendedRef}
            disabled={noGoDrawing}
          />
        </>
      )}

      {highlightPosition && (
        <Marker
          position={highlightPosition}
          zIndexOffset={Z_HIGHLIGHT}
          interactive={false}
          icon={L.divIcon({
            className: "",
            html: '<div style="width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);transform:translate(-6px,-6px)"></div>',
            iconSize: [0, 0],
          })}
        />
      )}
    </MapContainer>
      {contextMenu && (
        <WaypointContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          isFirst={contextMenu.index === 0}
          isLast={contextMenu.index === waypoints.length - 1}
          isOvernight={waypoints[contextMenu.index]?.overnight ?? false}
          onDelete={() => deleteWaypoint(contextMenu.index)}
          onToggleOvernight={() => setOvernight(yjs, contextMenu.index, !waypoints[contextMenu.index]?.overnight)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
