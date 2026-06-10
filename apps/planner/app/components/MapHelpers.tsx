import { useEffect, useState, useRef } from "react";
import { useMap, useMapEvents, Marker } from "react-leaflet";
import L from "leaflet";
import type { YjsState } from "~/lib/use-yjs";
import { overlayLayers } from "@trails-cool/map-core";
import { usePois } from "~/lib/use-pois";
import { Z_CURSOR } from "@trails-cool/map-core";
import { getBaseLayer, getOverlays, setBaseLayer, setOverlays } from "~/lib/route-data";

// Exposes the Leaflet map instance on window.__leafletMap for E2E testing and external integrations.
export function MapExposer() {
  const map = useMap();
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__leafletMap = map;
    }
  }, [map]);
  return null;
}

// Fits the map to the route bounds once on first load.
export function RouteFitter({ coordinates }: { coordinates: [number, number, number][] | null }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (hasFitted.current || !coordinates || coordinates.length < 2) return;

    const bounds = L.latLngBounds(
      coordinates.map((c) => [c[1]!, c[0]!] as [number, number]),
    );
    if (!bounds.isValid()) return;

    const raf = requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      hasFitted.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, [coordinates, map]);

  return null;
}

// Routes map click events to a callback, with a suppressRef for one-shot suppression (e.g. after route insert).
export function MapClickHandler({
  onAdd,
  suppressRef,
}: {
  onAdd: (lat: number, lng: number) => void;
  suppressRef: React.RefObject<boolean>;
}) {
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

// Broadcasts the local user's cursor position via Yjs awareness and renders remote cursors.
export function CursorTracker({ awareness }: { awareness: YjsState["awareness"] }) {
  const map = useMap();
  const [cursors, setCursors] = useState<
    Map<number, { lat: number; lng: number; color: string; name: string }>
  >(new Map());

  useEffect(() => {
    const localId = awareness.clientID;

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      awareness.setLocalStateField("mapCursor", { lat: e.latlng.lat, lng: e.latlng.lng });
    };
    const handleMouseOut = () => {
      awareness.setLocalStateField("mapCursor", null);
    };

    map.on("mousemove", handleMouseMove);
    map.on("mouseout", handleMouseOut);

    const updateCursors = () => {
      const states = awareness.getStates();
      const newCursors = new Map<number, { lat: number; lng: number; color: string; name: string }>();
      states.forEach((state, clientId) => {
        if (clientId !== localId && state.mapCursor && state.user) {
          newCursors.set(clientId, {
            lat: state.mapCursor.lat,
            lng: state.mapCursor.lng,
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

// Leaflet control button for toggling no-go area drawing mode.
export function NoGoAreaButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

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

// Keeps Yjs routeData and the Leaflet LayersControl in sync (both directions).
export function OverlaySync({
  yjs,
  onOverlayChange,
  onBaseLayerChange,
}: {
  yjs: YjsState;
  onOverlayChange: (ids: string[]) => void;
  onBaseLayerChange: (name: string) => void;
}) {
  const map = useMap();
  const suppressRef = useRef(false);

  useEffect(() => {
    const handleAdd = (e: L.LayersControlEvent) => {
      if (suppressRef.current) return;
      const layer = overlayLayers.find((l) => l.name === e.name);
      if (!layer) return;
      const current = getOverlays(yjs.routeData) ?? [];
      if (!current.includes(layer.id)) {
        const updated = [...current, layer.id];
        setOverlays(yjs.routeData, updated);
        onOverlayChange(updated);
      }
    };

    const handleRemove = (e: L.LayersControlEvent) => {
      if (suppressRef.current) return;
      const layer = overlayLayers.find((l) => l.name === e.name);
      if (!layer) return;
      const updated = (getOverlays(yjs.routeData) ?? []).filter((id) => id !== layer.id);
      setOverlays(yjs.routeData, updated);
      onOverlayChange(updated);
    };

    const handleBaseChange = (e: L.LayersControlEvent) => {
      if (suppressRef.current) return;
      setBaseLayer(yjs.routeData, e.name);
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

  useEffect(() => {
    const handleChange = () => {
      const overlays = getOverlays(yjs.routeData);
      if (overlays) onOverlayChange(overlays);
      const base = getBaseLayer(yjs.routeData);
      if (base) onBaseLayerChange(base);
    };
    yjs.routeData.observe(handleChange);
    handleChange();
    return () => yjs.routeData.unobserve(handleChange);
  }, [yjs, onOverlayChange, onBaseLayerChange]);

  return null;
}

// Triggers POI refreshes on map move and category changes.
export function PoiRefresher({ poiState }: { poiState: ReturnType<typeof usePois> }) {
  const map = useMap();
  const refreshRef = useRef(poiState.refresh);
  refreshRef.current = poiState.refresh;

  useEffect(() => {
    const refresh = () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      refreshRef.current(
        { south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() },
        zoom,
      );
    };
    map.on("moveend", refresh);
    return () => { map.off("moveend", refresh); };
  }, [map]);

  const prevCategories = useRef(poiState.enabledCategories);
  useEffect(() => {
    if (prevCategories.current === poiState.enabledCategories) return;
    prevCategories.current = poiState.enabledCategories;
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    poiState.refresh(
      { south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() },
      zoom,
    );
  }, [map, poiState.enabledCategories, poiState.refresh]);

  return null;
}
