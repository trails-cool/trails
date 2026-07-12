/**
 * A single OSM tag selector: an element matches the selector when its tags
 * contain `key` mapped to `value`. Categories are unions of selectors.
 *
 * This structured form is the single source of truth for "what is a shelter":
 * the POI extract pipeline renders it to an osmium tag-filter expression, and
 * the flagship importer classifies each filtered element back to its
 * category/categories. Nothing builds Overpass QL from these any more.
 */
export interface PoiSelector {
  key: string;
  value: string;
}

export interface PoiCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  selectors: PoiSelector[];
  profiles?: string[];
}

export const poiCategories: PoiCategory[] = [
  {
    id: "drinking_water",
    name: "poi.drinkingWater",
    icon: "\u{1F4A7}",
    color: "#2563eb",
    selectors: [
      { key: "amenity", value: "drinking_water" },
      { key: "amenity", value: "water_point" },
    ],
  },
  {
    id: "shelter",
    name: "poi.shelter",
    icon: "\u{1F6D6}",
    color: "#8B6D3A",
    selectors: [
      { key: "amenity", value: "shelter" },
      { key: "tourism", value: "wilderness_hut" },
    ],
    profiles: ["trekking"],
  },
  {
    id: "camping",
    name: "poi.camping",
    icon: "⛺",
    color: "#059669",
    selectors: [
      { key: "tourism", value: "camp_site" },
      { key: "tourism", value: "caravan_site" },
    ],
  },
  {
    id: "food",
    name: "poi.food",
    icon: "\u{1F37D}️",
    color: "#dc2626",
    selectors: [
      { key: "amenity", value: "restaurant" },
      { key: "amenity", value: "cafe" },
      { key: "amenity", value: "fast_food" },
      { key: "amenity", value: "pub" },
      { key: "amenity", value: "biergarten" },
    ],
  },
  {
    id: "groceries",
    name: "poi.groceries",
    icon: "\u{1F6D2}",
    color: "#f97316",
    selectors: [
      { key: "shop", value: "supermarket" },
      { key: "shop", value: "convenience" },
      { key: "shop", value: "bakery" },
    ],
  },
  {
    id: "bike_infra",
    name: "poi.bikeInfra",
    icon: "\u{1F527}",
    color: "#8b5cf6",
    selectors: [
      { key: "amenity", value: "bicycle_parking" },
      { key: "amenity", value: "bicycle_repair_station" },
      { key: "amenity", value: "bicycle_rental" },
    ],
    profiles: ["fastbike", "safety"],
  },
  {
    id: "accommodation",
    name: "poi.accommodation",
    icon: "\u{1F3E8}",
    color: "#0891b2",
    selectors: [
      { key: "tourism", value: "hotel" },
      { key: "tourism", value: "hostel" },
      { key: "tourism", value: "guest_house" },
    ],
  },
  {
    id: "viewpoints",
    name: "poi.viewpoints",
    icon: "\u{1F441}️",
    color: "#9333ea",
    selectors: [{ key: "tourism", value: "viewpoint" }],
    profiles: ["trekking"],
  },
  {
    id: "toilets",
    name: "poi.toilets",
    icon: "\u{1F6BB}",
    color: "#6b7280",
    selectors: [{ key: "amenity", value: "toilets" }],
  },
];

export function getCategoriesForProfile(profile: string): string[] {
  return poiCategories
    .filter((c) => c.profiles?.includes(profile))
    .map((c) => c.id);
}

/**
 * Return the ids of every category whose selectors match the given OSM tags.
 * An element can belong to more than one category. Used by the POI import
 * pipeline to classify each osmium-filtered element; the serving layer reads
 * the stored category and never needs to re-classify.
 */
export function matchingCategoryIds(
  tags: Record<string, string>,
  categories: PoiCategory[] = poiCategories,
): string[] {
  return categories
    .filter((cat) => cat.selectors.some((s) => tags[s.key] === s.value))
    .map((cat) => cat.id);
}

/**
 * Render the categories' selectors as a deduplicated list of osmium
 * `tags-filter` expressions, one per distinct key=value. Each expression
 * matches nodes, ways and relations (`nwr/`), matching the previous Overpass
 * `nwr[...]` selectors. Values for the same key are grouped so the filter is
 * compact, e.g. `nwr/amenity=drinking_water,water_point`.
 */
export function osmiumTagFilters(
  categories: PoiCategory[] = poiCategories,
): string[] {
  // key -> ordered set of values (first-seen order, deduplicated)
  const byKey = new Map<string, string[]>();
  for (const cat of categories) {
    for (const { key, value } of cat.selectors) {
      const values = byKey.get(key) ?? [];
      if (!values.includes(value)) values.push(value);
      byKey.set(key, values);
    }
  }
  return [...byKey.entries()].map(([key, values]) => `nwr/${key}=${values.join(",")}`);
}

/** Profile -> tile overlay mapping */
export const profileOverlayDefaults: Record<string, string[]> = {
  fastbike: ["waymarked-cycling"],
  safety: ["waymarked-cycling"],
  trekking: ["waymarked-hiking"],
};
