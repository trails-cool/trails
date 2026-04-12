export interface TileLayerConfig {
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
}

export interface OverlayLayerConfig extends TileLayerConfig {
  id: string;
  opacity?: number;
}

export const overlayLayers: OverlayLayerConfig[] = [
  {
    id: "hillshading",
    name: "Hillshading",
    url: "https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png",
    attribution: "Hillshading: SRTM/Mapzen",
    maxZoom: 17,
    opacity: 0.5,
  },
  {
    id: "waymarked-cycling",
    name: "Cycling Routes",
    url: "https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a> (CC-BY-SA)',
    maxZoom: 18,
  },
  {
    id: "waymarked-hiking",
    name: "Hiking Routes",
    url: "https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a> (CC-BY-SA)',
    maxZoom: 18,
  },
  {
    id: "waymarked-mtb",
    name: "MTB Routes",
    url: "https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a> (CC-BY-SA)',
    maxZoom: 18,
  },
];

export const baseLayers: TileLayerConfig[] = [
  {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  {
    name: "OpenTopoMap",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    maxZoom: 17,
  },
  {
    name: "CyclOSM",
    url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases">CyclOSM</a>',
    maxZoom: 20,
  },
];
