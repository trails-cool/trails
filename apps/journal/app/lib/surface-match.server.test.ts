import { describe, it, expect } from "vitest";
import { matchSurfaces } from "./surface-match.server.ts";
import type { OverpassWay } from "./overpass-ways.server.ts";

// Two parallel ways: one along lat 0 (asphalt road), one along lat 1 (gravel track).
const ways: OverpassWay[] = [
  {
    highway: "residential",
    surface: "asphalt",
    geometry: [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 10 },
    ],
  },
  {
    highway: "track",
    surface: "gravel",
    geometry: [
      { lat: 1, lon: 0 },
      { lat: 1, lon: 10 },
    ],
  },
];

describe("matchSurfaces", () => {
  it("assigns a segment near the lat-0 way its asphalt/residential tags", () => {
    const { surfaces, highways } = matchSurfaces([[1, 0.1], [2, 0.1]], ways);
    expect(surfaces).toEqual(["asphalt"]);
    expect(highways).toEqual(["residential"]);
  });

  it("assigns a segment near the lat-1 way its gravel/track tags", () => {
    const { surfaces, highways } = matchSurfaces([[1, 0.9], [2, 0.9]], ways);
    expect(surfaces).toEqual(["gravel"]);
    expect(highways).toEqual(["track"]);
  });

  it("returns unknown when there are no candidate ways", () => {
    const { surfaces, highways } = matchSurfaces([[0, 0], [1, 0]], []);
    expect(surfaces).toEqual(["unknown"]);
    expect(highways).toEqual(["unknown"]);
  });

  it("buckets a missing surface tag as unknown but keeps the highway", () => {
    const untagged: OverpassWay[] = [{ highway: "path", geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: 10 }] }];
    const { surfaces, highways } = matchSurfaces([[1, 0], [2, 0]], untagged);
    expect(surfaces).toEqual(["unknown"]);
    expect(highways).toEqual(["path"]);
  });
});
