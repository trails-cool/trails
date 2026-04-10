/**
 * Leaflet marker z-index offsets for consistent layering.
 * Higher values render on top of lower values.
 *
 * Rendering order (bottom to top):
 *   POI markers → cursor markers → ghost waypoint → waypoint markers → highlight dot
 */
export const Z_CURSOR = -1000;
export const Z_GHOST_WAYPOINT = -100;
export const Z_WAYPOINT = 1000;
export const Z_POI_MARKER = 1200;
export const Z_WAYPOINT_HIGHLIGHTED = 1600;
export const Z_HIGHLIGHT = 2000;
