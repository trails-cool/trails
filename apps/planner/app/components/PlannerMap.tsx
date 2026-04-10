import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, LayersControl, Marker, CircleMarker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import * as Y from "yjs";
import { useTranslation } from "react-i18next";
import type { DayStage } from "@trails-cool/gpx";
import type { YjsState } from "~/lib/use-yjs";
import { baseLayers } from "@trails-cool/map";
import { parseGpxAsync, extractWaypoints } from "@trails-cool/gpx";
import { isOvernight } from "~/lib/overnight";
import { setOvernight } from "~/lib/overnight";
import { NoGoAreaLayer } from "./NoGoAreaLayer";
import { ColoredRoute, findSegmentForPoint, type ColorMode } from "./ColoredRoute";
import { RouteInteraction } from "./RouteInteraction";
import "leaflet/dist/leaflet.css";

function waypointIcon(index: number, overnight?: boolean, highlighted?: boolean): L.DivIcon {
  const bg = overnight ? "#8B6D3A" : "#2563eb";
  const size = highlighted ? 28 : 24;
  const offset = size / 2;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${bg};color:white;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:600;
      border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);
      transform:translate(-${offset}px,-${offset}px);
      transition:all 0.15s ease;
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
          zIndexOffset={-1000}
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

export function PlannerMap({ yjs, onRouteRequest, highlightPosition, highlightedWaypoint, onImportError, days }: PlannerMapProps) {
  const { t } = useTranslation("planner");
  const [waypoints, setWaypoints] = useState<WaypointData[]>([]);
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
    (lat: number, lng: number) => {
      yjs.doc.transact(() => {
        const yMap = new Y.Map();
        yMap.set("lat", lat);
        yMap.set("lon", lng);
        yjs.waypoints.push([yMap]);
      }, "local");
    },
    [yjs.doc, yjs.waypoints],
  );

  const insertWaypointAtSegment = useCallback(
    (segmentIndex: number, lat: number, lon: number) => {
      yjs.doc.transact(() => {
        const yMap = new Y.Map();
        yMap.set("lat", lat);
        yMap.set("lon", lon);
        yjs.waypoints.insert(segmentIndex + 1, [yMap]);
      }, "local");
    },
    [yjs.doc, yjs.waypoints],
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
      const yMap = yjs.waypoints.get(index);
      if (yMap) {
        yjs.doc.transact(() => {
          yMap.set("lat", lat);
          yMap.set("lon", lng);
        }, "local");
      }
    },
    [yjs.waypoints, yjs.doc],
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
        {baseLayers.map((layer, i) => (
          <LayersControl.BaseLayer key={layer.name} checked={i === 0} name={layer.name}>
            <TileLayer url={layer.url} attribution={layer.attribution} maxZoom={layer.maxZoom} />
          </LayersControl.BaseLayer>
        ))}
      </LayersControl>

      <MapExposer />
      <RouteFitter coordinates={routeCoordinates} />
      <MapClickHandler onAdd={noGoDrawing ? () => {} : addWaypoint} suppressRef={suppressMapClickRef} />
      <CursorTracker awareness={yjs.awareness} />
      <NoGoAreaLayer noGoAreas={yjs.noGoAreas} doc={yjs.doc} enabled={noGoDrawing} onToggle={toggleNoGoDraw} />
      <NoGoAreaButton active={noGoDrawing} onClick={toggleNoGoDraw} />

      {waypoints.map((wp, i) => (
        <Marker
          key={i}
          position={[wp.lat, wp.lon]}
          draggable
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
              // Middle waypoints: toggle overnight. First/last: delete.
              if (i > 0 && i < waypoints.length - 1) {
                setOvernight(yjs, i, !wp.overnight);
              } else {
                deleteWaypoint(i);
              }
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
        <CircleMarker
          center={highlightPosition}
          radius={6}
          pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1, weight: 2 }}
        />
      )}
    </MapContainer>
    </div>
  );
}
