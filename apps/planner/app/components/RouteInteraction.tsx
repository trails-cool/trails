import { useEffect, useRef, useCallback } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface RouteInteractionProps {
  coordinates: [number, number, number][]; // [lon, lat, ele]
  segmentBoundaries: number[];
  onInsertWaypoint: (pointIndex: number, lat: number, lon: number) => void;
  disabled?: boolean;
  /** Set true to suspend ghost marker (e.g. while hovering/dragging a waypoint) */
  suspendedRef?: React.RefObject<boolean>;
}

const SNAP_TOLERANCE_PX = 15;

const ghostIcon = L.divIcon({
  className: "route-ghost-marker",
  html: `<div style="
    width:14px;height:14px;border-radius:50%;
    background:white;border:3px solid #2563eb;
    box-shadow:0 1px 4px rgba(0,0,0,0.3);
    transform:translate(-7px,-7px);
    cursor:grab;
  "></div>`,
  iconSize: [0, 0],
});

/**
 * Route interaction layer: shows a ghost marker on hover that can be
 * clicked or dragged to insert a waypoint. Follows brouter-web's pattern
 * of suspending when the mouse is over a waypoint marker.
 */
export function RouteInteraction({
  coordinates,
  segmentBoundaries,
  onInsertWaypoint,
  disabled,
  suspendedRef,
}: RouteInteractionProps) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const draggingRef = useRef(false);
  const snappedIdxRef = useRef(0);
  const coordinatesRef = useRef(coordinates);
  const segBoundsRef = useRef(segmentBoundaries);
  const onInsertRef = useRef(onInsertWaypoint);
  coordinatesRef.current = coordinates;
  segBoundsRef.current = segmentBoundaries;
  onInsertRef.current = onInsertWaypoint;

  // Trailer lines (dashed lines from ghost to adjacent waypoints)
  const trailer1Ref = useRef<L.Polyline | null>(null);
  const trailer2Ref = useRef<L.Polyline | null>(null);

  const findClosestOnRoute = useCallback((latlng: L.LatLng): { idx: number; lat: number; lon: number; distPx: number } | null => {
    const coords = coordinatesRef.current;
    if (coords.length < 2) return null;

    let minDistPx = Infinity;
    let bestIdx = 0;
    let bestLat = 0;
    let bestLon = 0;

    // Find closest point on route in pixel space for accuracy
    const clickPt = map.latLngToContainerPoint(latlng);

    for (let i = 0; i < coords.length; i++) {
      const c = coords[i]!;
      const pt = map.latLngToContainerPoint([c[1], c[0]]);
      const dx = pt.x - clickPt.x;
      const dy = pt.y - clickPt.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistPx) {
        minDistPx = dist;
        bestIdx = i;
        bestLat = c[1];
        bestLon = c[0];
      }
    }

    return { idx: bestIdx, lat: bestLat, lon: bestLon, distPx: minDistPx };
  }, [map]);

  useEffect(() => {
    if (disabled) return;

    // Create persistent ghost marker (hidden until hover)
    const marker = L.marker([0, 0], {
      icon: ghostIcon,
      draggable: true,
      interactive: true,
      zIndexOffset: -100,
    });
    markerRef.current = marker;

    // Trailer lines
    const trailer1 = L.polyline([], { color: "#2563eb", weight: 2, dashArray: "6,8", opacity: 0 }).addTo(map);
    const trailer2 = L.polyline([], { color: "#2563eb", weight: 2, dashArray: "6,8", opacity: 0 }).addTo(map);
    trailer1Ref.current = trailer1;
    trailer2Ref.current = trailer2;

    let shown = false;

    const showMarker = (lat: number, lon: number) => {
      marker.setLatLng([lat, lon]);
      if (!shown) {
        marker.addTo(map);
        shown = true;
      }
    };

    const hideMarker = () => {
      if (shown && !draggingRef.current) {
        marker.remove();
        shown = false;
      }
    };

    // Listen for mousemove on the map (distance-based approach, not polyline events)
    const onMouseMove = (e: L.LeafletMouseEvent) => {
      // Suspended while hovering over or dragging a waypoint marker (brouter-web pattern)
      if (draggingRef.current || suspendedRef?.current) {
        hideMarker();
        return;
      }

      const snap = findClosestOnRoute(e.latlng);
      if (!snap || snap.distPx > SNAP_TOLERANCE_PX) {
        hideMarker();
        return;
      }

      snappedIdxRef.current = snap.idx;
      showMarker(snap.lat, snap.lon);
    };

    const onMouseOut = () => {
      hideMarker();
    };

    // Drag events on the ghost marker
    marker.on("dragstart", () => {
      draggingRef.current = true;
      trailer1.setStyle({ opacity: 0.6 });
      trailer2.setStyle({ opacity: 0.6 });
    });

    marker.on("drag", (e) => {
      const latlng = (e.target as L.Marker).getLatLng();
      // Update trailer lines to adjacent waypoints
      const idx = snappedIdxRef.current;
      const bounds = segBoundsRef.current;
      const coords = coordinatesRef.current;

      // Find which segment this point is in
      let segIdx = 0;
      for (let i = bounds.length - 1; i >= 0; i--) {
        if (idx >= bounds[i]!) { segIdx = i; break; }
      }

      // Trailer to previous waypoint (segment start)
      if (segIdx >= 0) {
        const startCoordIdx = bounds[segIdx]!;
        const c = coords[startCoordIdx];
        if (c) trailer1.setLatLngs([latlng, [c[1], c[0]]]);
      }
      // Trailer to next waypoint (next segment start or end)
      const nextStart = segIdx + 1 < bounds.length ? bounds[segIdx + 1]! : coords.length - 1;
      const nc = coords[nextStart];
      if (nc) trailer2.setLatLngs([latlng, [nc[1], nc[0]]]);
    });

    marker.on("dragend", (e) => {
      const latlng = (e.target as L.Marker).getLatLng();
      draggingRef.current = false;
      trailer1.setStyle({ opacity: 0 });
      trailer2.setStyle({ opacity: 0 });
      marker.remove();
      shown = false;

      onInsertRef.current(snappedIdxRef.current, latlng.lat, latlng.lng);
    });

    // Click on ghost marker inserts at snapped position
    marker.on("click", () => {
      if (draggingRef.current) return;
      const latlng = marker.getLatLng();
      marker.remove();
      shown = false;

      onInsertRef.current(snappedIdxRef.current, latlng.lat, latlng.lng);
    });

    // Prevent double-click zoom when clicking ghost marker
    marker.on("dblclick", (e) => {
      L.DomEvent.stop(e as unknown as Event);
    });

    map.on("mousemove", onMouseMove);
    map.on("mouseout", onMouseOut);

    return () => {
      map.off("mousemove", onMouseMove);
      map.off("mouseout", onMouseOut);
      if (shown) marker.remove();
      trailer1.remove();
      trailer2.remove();
      markerRef.current = null;
    };
  }, [map, disabled, findClosestOnRoute, suspendedRef]);

  return null;
}
