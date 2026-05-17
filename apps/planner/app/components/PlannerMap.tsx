import { useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, LayersControl, Marker, Polyline, Tooltip } from "react-leaflet";
import L from "leaflet";
import { useTranslation } from "react-i18next";
import type { DayStage } from "@trails-cool/gpx";
import type { YjsState } from "~/lib/use-yjs";
import { baseLayers, overlayLayers } from "@trails-cool/map";
import { setOvernight } from "~/lib/overnight";
import { usePois } from "~/lib/use-pois";
import { useProfileDefaults } from "~/lib/use-profile-defaults";
import { useYjsPoiSync } from "~/lib/use-yjs-poi-sync";
import { Z_WAYPOINT, Z_WAYPOINT_HIGHLIGHTED, Z_HIGHLIGHT } from "@trails-cool/map-core";
import { NoGoAreaLayer } from "./NoGoAreaLayer";
import { ColoredRoute } from "./ColoredRoute";
import { RouteInteraction } from "./RouteInteraction";
import { PoiPanel, PoiMarkers } from "./PoiPanel";
import { WaypointContextMenu } from "./WaypointContextMenu";
import {
  MapExposer,
  RouteFitter,
  MapClickHandler,
  CursorTracker,
  NoGoAreaButton,
  OverlaySync,
  PoiRefresher,
} from "./MapHelpers";
import { useWaypointManager } from "~/lib/use-waypoint-manager";
import { useGpxDrop } from "~/lib/use-gpx-drop";
import { useNearbyPois } from "~/lib/use-nearby-pois";
import { NearbyPoiMarkers } from "./NearbyPoiMarkers";
import { poiCategories } from "@trails-cool/map-core";
import type { Poi } from "~/lib/overpass";
import "leaflet/dist/leaflet.css";

function waypointIcon(index: number, overnight?: boolean, highlighted?: boolean, hasNote?: boolean): L.DivIcon {
  const bg = overnight ? "#8B6D3A" : "#2563eb";
  const scale = highlighted ? "scale(1.17)" : "scale(1)";
  const noteIndicator = hasNote
    ? `<span style="position:absolute;top:-3px;right:-3px;width:10px;height:10px;border-radius:50%;background:#f59e0b;border:1.5px solid white;font-size:7px;display:flex;align-items:center;justify-content:center;line-height:1;">✎</span>`
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:24px;height:24px;transform:translate(-12px,-12px) ${scale};transition:transform 0.2s ease;">
      <div style="
        width:24px;height:24px;border-radius:50%;
        background:${bg};color:white;
        display:flex;align-items:center;justify-content:center;
        font-size:12px;font-weight:600;
        border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);
      ">${overnight ? "☾" : index + 1}</div>
      ${noteIndicator}
    </div>`,
    iconSize: [0, 0],
  });
}

function dayLabelIcon(dayNumber: number, distanceKm: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="position:absolute;left:50%;transform:translate(-50%,-40px);">
      <div style="
        background:white;color:#1f2937;
        padding:1px 6px;border-radius:8px;
        font-size:10px;font-weight:600;white-space:nowrap;
        box-shadow:0 1px 3px rgba(0,0,0,0.15);
      ">Day ${dayNumber} · ${distanceKm} km</div>
    </div>`,
    iconSize: [0, 0],
  });
}

interface PlannerMapProps {
  yjs: YjsState;
  sessionId: string;
  onRouteRequest?: (waypoints: { lat: number; lon: number; name?: string; overnight: boolean }[]) => void;
  onImportError?: (message: string) => void;
  highlightPosition?: [number, number] | null;
  highlightedWaypoint?: number | null;
  selectedWaypointIndex?: number | null;
  onRouteHover?: (distance: number | null) => void;
  days?: DayStage[];
}

export function PlannerMap({ yjs, sessionId, onRouteRequest, highlightPosition, highlightedWaypoint, selectedWaypointIndex, onRouteHover, onImportError, days }: PlannerMapProps) {
  const { t } = useTranslation("planner");
  const poiState = usePois(sessionId);
  useProfileDefaults(yjs, poiState);
  useYjsPoiSync(yjs, poiState);
  const [enabledOverlays, setEnabledOverlays] = useState<string[]>([]);
  const [selectedBaseLayer, setSelectedBaseLayer] = useState<string>(baseLayers[0]!.name);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const [noGoDrawing, setNoGoDrawing] = useState(false);
  const toggleNoGoDraw = useCallback(() => setNoGoDrawing((v) => !v), []);
  const suppressMapClickRef = useRef(false);
  const routeInteractionSuspendedRef = useRef(false);
  const waypointDraggingRef = useRef(false);

  const {
    waypoints,
    routeCoordinates,
    segmentBoundaries,
    surfaces,
    highways,
    maxspeeds,
    smoothnesses,
    tracktypes,
    cycleways,
    bikeroutes,
    colorMode,
    addWaypoint,
    handleRouteInsert,
    moveWaypoint,
    deleteWaypoint,
    handleRoutePolylineHover,
  } = useWaypointManager(yjs, poiState, suppressMapClickRef, onRouteRequest);

  const { draggingOver, handleDragEnter, handleDragLeave, handleDragOver, handleDrop } = useGpxDrop(yjs, onImportError);

  const selectedWp = selectedWaypointIndex != null ? waypoints[selectedWaypointIndex] : undefined;
  const nearbyPoisState = useNearbyPois(selectedWp?.lat, selectedWp?.lon);

  const handleSnapToPoi = useCallback((poi: Poi) => {
    if (selectedWaypointIndex == null) return;
    const yMap = yjs.waypoints.get(selectedWaypointIndex);
    if (!yMap) return;
    const cat = poiCategories.find((c) => c.id === poi.category);
    const notePrefix = cat ? `${cat.icon} ${poi.name ?? cat.id}` : (poi.name ?? "");
    yjs.doc.transact(() => {
      yMap.set("lat", poi.lat);
      yMap.set("lon", poi.lon);
      if (poi.name && !yMap.get("name")) yMap.set("name", poi.name);
      const existing = yMap.get("note") as string | undefined;
      yMap.set("note", existing ? `${notePrefix}\n${existing}` : notePrefix);
      if (poi.id) yMap.set("osmId", poi.id);
    }, "local");
  }, [selectedWaypointIndex, yjs, poiCategories]);

  const handleRoutePolylineOut = useCallback(() => {
    onRouteHover?.(null);
  }, [onRouteHover]);

  return (
    <div
      className="relative h-full w-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {draggingOver && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-blue-500/20 backdrop-blur-sm">
          <div className="rounded-xl bg-white px-8 py-6 text-lg font-medium text-blue-600 shadow-lg">
            {t("dropGpxHere")}
          </div>
        </div>
      )}
      <MapContainer center={[50.1, 10.0]} zoom={6} className="h-full w-full">
        <LayersControl position="topright">
          {baseLayers.map((layer) => (
            <LayersControl.BaseLayer key={layer.name} checked={layer.name === selectedBaseLayer} name={layer.name}>
              <TileLayer url={layer.url} attribution={layer.attribution} maxZoom={layer.maxZoom} />
            </LayersControl.BaseLayer>
          ))}
          {overlayLayers.map((layer) => (
            <LayersControl.Overlay key={layer.id} checked={enabledOverlays.includes(layer.id)} name={layer.name}>
              <TileLayer url={layer.url} attribution={layer.attribution} maxZoom={layer.maxZoom} opacity={layer.opacity ?? 0.7} />
            </LayersControl.Overlay>
          ))}
        </LayersControl>

        <MapExposer />
        <OverlaySync yjs={yjs} onOverlayChange={setEnabledOverlays} onBaseLayerChange={setSelectedBaseLayer} />
        <RouteFitter coordinates={routeCoordinates} />
        <MapClickHandler onAdd={noGoDrawing ? () => {} : addWaypoint} suppressRef={suppressMapClickRef} />
        <CursorTracker awareness={yjs.awareness} />
        <NoGoAreaLayer noGoAreas={yjs.noGoAreas} doc={yjs.doc} enabled={noGoDrawing} onToggle={toggleNoGoDraw} />
        <NoGoAreaButton active={noGoDrawing} onClick={toggleNoGoDraw} />
        <PoiRefresher poiState={poiState} />
        <PoiMarkers poiState={poiState} onAddWaypoint={addWaypoint} />
        <PoiPanel poiState={poiState} />
        {selectedWaypointIndex != null && nearbyPoisState.pois.length > 0 && (
          <NearbyPoiMarkers
            pois={nearbyPoisState.pois}
            categories={poiCategories}
            onSnap={handleSnapToPoi}
          />
        )}

        {waypoints.map((wp, i) => (
          <Marker
            key={i}
            position={[wp.lat, wp.lon]}
            draggable
            zIndexOffset={highlightedWaypoint === i ? Z_WAYPOINT_HIGHLIGHTED : Z_WAYPOINT}
            icon={waypointIcon(i, wp.overnight, highlightedWaypoint === i, !!wp.note)}
            eventHandlers={{
              mouseover: () => { routeInteractionSuspendedRef.current = true; },
              mouseout: () => {
                if (!waypointDraggingRef.current) routeInteractionSuspendedRef.current = false;
              },
              dragstart: () => {
                waypointDraggingRef.current = true;
                yjs.undoManager.stopCapturing();
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
                const orig = e.originalEvent as MouseEvent;
                setContextMenu({ x: orig.clientX, y: orig.clientY, index: i });
              },
            }}
          >
            {wp.note && (
              <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
                <span style={{ maxWidth: 220, display: "block", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {wp.note.length > 120 ? wp.note.slice(0, 120) + "…" : wp.note}
                </span>
              </Tooltip>
            )}
          </Marker>
        ))}

        {days && days.length > 1 && days.map((day) => {
          const wp = waypoints[day.endWaypointIndex];
          if (!wp || day.dayNumber === days.length) return null;
          return (
            <Marker
              key={`day-${day.dayNumber}`}
              position={[wp.lat, wp.lon]}
              icon={dayLabelIcon(day.dayNumber, (day.distance / 1000).toFixed(1))}
              interactive={false}
            />
          );
        })}

        {routeCoordinates && routeCoordinates.length >= 2 && (
          <>
            <ColoredRoute
              coordinates={routeCoordinates}
              colorMode={colorMode}
              surfaces={surfaces}
              highways={highways}
              maxspeeds={maxspeeds}
              smoothnesses={smoothnesses}
              tracktypes={tracktypes}
              cycleways={cycleways}
              bikeroutes={bikeroutes}
            />
            <RouteInteraction
              coordinates={routeCoordinates}
              segmentBoundaries={segmentBoundaries}
              onInsertWaypoint={handleRouteInsert}
              suspendedRef={routeInteractionSuspendedRef}
              disabled={noGoDrawing}
            />
            {onRouteHover && (
              <Polyline
                positions={routeCoordinates.map((c) => [c[1]!, c[0]!] as [number, number])}
                pathOptions={{ weight: 20, opacity: 0, interactive: true }}
                eventHandlers={{
                  mouseover: (e) => handleRoutePolylineHover(e, onRouteHover),
                  mousemove: (e) => handleRoutePolylineHover(e, onRouteHover),
                  mouseout: handleRoutePolylineOut,
                }}
              />
            )}
          </>
        )}

        {highlightPosition && (
          <Marker
            position={highlightPosition}
            zIndexOffset={Z_HIGHLIGHT}
            interactive={false}
            icon={L.divIcon({
              className: "",
              html: '<div style="width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);transform:translate(-6px,-6px)"></div>',
              iconSize: [0, 0],
            })}
          />
        )}
      </MapContainer>
      {contextMenu && (
        <WaypointContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          isFirst={contextMenu.index === 0}
          isLast={contextMenu.index === waypoints.length - 1}
          isOvernight={waypoints[contextMenu.index]?.overnight ?? false}
          onDelete={() => deleteWaypoint(contextMenu.index)}
          onToggleOvernight={() => setOvernight(yjs, contextMenu.index, !waypoints[contextMenu.index]?.overnight)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
