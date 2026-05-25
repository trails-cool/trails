// Ambient type augmentations for the planner client.
//
// Picked up by tsconfig's default `include` (every `**/*.ts(x)` inside
// the project root). Keeps the `as unknown as Record<string, unknown>`
// dance out of every site that needs to read or write a globally-
// exposed value.

import type { Map as LeafletMap, LayerGroup } from "leaflet";

declare global {
  // Exposed by MapHelpers.tsx::MapExposer for E2E tests and external
  // integrations. Optional because it's only present after the map
  // mounts.
  interface Window {
    __leafletMap?: LeafletMap;
  }
}

// Module augmentation for leaflet.markercluster. The plugin extends
// the global `L` namespace at runtime but ships no TypeScript types,
// so without this declaration callers fall back to `as unknown as
// {...}` shims.
declare module "leaflet" {
  function markerClusterGroup(options?: MarkerClusterGroupOptions): LayerGroup;
  interface MarkerClusterGroupOptions {
    showCoverageOnHover?: boolean;
    spiderfyOnMaxZoom?: boolean;
    zoomToBoundsOnClick?: boolean;
    maxClusterRadius?: number;
    [key: string]: unknown;
  }
}

export {};
