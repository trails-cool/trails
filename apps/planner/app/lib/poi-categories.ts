export interface PoiCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  query: string;
  profiles?: string[];
}

export const poiCategories: PoiCategory[] = [
  {
    id: "drinking_water",
    name: "poi.drinkingWater",
    icon: "💧",
    color: "#2563eb",
    query: 'nwr["amenity"="drinking_water"];nwr["amenity"="water_point"];',
  },
  {
    id: "shelter",
    name: "poi.shelter",
    icon: "🛖",
    color: "#8B6D3A",
    query: 'nwr["amenity"="shelter"];nwr["tourism"="wilderness_hut"];',
    profiles: ["trekking"],
  },
  {
    id: "camping",
    name: "poi.camping",
    icon: "⛺",
    color: "#059669",
    query: 'nwr["tourism"="camp_site"];nwr["tourism"="caravan_site"];',
  },
  {
    id: "food",
    name: "poi.food",
    icon: "🍽️",
    color: "#dc2626",
    query: 'nwr["amenity"="restaurant"];nwr["amenity"="cafe"];nwr["amenity"="fast_food"];nwr["amenity"="pub"];nwr["amenity"="biergarten"];',
  },
  {
    id: "groceries",
    name: "poi.groceries",
    icon: "🛒",
    color: "#f97316",
    query: 'nwr["shop"="supermarket"];nwr["shop"="convenience"];nwr["shop"="bakery"];',
  },
  {
    id: "bike_infra",
    name: "poi.bikeInfra",
    icon: "🔧",
    color: "#8b5cf6",
    query: 'nwr["amenity"="bicycle_parking"];nwr["amenity"="bicycle_repair_station"];nwr["amenity"="bicycle_rental"];',
    profiles: ["fastbike", "safety"],
  },
  {
    id: "accommodation",
    name: "poi.accommodation",
    icon: "🏨",
    color: "#0891b2",
    query: 'nwr["tourism"="hotel"];nwr["tourism"="hostel"];nwr["tourism"="guest_house"];',
  },
  {
    id: "viewpoints",
    name: "poi.viewpoints",
    icon: "👁️",
    color: "#9333ea",
    query: 'nwr["tourism"="viewpoint"];',
    profiles: ["trekking"],
  },
  {
    id: "toilets",
    name: "poi.toilets",
    icon: "🚻",
    color: "#6b7280",
    query: 'nwr["amenity"="toilets"];',
  },
];

export function getCategoriesForProfile(profile: string): string[] {
  return poiCategories
    .filter((c) => c.profiles?.includes(profile))
    .map((c) => c.id);
}

/** Profile → tile overlay mapping */
export const profileOverlayDefaults: Record<string, string[]> = {
  fastbike: ["waymarked-cycling"],
  safety: ["waymarked-cycling"],
  trekking: ["waymarked-hiking"],
};
