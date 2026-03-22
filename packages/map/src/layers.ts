export interface TileLayerConfig {
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
}

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
