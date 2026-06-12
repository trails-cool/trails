// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { ElevationProfile } from "./ElevationProfile.tsx";
import type { ElevationSample } from "@trails-cool/gpx";

afterEach(cleanup);

const labels = { highest: "Highest", lowest: "Lowest" };

const series: ElevationSample[] = [
  { d: 0, e: 100, lat: 0, lng: 0 },
  { d: 500, e: 160, lat: 0, lng: 0.005 },
  { d: 1000, e: 120, lat: 0, lng: 0.01 },
];

describe("ElevationProfile", () => {
  it("renders nothing for a too-short series", () => {
    const { container } = render(
      <ElevationProfile series={[series[0]!]} activeIndex={null} onActive={() => {}} onSeek={() => {}} labels={labels} />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders the chart and highest/lowest summary", () => {
    const { container, getByText } = render(
      <ElevationProfile series={series} activeIndex={null} onActive={() => {}} onSeek={() => {}} labels={labels} />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
    // area + line paths
    expect(container.querySelectorAll("path").length).toBeGreaterThanOrEqual(2);
    expect(getByText("160 m")).toBeTruthy(); // highest
    expect(getByText("100 m")).toBeTruthy(); // lowest
  });

  it("draws an active marker when activeIndex is set", () => {
    const { container } = render(
      <ElevationProfile series={series} activeIndex={1} onActive={() => {}} onSeek={() => {}} labels={labels} />,
    );
    expect(container.querySelector("circle")).not.toBeNull();
    expect(container.querySelector("line")).not.toBeNull();
  });

  it("reports seek on pointer down", () => {
    const onSeek = vi.fn();
    const { container } = render(
      <ElevationProfile series={series} activeIndex={null} onActive={() => {}} onSeek={onSeek} labels={labels} />,
    );
    const svg = container.querySelector("svg")!;
    // jsdom getBoundingClientRect returns zeros; we only assert the handler fires.
    fireEvent.pointerDown(svg, { clientX: 10 });
    expect(onSeek).toHaveBeenCalledTimes(1);
  });
});
