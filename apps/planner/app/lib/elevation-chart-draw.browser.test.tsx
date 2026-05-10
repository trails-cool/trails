import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { page } from "@vitest/browser/context";
import { drawElevationChart } from "./elevation-chart-draw";
import type { DrawChartParams } from "./elevation-chart-draw";

// 10-point synthetic route: gentle climb from 100m to 200m over 10km
const BASE_POINTS = Array.from({ length: 10 }, (_, i) => ({
  distance: i * 1000,
  elevation: 100 + i * 10,
  lat: 48 + i * 0.01,
  lon: 11 + i * 0.01,
}));

const BASE_PARAMS: DrawChartParams = {
  points: BASE_POINTS,
  colorMode: "plain",
  surfaces: [],
  highways: [],
  maxspeeds: [],
  smoothnesses: [],
  tracktypes: [],
  cycleways: [],
  bikeroutes: [],
  hoverIdx: null,
  isDragging: false,
  dragStartX: null,
  dragCurrentX: null,
};

function ChartFixture({ params }: { params: DrawChartParams }) {
  return (
    <canvas
      data-testid="chart"
      width={600}
      height={100}
      style={{ display: "block" }}
      ref={(canvas) => {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        drawElevationChart(ctx, 600, 100, params);
      }}
    />
  );
}

describe("drawElevationChart visual regression", () => {
  it("renders plain color mode", async () => {
    render(<ChartFixture params={BASE_PARAMS} />);
    await expect(page.getByTestId("chart")).toMatchScreenshot("plain.png");
  });

  it("renders grade color mode", async () => {
    render(<ChartFixture params={{ ...BASE_PARAMS, colorMode: "grade" }} />);
    await expect(page.getByTestId("chart")).toMatchScreenshot("grade.png");
  });

  it("renders elevation color mode", async () => {
    render(<ChartFixture params={{ ...BASE_PARAMS, colorMode: "elevation" }} />);
    await expect(page.getByTestId("chart")).toMatchScreenshot("elevation.png");
  });

  it("renders surface color mode", async () => {
    const surfaces = BASE_POINTS.map((_, i) =>
      i < 5 ? "asphalt" : "gravel",
    );
    render(<ChartFixture params={{ ...BASE_PARAMS, colorMode: "surface", surfaces }} />);
    await expect(page.getByTestId("chart")).toMatchScreenshot("surface.png");
  });

  it("renders hover crosshair at index 5", async () => {
    render(<ChartFixture params={{ ...BASE_PARAMS, hoverIdx: 5 }} />);
    await expect(page.getByTestId("chart")).toMatchScreenshot("hover.png");
  });

  it("renders drag selection overlay", async () => {
    render(
      <ChartFixture
        params={{
          ...BASE_PARAMS,
          isDragging: true,
          dragStartX: 100,
          dragCurrentX: 300,
        }}
      />,
    );
    await expect(page.getByTestId("chart")).toMatchScreenshot("drag-select.png");
  });
});
