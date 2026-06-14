// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SurfaceBreakdown } from "./SurfaceBreakdown.tsx";

afterEach(cleanup);

describe("SurfaceBreakdown", () => {
  it("renders nothing without a breakdown", () => {
    const { container } = render(<SurfaceBreakdown breakdown={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when every bucket is zero", () => {
    const { container } = render(<SurfaceBreakdown breakdown={{ surface: { asphalt: 0 }, highway: {} }} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a legend item per non-zero category with its percentage", () => {
    const { container, getByText } = render(
      <SurfaceBreakdown breakdown={{ surface: { asphalt: 6000, gravel: 4000 }, highway: { residential: 10000 } }} />,
    );
    // 2 surface + 1 waytype = 3 legend entries
    expect(container.querySelectorAll("li")).toHaveLength(3);
    expect(getByText(/60% · 6\.0 km/)).toBeTruthy();
    expect(getByText(/40% · 4\.0 km/)).toBeTruthy();
    expect(getByText(/100% · 10\.0 km/)).toBeTruthy();
  });

  it("sorts segments largest-first within a dimension", () => {
    const { container } = render(
      <SurfaceBreakdown breakdown={{ surface: { gravel: 3000, asphalt: 7000 }, highway: {} }} />,
    );
    // first bar's first segment is the larger (asphalt 70%)
    const firstBar = container.querySelector("div.flex.h-3");
    const widths = [...firstBar!.querySelectorAll("div")].map((d) => (d as HTMLElement).style.width);
    expect(widths[0]).toBe("70%");
    expect(widths[1]).toBe("30%");
  });
});
