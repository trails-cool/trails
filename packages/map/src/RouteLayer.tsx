import { GeoJSON } from "react-leaflet";
import type { GeoJsonObject } from "geojson";

export interface RouteLayerProps {
  data: GeoJsonObject;
  color?: string;
  weight?: number;
}

export function RouteLayer({ data, color = "#2563eb", weight = 4 }: RouteLayerProps) {
  return (
    <GeoJSON
      key={JSON.stringify(data)}
      data={data}
      style={{ color, weight, opacity: 0.8 }}
    />
  );
}
