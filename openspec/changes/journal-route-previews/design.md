## Context

The journal stores route geometry as PostGIS LineString (SRID 4326) in the `geom` column. The `@trails-cool/map` package provides `MapView` and `RouteLayer` components built on React Leaflet. Currently these are only used by the planner — the journal has zero map UI.

## Goals / Non-Goals

**Goals:**
- Show route shape on list pages as small map thumbnails that auto-fit to the route bounds
- Show interactive read-only map on detail pages with route overlay
- Use existing `@trails-cool/map` components — no new map library
- Keep list pages fast (geometry is small as GeoJSON, lazy-load Leaflet)

**Non-Goals:**
- Editable maps in the journal (editing happens in the planner)
- Server-side map image generation (static tiles) — use client-side Leaflet for both
- Elevation profile on detail pages — future work

## Decisions

**GeoJSON from PostGIS:** Use `ST_AsGeoJSON(geom)` in SQL queries to convert geometry to GeoJSON strings. Parse on the server and include in loader data. This avoids sending raw GPX to the client just for rendering.

**List thumbnails:** Small `MapView` (e.g., 200x150px) with `RouteLayer`, no controls, no interaction (`dragging: false`, `zoomControl: false`). Auto-fit bounds to route with padding. Lazy-loaded via `Suspense` to keep initial page load fast.

**Detail page map:** Full-width `MapView` with standard controls, auto-fit to route. Same `RouteLayer` component.

**Fallback for routes without geometry:** Show a placeholder (e.g., muted map icon) when `geom` is null. This handles legacy routes created before the PostGIS fix.

## Risks / Trade-offs

- **List page performance:** Many small Leaflet instances could be slow. Mitigate with lazy loading and keeping the component simple (no tile layers until visible via Intersection Observer, or just accept the trade-off for v1).
- **Geometry size:** A route with 5000 points produces ~100KB of GeoJSON. For list pages, we could simplify the geometry server-side with `ST_Simplify()` to reduce payload.
