import { useEffect, useRef, useCallback } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import * as Y from "yjs";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

interface NoGoAreaLayerProps {
  noGoAreas: Y.Array<Y.Map<unknown>>;
  doc: Y.Doc;
  enabled: boolean;
  onToggle: () => void;
}

const NO_GO_STYLE: L.PathOptions = {
  color: "#ef4444",
  fillColor: "#ef4444",
  fillOpacity: 0.2,
  weight: 2,
};

function yMapToLatLngs(yMap: Y.Map<unknown>): L.LatLng[] {
  const points = yMap.get("points") as Array<{ lat: number; lon: number }> | undefined;
  if (!points) return [];
  return points.map((p) => L.latLng(p.lat, p.lon));
}

export function NoGoAreaLayer({ noGoAreas, doc, enabled, onToggle }: NoGoAreaLayerProps) {
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup>(L.layerGroup());
  const polygonMapRef = useRef<Map<number, L.Polygon>>(new Map());
  const suppressObserverRef = useRef(false);

  // Sync Yjs → Leaflet layers
  const syncLayers = useCallback(() => {
    const lg = layerGroupRef.current;
    // Clear all existing polygons
    lg.clearLayers();
    polygonMapRef.current.clear();

    for (let i = 0; i < noGoAreas.length; i++) {
      const yMap = noGoAreas.get(i);
      const latLngs = yMapToLatLngs(yMap);
      if (latLngs.length < 3) continue;

      const polygon = L.polygon(latLngs, NO_GO_STYLE);
      polygon.on("contextmenu", (e) => {
        L.DomEvent.preventDefault(e as unknown as Event);
        suppressObserverRef.current = true;
        doc.transact(() => noGoAreas.delete(i, 1), "local");
        suppressObserverRef.current = false;
        syncLayers();
      });
      lg.addLayer(polygon);
      polygonMapRef.current.set(i, polygon);
    }
  }, [noGoAreas]);

  // Add/remove layer group from map
  useEffect(() => {
    const lg = layerGroupRef.current;
    lg.addTo(map);
    return () => {
      lg.removeFrom(map);
    };
  }, [map]);

  // Observe Yjs changes
  useEffect(() => {
    const observer = () => {
      if (!suppressObserverRef.current) {
        syncLayers();
      }
    };
    noGoAreas.observeDeep(observer);
    syncLayers();
    return () => noGoAreas.unobserveDeep(observer);
  }, [noGoAreas, syncLayers]);

  // Geoman drawing controls
  useEffect(() => {
    if (enabled) {
      map.pm.enableDraw("Polygon", {
        pathOptions: NO_GO_STYLE,
        snappable: false,
      });
    } else {
      map.pm.disableDraw();
    }

    const handleCreate = (e: { layer: L.Layer }) => {
      const layer = e.layer as L.Polygon;
      const latLngs = (layer.getLatLngs()[0] as L.LatLng[]);
      const points = latLngs.map((ll) => ({ lat: ll.lat, lon: ll.lng }));

      // Remove the geoman-created layer (we'll render from Yjs)
      map.removeLayer(layer);

      // Add to Yjs
      const yMap = new Y.Map();
      yMap.set("points", points);
      doc.transact(() => {
        noGoAreas.push([yMap]);
      }, "local");

      // Exit draw mode
      onToggle();
    };

    map.on("pm:create", handleCreate);

    return () => {
      map.pm.disableDraw();
      map.off("pm:create", handleCreate);
    };
  }, [map, enabled, noGoAreas, doc, onToggle]);

  return null;
}
