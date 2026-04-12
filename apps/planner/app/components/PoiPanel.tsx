import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { useTranslation } from "react-i18next";
import { useMap } from "react-leaflet";
import { poiCategories, Z_POI_MARKER } from "@trails-cool/map-core";
import type { PoiState } from "~/lib/use-pois";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

interface PoiPanelProps {
  poiState: PoiState;
  onAddWaypoint?: (lat: number, lon: number, name?: string) => void;
}

export function PoiPanel({ poiState }: PoiPanelProps) {
  const { t } = useTranslation("planner");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) L.DomEvent.disableClickPropagation(ref.current);
  }, []);

  const countByCategory = new Map<string, number>();
  for (const poi of poiState.pois) {
    countByCategory.set(poi.category, (countByCategory.get(poi.category) ?? 0) + 1);
  }

  return (
    <div ref={ref} className="leaflet-top leaflet-right" style={{ marginTop: 120 }}>
      <div className="leaflet-control">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded bg-white text-base shadow-md hover:bg-gray-50"
          title={t("poi.toggle")}
        >
          📍
        </button>
        {open && (
          <div className="mt-1 w-48 rounded bg-white p-2 shadow-lg">
            <p className="mb-1 text-xs font-semibold text-gray-600">{t("poi.title")}</p>

            {poiState.status === "zoom_too_low" && (
              <p className="text-xs text-amber-600">{t("poi.zoomIn")}</p>
            )}
            {poiState.status === "rate_limited" && (
              <p className="text-xs text-red-600">{t("poi.rateLimited")}</p>
            )}
            {poiState.status === "error" && (
              <p className="text-xs text-red-600">{t("poi.error")}</p>
            )}
            {poiState.status === "loading" && (
              <p className="text-xs text-blue-600">{t("poi.loading")}</p>
            )}

            <div className="mt-1 space-y-0.5">
              {poiCategories.map((cat) => {
                const count = countByCategory.get(cat.id) ?? 0;
                const enabled = poiState.enabledCategories.includes(cat.id);
                return (
                  <label key={cat.id} className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => poiState.toggleCategory(cat.id)}
                      className="h-3.5 w-3.5 rounded border-gray-300"
                    />
                    <span className="text-sm">{cat.icon}</span>
                    <span className="flex-1 text-xs text-gray-700">{t(cat.name)}</span>
                    {enabled && count > 0 && (
                      <span className="text-[10px] tabular-nums text-gray-400">{count}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PoiMarkers({ poiState, onAddWaypoint }: PoiPanelProps) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    let mounted = true;
    // Dynamic import to avoid bundling markercluster when POIs aren't used
    import("leaflet.markercluster").then(() => {
      if (!mounted) return;
      // After import, L.markerClusterGroup is available
      const cluster = (L as unknown as { markerClusterGroup: (opts?: object) => L.LayerGroup }).markerClusterGroup({
        maxClusterRadius: 40,
        disableClusteringAtZoom: 15,
        showCoverageOnHover: false,
      });
      layerRef.current = cluster;
      cluster.addTo(map);
    }).catch(() => {
      // Fallback to plain layer group if markercluster fails to load
      if (!mounted) return;
      layerRef.current = L.layerGroup();
      layerRef.current.addTo(map);
    });
    return () => { mounted = false; layerRef.current?.remove(); };
  }, [map]);

  // Event delegation for "Add as waypoint" buttons in popups
  useEffect(() => {
    const container = map.getContainer();
    const handler = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest(".poi-add-wp") as HTMLElement | null;
      if (!btn || !onAddWaypoint) return;
      const lat = parseFloat(btn.dataset.lat!);
      const lon = parseFloat(btn.dataset.lon!);
      const name = btn.dataset.name || undefined;
      onAddWaypoint(lat, lon, name);
      map.closePopup();
    };
    container.addEventListener("click", handler);
    return () => container.removeEventListener("click", handler);
  }, [map, onAddWaypoint]);

  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;
    group.clearLayers();

    const catMap = new Map(poiCategories.map((c) => [c.id, c]));

    for (const poi of poiState.pois) {
      const cat = catMap.get(poi.category);
      if (!cat) continue;

      const marker = L.marker([poi.lat, poi.lon], {
        icon: L.divIcon({
          className: "",
          html: `<div style="
            width:20px;height:20px;border-radius:50%;
            background:white;
            display:flex;align-items:center;justify-content:center;
            font-size:12px;
            border:2px solid ${cat.color};
            box-shadow:0 1px 3px rgba(0,0,0,0.2);
            transform:translate(-10px,-10px);
          ">${cat.icon}</div>`,
          iconSize: [0, 0],
        }),
        zIndexOffset: Z_POI_MARKER,
      });

      const popupLines = [`<strong>${poi.name ?? cat.icon + " " + poi.category}</strong>`];
      popupLines.push(`<span style="font-size:11px;color:#888">${cat.icon} ${cat.id.replace(/_/g, " ")}</span>`);
      if (poi.tags.description) popupLines.push(`<span style="font-size:12px">${poi.tags.description}</span>`);
      const addr = [poi.tags["addr:street"], poi.tags["addr:housenumber"]].filter(Boolean).join(" ");
      const addrCity = [addr, poi.tags["addr:postcode"], poi.tags["addr:city"]].filter(Boolean).join(", ");
      if (addrCity) popupLines.push(`📍 ${addrCity}`);
      const phone = poi.tags.phone ?? poi.tags["contact:phone"];
      if (phone) popupLines.push(`📞 <a href="tel:${phone}">${phone}</a>`);
      if (poi.tags.opening_hours) popupLines.push(`🕐 ${poi.tags.opening_hours}`);
      if (poi.tags.website) popupLines.push(`<a href="${poi.tags.website}" target="_blank" rel="noopener">Website</a>`);
      popupLines.push(`<a href="https://www.openstreetmap.org/node/${poi.id}" target="_blank" rel="noopener" style="font-size:11px;color:#666">OSM</a>`);
      if (onAddWaypoint) {
        popupLines.push(`<button class="poi-add-wp" data-lat="${poi.lat}" data-lon="${poi.lon}" data-name="${(poi.name ?? "").replace(/"/g, "&quot;")}" style="margin-top:4px;padding:2px 8px;font-size:11px;background:#2563eb;color:white;border:none;border-radius:4px;cursor:pointer">+ Add as waypoint</button>`);
      }

      marker.bindPopup(popupLines.join("<br>"), { maxWidth: 200 });
      group.addLayer(marker);
    }
  }, [poiState.pois]);

  return null;
}
