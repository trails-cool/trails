import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, LayersControl, Marker, CircleMarker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import * as Y from "yjs";
import type { YjsState } from "~/lib/use-yjs";
import { baseLayers } from "@trails-cool/map";
import { NoGoAreaLayer } from "./NoGoAreaLayer";
import { ColoredRoute, findSegmentForPoint, type ColorMode } from "./ColoredRoute";
import { RouteInteraction } from "./RouteInteraction";
import "leaflet/dist/leaflet.css";

function waypointIcon(index: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:24px;height:24px;border-radius:50%;
      background:#2563eb;color:white;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:600;
      border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);
      transform:translate(-12px,-12px);
    ">${index + 1}</div>`,
    iconSize: [0, 0],
  });
}

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

interface PlannerMapProps {
  yjs: YjsState;
  onRouteRequest?: (waypoints: WaypointData[]) => void;
  highlightPosition?: [number, number] | null;
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
      coordinates.filter((c) => c.length >= 2).map((c) => [c[1]!, c[0]!] as [number, number]),
    );

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      hasFitted.current = true;
    }
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
  return (
    <div className="leaflet-top leaflet-left" style={{ marginTop: 80 }}>
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

export function PlannerMap({ yjs, onRouteRequest, highlightPosition }: PlannerMapProps) {
  const [waypoints, setWaypoints] = useState<WaypointData[]>([]);
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
      const yMap = new Y.Map();
      yMap.set("lat", lat);
      yMap.set("lon", lng);
      yjs.waypoints.push([yMap]);
    },
    [yjs.waypoints],
  );

  const insertWaypointAtSegment = useCallback(
    (segmentIndex: number, lat: number, lon: number) => {
      const yMap = new Y.Map();
      yMap.set("lat", lat);
      yMap.set("lon", lon);
      // Insert after the segment's start waypoint
      yjs.waypoints.insert(segmentIndex + 1, [yMap]);
    },
    [yjs.waypoints],
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
        });
      }
    },
    [yjs.waypoints, yjs.doc],
  );

  const deleteWaypoint = useCallback(
    (index: number) => {
      yjs.waypoints.delete(index, 1);
    },
    [yjs.waypoints],
  );

  return (
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
          icon={waypointIcon(i)}
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
              deleteWaypoint(i);
            },
          }}
        />
      ))}

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
  );
}
