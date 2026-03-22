import { MapContainer, TileLayer, LayersControl } from "react-leaflet";
import { baseLayers } from "./layers";
import "leaflet/dist/leaflet.css";

export interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  children?: React.ReactNode;
}

export function MapView({
  center = [50.1, 10.0],
  zoom = 6,
  className = "h-full w-full",
  children,
}: MapViewProps) {
  return (
    <MapContainer center={center} zoom={zoom} className={className}>
      <LayersControl position="topright">
        {baseLayers.map((layer, i) => (
          <LayersControl.BaseLayer key={layer.name} checked={i === 0} name={layer.name}>
            <TileLayer
              url={layer.url}
              attribution={layer.attribution}
              maxZoom={layer.maxZoom}
            />
          </LayersControl.BaseLayer>
        ))}
      </LayersControl>
      {children}
    </MapContainer>
  );
}
