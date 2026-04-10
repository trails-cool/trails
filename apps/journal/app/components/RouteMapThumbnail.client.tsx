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

const DAY_COLORS = ["#2563eb", "#8B6D3A", "#059669", "#9333ea", "#dc2626", "#0891b2"];

interface RouteMapProps {
  geojson: string;
  interactive?: boolean;
  className?: string;
  dayBreaks?: number[];
  /** 1-based day number to highlight, or null for no highlight */
  highlightedDay?: number | null;
}

export function RouteMapThumbnail({ geojson, interactive, className, dayBreaks, highlightedDay }: RouteMapProps) {
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
      {dayBreaks && dayBreaks.length > 0 ? (
        <DayColoredRoute data={data} dayBreaks={dayBreaks} highlightedDay={highlightedDay} />
      ) : (
        <GeoJSON data={data} style={{ color: "#2563eb", weight: 3, opacity: 0.8 }} />
      )}
      <FitBounds data={data} />
    </MapContainer>
  );
}

function DayColoredRoute({ data, dayBreaks, highlightedDay }: { data: GeoJsonObject; dayBreaks: number[]; highlightedDay?: number | null }) {
  // Extract coordinates from the GeoJSON LineString
  const geometry = (data as { type: string; coordinates?: number[][] }).coordinates
    ?? ((data as { features?: Array<{ geometry: { coordinates: number[][] } }> }).features?.[0]?.geometry?.coordinates);

  if (!geometry || geometry.length < 2) {
    return <GeoJSON data={data} style={{ color: "#2563eb", weight: 3, opacity: 0.8 }} />;
  }

  // Split coordinates into segments at approximate day break points
  // dayBreaks are waypoint indices — we split the line evenly since we don't
  // have exact waypoint-to-coordinate mapping in the Journal context
  const totalPoints = geometry.length;
  const numDays = dayBreaks.length + 1;
  const pointsPerDay = Math.ceil(totalPoints / numDays);

  const segments: Array<{ coords: number[][]; color: string }> = [];
  for (let d = 0; d < numDays; d++) {
    const start = d * pointsPerDay;
    const end = Math.min((d + 1) * pointsPerDay + 1, totalPoints);
    if (start >= totalPoints) break;
    segments.push({
      coords: geometry.slice(start, end),
      color: DAY_COLORS[d % DAY_COLORS.length]!,
    });
  }

  const isHighlighting = highlightedDay != null;

  return (
    <>
      {segments.map((seg, i) => {
        const dayNum = i + 1;
        const isActive = highlightedDay === dayNum;
        const segData: GeoJsonObject = {
          type: "Feature",
          geometry: { type: "LineString", coordinates: seg.coords },
          properties: {},
        } as unknown as GeoJsonObject;
        return (
          <GeoJSON
            key={`${i}-${highlightedDay}`}
            data={segData}
            style={{
              color: seg.color,
              weight: isHighlighting ? (isActive ? 5 : 2) : 3,
              opacity: isHighlighting ? (isActive ? 1 : 0.3) : 0.8,
            }}
          />
        );
      })}
    </>
  );
}
