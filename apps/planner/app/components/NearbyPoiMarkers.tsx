import L from "leaflet";
import { Marker, Tooltip } from "react-leaflet";
import type { Poi } from "~/lib/overpass";
import type { PoiCategory } from "@trails-cool/map-core";

interface NearbyPoiMarkersProps {
  pois: Poi[];
  categories: PoiCategory[];
  onSnap: (poi: Poi) => void;
}

function nearbyPoiIcon(color: string, icon: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};color:white;
      display:flex;align-items:center;justify-content:center;
      font-size:10px;
      border:1.5px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.25);
      transform:translate(-9px,-9px);
    ">${icon}</div>`,
    iconSize: [0, 0],
  });
}

export function NearbyPoiMarkers({ pois, categories, onSnap }: NearbyPoiMarkersProps) {
  return (
    <>
      {pois.map((poi) => {
        const cat = categories.find((c) => c.id === poi.category);
        if (!cat) return null;
        return (
          <Marker
            key={poi.id}
            position={[poi.lat, poi.lon]}
            icon={nearbyPoiIcon(cat.color, cat.icon)}
            eventHandlers={{ click: () => onSnap(poi) }}
            zIndexOffset={900}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
              <span>{poi.name ?? cat.icon} {cat.icon !== poi.name ? cat.icon : ""}</span>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
