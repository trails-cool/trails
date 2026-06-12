import { describe, it, expect } from "vitest";
import { mapSportType } from "./sport-type.ts";

describe("mapSportType", () => {
  it("maps known foot sports", () => {
    expect(mapSportType("hike")).toBe("hike");
    expect(mapSportType("mountaineering")).toBe("hike");
    expect(mapSportType("jogging")).toBe("run");
    expect(mapSportType("running")).toBe("run");
    expect(mapSportType("walking")).toBe("walk");
  });

  it("folds road/touring/city bikes into ride", () => {
    expect(mapSportType("racebike")).toBe("ride");
    expect(mapSportType("touringbicycle")).toBe("ride");
    expect(mapSportType("citybike")).toBe("ride");
    expect(mapSportType("e_touringbicycle")).toBe("ride");
  });

  it("maps gravel and mountain bikes", () => {
    expect(mapSportType("gravelbike")).toBe("gravel");
    expect(mapSportType("mountainbike")).toBe("mtb");
    expect(mapSportType("e_mountainbike")).toBe("mtb");
    expect(mapSportType("mountainbikeadvanced")).toBe("mtb");
  });

  it("maps snow sports to ski", () => {
    expect(mapSportType("skitour")).toBe("ski");
    expect(mapSportType("skatingnordic")).toBe("ski");
  });

  it("normalizes case, whitespace, and separators", () => {
    expect(mapSportType("Mountain Bike")).toBe("mtb");
    expect(mapSportType("  HIKE  ")).toBe("hike");
    expect(mapSportType("gravel-ride")).toBe("gravel");
  });

  it("falls back to other for unrecognized non-empty input", () => {
    expect(mapSportType("unicycle")).toBe("other");
    expect(mapSportType("kitesurf")).toBe("other");
  });

  it("returns undefined when no descriptor is supplied", () => {
    expect(mapSportType(null)).toBeUndefined();
    expect(mapSportType(undefined)).toBeUndefined();
    expect(mapSportType("")).toBeUndefined();
    expect(mapSportType("   ")).toBeUndefined();
  });
});
