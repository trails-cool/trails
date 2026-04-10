import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import type { GeoJsonObject } from "geojson";
import "leaflet/dist/leaflet.css";

function FitBounds({ data }: { data: GeoJsonObject }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    const layer = L.geoJSON(data);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
      fitted.current = true;
    }
  }, [data, map]);
  return null;
}

interface RouteMapProps {
  geojson: string;
  interactive?: boolean;
  className?: string;
}

export function RouteMapThumbnail({ geojson, interactive, className }: RouteMapProps) {
  const data: GeoJsonObject = JSON.parse(geojson);

  return (
    <MapContainer
      center={[50, 10]}
      zoom={6}
      className={className ?? "h-36 w-full rounded"}
      zoomControl={interactive ?? false}
      attributionControl={interactive ?? false}
      dragging={interactive ?? false}
      scrollWheelZoom={interactive ?? false}
      doubleClickZoom={interactive ?? false}
      touchZoom={interactive ?? false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution={interactive ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' : undefined}
      />
      <GeoJSON data={data} style={{ color: "#2563eb", weight: 3, opacity: 0.8 }} />
      <FitBounds data={data} />
    </MapContainer>
  );
}
