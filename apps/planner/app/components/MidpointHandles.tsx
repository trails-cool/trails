import { useMemo, useState, useEffect } from "react";
import { Marker, useMap } from "react-leaflet";
import L from "leaflet";

interface MidpointHandlesProps {
  coordinates: [number, number, number][]; // [lon, lat, ele]
  segmentBoundaries: number[];
  onInsertWaypoint: (segmentIndex: number, lat: number, lon: number) => void;
}

function getSegmentMidpoint(
  coordinates: [number, number, number][],
  startIdx: number,
  endIdx: number,
): [number, number] | null {
  if (endIdx <= startIdx) return null;
  const midCoordIdx = Math.floor((startIdx + endIdx) / 2);
  const c = coordinates[midCoordIdx];
  if (!c) return null;
  return [c[1], c[0]]; // [lat, lon]
}

const midpointIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:12px;height:12px;border-radius:50%;
    background:#93c5fd;border:2px solid #2563eb;
    cursor:grab;transform:translate(-6px,-6px);
    opacity:0.7;
  " data-midpoint="true"></div>`,
  iconSize: [0, 0],
});

const dragIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:14px;height:14px;border-radius:50%;
    background:#3b82f6;border:2px solid white;
    box-shadow:0 1px 4px rgba(0,0,0,0.3);
    transform:translate(-7px,-7px);
  "></div>`,
  iconSize: [0, 0],
});

export function MidpointHandles({
  coordinates,
  segmentBoundaries,
  onInsertWaypoint,
}: MidpointHandlesProps) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [dragging, setDragging] = useState<{ segmentIndex: number; lat: number; lon: number } | null>(null);

  // Track zoom changes
  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => { map.off("zoomend", onZoom); };
  }, [map]);

  const midpoints = useMemo(() => {
    if (segmentBoundaries.length < 1) return [];

    const result: { lat: number; lon: number; segmentIndex: number }[] = [];
    for (let i = 0; i < segmentBoundaries.length; i++) {
      const startIdx = segmentBoundaries[i]!;
      const endIdx = i + 1 < segmentBoundaries.length
        ? segmentBoundaries[i + 1]!
        : coordinates.length;

      const mid = getSegmentMidpoint(coordinates, startIdx, endIdx);
      if (mid) {
        result.push({ lat: mid[0], lon: mid[1], segmentIndex: i });
      }
    }
    return result;
  }, [coordinates, segmentBoundaries]);

  // Hide at low zoom levels
  if (zoom < 12) return null;

  return (
    <>
      {midpoints.map((mp) => (
        <Marker
          key={mp.segmentIndex}
          position={[mp.lat, mp.lon]}
          icon={midpointIcon}
          eventHandlers={{
            mousedown: () => {
              setDragging({ segmentIndex: mp.segmentIndex, lat: mp.lat, lon: mp.lon });
              const onMouseMove = (e: L.LeafletMouseEvent) => {
                setDragging({ segmentIndex: mp.segmentIndex, lat: e.latlng.lat, lon: e.latlng.lng });
              };
              const onMouseUp = (e: L.LeafletMouseEvent) => {
                map.off("mousemove", onMouseMove);
                map.off("mouseup", onMouseUp);
                map.dragging.enable();
                setDragging(null);
                onInsertWaypoint(mp.segmentIndex, e.latlng.lat, e.latlng.lng);
              };
              map.dragging.disable();
              map.on("mousemove", onMouseMove);
              map.on("mouseup", onMouseUp);
            },
          }}
        />
      ))}
      {dragging && (
        <Marker
          position={[dragging.lat, dragging.lon]}
          icon={dragIcon}
          interactive={false}
        />
      )}
    </>
  );
}
