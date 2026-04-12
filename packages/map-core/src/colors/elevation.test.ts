import { describe, it, expect } from "vitest";
import { routeGradeColor, elevationColor } from "./elevation.ts";

describe("routeGradeColor", () => {
  it("returns green for flat terrain", () => {
    expect(routeGradeColor(0)).toBe("#22c55e");
    expect(routeGradeColor(2)).toBe("#22c55e");
  });

  it("returns yellow for moderate grades", () => {
    expect(routeGradeColor(4)).toBe("#eab308");
  });

  it("returns orange for steep grades", () => {
    expect(routeGradeColor(8)).toBe("#f97316");
  });

  it("returns red for very steep grades", () => {
    expect(routeGradeColor(12)).toBe("#ef4444");
  });

  it("returns dark red for extreme grades", () => {
    expect(routeGradeColor(20)).toBe("#991b1b");
  });

  it("uses absolute value for negative grades (descents)", () => {
    expect(routeGradeColor(-4)).toBe("#eab308");
    expect(routeGradeColor(-12)).toBe("#ef4444");
  });
});

describe("elevationColor", () => {
  it("returns green at t=0", () => {
    expect(elevationColor(0)).toBe("rgb(0, 200, 50)");
  });

  it("returns yellow at t=0.5", () => {
    expect(elevationColor(0.5)).toBe("rgb(255, 200, 50)");
  });

  it("returns red at t=1", () => {
    expect(elevationColor(1)).toBe("rgb(255, 0, 50)");
  });

  it("interpolates between green and yellow in lower half", () => {
    const color = elevationColor(0.25);
    expect(color).toMatch(/^rgb\(\d+, 200, 50\)$/);
  });

  it("interpolates between yellow and red in upper half", () => {
    const color = elevationColor(0.75);
    expect(color).toMatch(/^rgb\(255, \d+, 50\)$/);
  });
});
