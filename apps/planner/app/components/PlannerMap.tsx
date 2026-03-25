import { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, LayersControl, Marker, Polyline, CircleMarker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import * as Y from "yjs";
import type { YjsState } from "~/lib/use-yjs";
import { baseLayers } from "@trails-cool/map";
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

function MapClickHandler({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
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

export function PlannerMap({ yjs, onRouteRequest, highlightPosition }: PlannerMapProps) {
  const [waypoints, setWaypoints] = useState<WaypointData[]>([]);
  const [routeGeoJson, setRouteGeoJson] = useState<L.LatLngExpression[] | null>(null);

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

  // Sync route data from Yjs
  useEffect(() => {
    const update = () => {
      const geojson = yjs.routeData.get("geojson") as string | undefined;
      if (geojson) {
        try {
          const parsed = JSON.parse(geojson);
          const coords = parsed.features?.[0]?.geometry?.coordinates;
          if (coords) {
            setRouteGeoJson(coords.map((c: number[]) => [c[1], c[0]] as L.LatLngExpression));
          }
        } catch {
          // Invalid GeoJSON
        }
      } else {
        setRouteGeoJson(null);
      }
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

      <MapClickHandler onAdd={addWaypoint} />
      <CursorTracker awareness={yjs.awareness} />

      {waypoints.map((wp, i) => (
        <Marker
          key={i}
          position={[wp.lat, wp.lon]}
          draggable
          icon={waypointIcon(i)}
          eventHandlers={{
            dragend: (e) => {
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

      {routeGeoJson && <Polyline positions={routeGeoJson} color="#2563eb" weight={4} opacity={0.8} />}

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
