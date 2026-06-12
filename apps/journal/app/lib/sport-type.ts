import type { SportType } from "@trails-cool/db/schema/journal";

/**
 * Normalize a connected service's sport/activity descriptor into our
 * `SportType` enum. Source taxonomies (Komoot's `tour.sport`, etc.) are
 * messy and evolve, so this is the single place that maps them; anything
 * without a confident match becomes `other`. This is the only spot to extend
 * when a provider adds a new descriptor.
 */
const SPORT_ALIASES: Record<string, SportType> = {
  // foot
  hike: "hike",
  hiking: "hike",
  mountaineering: "hike",
  walk: "walk",
  walking: "walk",
  snowshoe: "walk",
  jogging: "run",
  running: "run",
  run: "run",
  trailrunning: "run",
  // wheels — road / touring / city fold into `ride`
  ride: "ride",
  road: "ride",
  racebike: "ride",
  touringbicycle: "ride",
  citybike: "ride",
  e_racebike: "ride",
  e_touringbicycle: "ride",
  e_citybike: "ride",
  // gravel
  gravel: "gravel",
  gravelbike: "gravel",
  gravelride: "gravel",
  // mountain bike (incl. e-MTB and difficulty variants)
  mtb: "mtb",
  mountainbike: "mtb",
  mountainbikeeasy: "mtb",
  mountainbikeadvanced: "mtb",
  e_mountainbike: "mtb",
  // snow
  ski: "ski",
  skitour: "ski",
  nordic: "ski",
  skatingnordic: "ski",
  crosscountryski: "ski",
};

/**
 * Map a raw provider sport string to a `SportType`, or `undefined` when the
 * provider supplied nothing (so the activity is stored with no sport type
 * rather than a guessed `other`).
 */
export function mapSportType(raw: string | null | undefined): SportType | undefined {
  if (raw == null) return undefined;
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "");
  if (key === "") return undefined;
  return SPORT_ALIASES[key] ?? "other";
}
