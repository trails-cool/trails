// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { WeeklyDistanceChart } from "./WeeklyDistanceChart.tsx";

afterEach(cleanup);

const weeks = (distances: number[]) =>
  distances.map((distance, i) => ({ weekStart: `2026-04-${String(i + 1).padStart(2, "0")}`, distance }));

describe("WeeklyDistanceChart", () => {
  it("renders nothing when every week is zero", () => {
    const { container } = render(<WeeklyDistanceChart weeks={weeks([0, 0, 0])} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the chart with a bar only for non-zero weeks", () => {
    const { container } = render(<WeeklyDistanceChart weeks={weeks([5000, 0, 2500, 0])} />);
    expect(container.querySelector("svg")).not.toBeNull();
    // bars only for the two non-zero weeks; empty weeks keep their slot via the track rect
    expect(container.querySelectorAll("[data-week-bar]")).toHaveLength(2);
  });

  it("tops the y-scale at the busiest week", () => {
    const { getByText } = render(<WeeklyDistanceChart weeks={weeks([5000, 10000, 2500])} />);
    // peak gridline label = 10 km (>= 10 → integer)
    expect(getByText("10 km")).toBeTruthy();
    // half gridline
    expect(getByText("5.0 km")).toBeTruthy();
  });

  it("shows a hover readout with the week's distance", () => {
    // max 8 km → axis labels are 8.0 / 4.0 / 0 km; "3.0 km" is unique to the
    // readout for week 0, so it only appears once that week is hovered.
    const { container, queryByText } = render(<WeeklyDistanceChart weeks={weeks([3000, 8000])} />);
    expect(queryByText("3.0 km")).toBeNull();
    const hit = container.querySelectorAll("rect[fill='transparent']")[0]!;
    fireEvent.mouseEnter(hit);
    expect(queryByText("3.0 km")).not.toBeNull();
  });
});
