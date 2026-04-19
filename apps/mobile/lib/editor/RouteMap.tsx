import { useRef, useCallback } from "react";
import { StyleSheet, View, Text } from "react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  ViewAnnotation,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import type { Waypoint } from "@trails-cool/types";
import type { RouteSegment } from "./use-route-editor";

const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster" as const,
      source: "osm",
    },
  ],
};

interface RouteMapProps {
  waypoints: Waypoint[];
  segments: RouteSegment[];
  computing: boolean;
  onLongPress: (lat: number, lon: number) => void;
  onWaypointDragEnd: (index: number, lat: number, lon: number) => void;
  onWaypointPress: (index: number) => void;
}

export function RouteMap({
  waypoints,
  segments,
  computing,
  onLongPress,
  onWaypointDragEnd: _onWaypointDragEnd,
  onWaypointPress,
}: RouteMapProps) {
  // `Map` is undefined when the native module isn't linked (e.g. running
  // in Expo Go). Same safety net as before the v11 upgrade, just against
  // a named import instead of the removed default export.
  if (!Map) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>Map</Text>
        <Text style={styles.fallbackHint}>Requires a dev build with MapLibre</Text>
      </View>
    );
  }

  return <RouteMapInner
    waypoints={waypoints} segments={segments} computing={computing}
    onLongPress={onLongPress} onWaypointDragEnd={_onWaypointDragEnd}
    onWaypointPress={onWaypointPress}
  />;
}

function RouteMapInner({
  waypoints,
  segments,
  computing,
  onLongPress,
  onWaypointDragEnd: _onWaypointDragEnd,
  onWaypointPress,
}: RouteMapProps) {
  const cameraRef = useRef<CameraRef>(null);

  const handleLongPress = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      // v11 event shape: payload lives on `event.nativeEvent.lngLat`
      // (the old `event.geometry.coordinates` is gone).
      const lngLat = event?.nativeEvent?.lngLat;
      if (Array.isArray(lngLat) && lngLat.length >= 2) {
        onLongPress(lngLat[1] as number, lngLat[0] as number);
      }
    },
    [onLongPress],
  );

  // Build route GeoJSON from segments
  const routeGeojson = {
    type: "FeatureCollection" as const,
    features: segments.map((seg) => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: seg.coordinates,
      },
    })),
  };

  // Compute bounds for initial camera
  const bounds = computeBounds(waypoints, segments);

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={OSM_STYLE}
        onLongPress={handleLongPress}
        attribution={false}
        logo={false}
      >
        {bounds && (
          <Camera
            ref={cameraRef}
            initialViewState={{
              bounds: [bounds.sw[0], bounds.sw[1], bounds.ne[0], bounds.ne[1]],
              padding: { top: 40, right: 40, bottom: 40, left: 40 },
            }}
          />
        )}

        {!bounds && (
          <Camera
            initialViewState={{
              center: [10.0, 50.1],
              zoom: 6,
            }}
          />
        )}

        {/* Route line */}
        <GeoJSONSource id="route" data={routeGeojson}>
          <Layer
            id="route-line"
            type="line"
            paint={{
              "line-color": "#2563eb",
              "line-width": 4,
              "line-opacity": computing ? 0.4 : 1,
            }}
          />
        </GeoJSONSource>

        {/* Waypoint markers */}
        {waypoints.map((wp, i) => (
          <ViewAnnotation
            key={`wp-${i}`}
            lngLat={[wp.lon, wp.lat]}
          >
            <WaypointMarker
              index={i}
              isDayBreak={wp.isDayBreak}
              onPress={() => onWaypointPress(i)}
            />
          </ViewAnnotation>
        ))}
      </Map>

      {computing && (
        <View style={styles.computingBanner}>
          <Text style={styles.computingText}>Computing route...</Text>
        </View>
      )}
    </View>
  );
}

function WaypointMarker({
  index,
  isDayBreak,
  onPress,
}: {
  index: number;
  isDayBreak?: boolean;
  onPress: () => void;
}) {
  return (
    <View
      style={[styles.marker, isDayBreak && styles.markerOvernight]}
      onTouchEnd={onPress}
    >
      <Text style={styles.markerText}>{index + 1}</Text>
    </View>
  );
}

function computeBounds(
  waypoints: Waypoint[],
  segments: RouteSegment[],
): { ne: [number, number]; sw: [number, number] } | null {
  const points: [number, number][] = [
    ...waypoints.map((w) => [w.lon, w.lat] as [number, number]),
    ...segments.flatMap((s) => s.coordinates),
  ];

  if (points.length === 0) return null;

  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  for (const [lon, lat] of points) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return {
    ne: [maxLon, maxLat],
    sw: [minLon, minLat],
  };
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackText: { fontSize: 16, color: "#9ca3af", fontWeight: "600" },
  fallbackHint: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  container: { flex: 1 },
  map: { flex: 1 },
  computingBanner: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  computingText: { color: "#fff", fontSize: 13 },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#4A6B40",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  markerOvernight: {
    backgroundColor: "#f97316",
  },
  markerText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
