// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { WeeklyDistanceChart } from "./WeeklyDistanceChart.tsx";

afterEach(cleanup);

const weeks = (distances: number[]) =>
  distances.map((distance, i) => ({ weekStart: `2026-04-${String(i + 1).padStart(2, "0")}`, distance }));

describe("WeeklyDistanceChart", () => {
  it("renders nothing when every week is zero", () => {
    const { container } = render(<WeeklyDistanceChart weeks={weeks([0, 0, 0])} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one bar per week, including zero weeks (contiguous axis)", () => {
    const { container } = render(<WeeklyDistanceChart weeks={weeks([1000, 0, 2000, 0])} />);
    const bars = container.querySelectorAll("div[style]");
    expect(bars).toHaveLength(4);
  });

  it("normalizes bar heights to the busiest week", () => {
    const { container } = render(<WeeklyDistanceChart weeks={weeks([5000, 10000, 2500])} />);
    const heights = [...container.querySelectorAll("div[style]")].map(
      (b) => (b as HTMLElement).style.height,
    );
    expect(heights).toEqual(["50%", "100%", "25%"]);
  });
});
