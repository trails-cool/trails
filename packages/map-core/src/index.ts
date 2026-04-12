export type { TileLayerConfig, OverlayLayerConfig } from "./tiles.ts";
export { baseLayers, overlayLayers } from "./tiles.ts";

export {
  SURFACE_COLORS, DEFAULT_SURFACE_COLOR,
  HIGHWAY_COLORS, DEFAULT_HIGHWAY_COLOR,
  SMOOTHNESS_COLORS, DEFAULT_SMOOTHNESS_COLOR,
  TRACKTYPE_COLORS, DEFAULT_TRACKTYPE_COLOR,
  CYCLEWAY_COLORS, DEFAULT_CYCLEWAY_COLOR,
  BIKEROUTE_COLORS, DEFAULT_BIKEROUTE_COLOR,
  elevationColor, routeGradeColor,
  maxspeedColor,
} from "./colors/index.ts";

export type { PoiCategory } from "./poi.ts";
export { poiCategories, getCategoriesForProfile, profileOverlayDefaults } from "./poi.ts";

export {
  Z_CURSOR, Z_GHOST_WAYPOINT, Z_WAYPOINT,
  Z_POI_MARKER, Z_WAYPOINT_HIGHLIGHTED, Z_HIGHLIGHT,
} from "./z-index.ts";

export { SNAP_DISTANCE_METERS } from "./snap.ts";
