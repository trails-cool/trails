import { describe, it, expect } from "vitest";
import { maxspeedColor } from "./maxspeed.ts";

describe("maxspeedColor", () => {
  it("returns green for walking speed", () => {
    expect(maxspeedColor("walk")).toBe("#22c55e");
  });

  it("returns dark red for no speed limit", () => {
    expect(maxspeedColor("none")).toBe("#991b1b");
  });

  it("returns green for low speeds", () => {
    expect(maxspeedColor("20")).toBe("#22c55e");
    expect(maxspeedColor("30")).toBe("#22c55e");
  });

  it("returns yellow for moderate speeds", () => {
    expect(maxspeedColor("50")).toBe("#eab308");
  });

  it("returns orange for higher speeds", () => {
    expect(maxspeedColor("70")).toBe("#f97316");
  });

  it("returns red for fast speeds", () => {
    expect(maxspeedColor("100")).toBe("#ef4444");
  });

  it("returns dark red for very fast speeds", () => {
    expect(maxspeedColor("130")).toBe("#991b1b");
  });

  it("returns gray for unknown values", () => {
    expect(maxspeedColor("unknown")).toBe("#9ca3af");
    expect(maxspeedColor("")).toBe("#9ca3af");
  });
});
