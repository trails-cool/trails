import {
  elevationColor,
  maxspeedColor,
  SURFACE_COLORS,
  DEFAULT_SURFACE_COLOR,
  HIGHWAY_COLORS,
  DEFAULT_HIGHWAY_COLOR,
  SMOOTHNESS_COLORS,
  DEFAULT_SMOOTHNESS_COLOR,
  TRACKTYPE_COLORS,
  DEFAULT_TRACKTYPE_COLOR,
  CYCLEWAY_COLORS,
  DEFAULT_CYCLEWAY_COLOR,
  BIKEROUTE_COLORS,
  DEFAULT_BIKEROUTE_COLOR,
} from "@trails-cool/map-core";
import type { ColorMode } from "~/components/ColoredRoute";
import type { DayStage } from "@trails-cool/gpx";

export interface ElevationPoint {
  distance: number;
  elevation: number;
  lat: number;
  lon: number;
}

function gradeColor(grade: number): string {
  const absGrade = Math.abs(grade);
  if (absGrade < 3) return "#22c55e";
  if (absGrade < 6) return "#eab308";
  if (absGrade < 10) return "#f97316";
  if (absGrade < 15) return "#ef4444";
  return "#991b1b";
}

export const PADDING = { top: 10, right: 10, bottom: 25, left: 40 };

export interface DrawChartParams {
  points: ElevationPoint[];
  colorMode: ColorMode;
  surfaces: string[];
  highways: string[];
  maxspeeds: string[];
  smoothnesses: string[];
  tracktypes: string[];
  cycleways: string[];
  bikeroutes: string[];
  hoverIdx: number | null;
  isDragging: boolean;
  dragStartX: number | null;
  dragCurrentX: number | null;
  days?: DayStage[];
}

function drawSegments(
  ctx: CanvasRenderingContext2D,
  points: ElevationPoint[],
  chartH: number,
  getColor: (i: number) => string,
  toX: (d: number) => number,
  toY: (e: number) => number,
) {
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const color = getColor(i);

    ctx.beginPath();
    ctx.moveTo(toX(p0.distance), PADDING.top + chartH);
    ctx.lineTo(toX(p0.distance), toY(p0.elevation));
    ctx.lineTo(toX(p1.distance), toY(p1.elevation));
    ctx.lineTo(toX(p1.distance), PADDING.top + chartH);
    ctx.closePath();
    ctx.fillStyle = color + "40";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(toX(p0.distance), toY(p0.elevation));
    ctx.lineTo(toX(p1.distance), toY(p1.elevation));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export function drawElevationChart(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: DrawChartParams,
): void {
  const {
    points,
    colorMode,
    surfaces,
    highways,
    maxspeeds,
    smoothnesses,
    tracktypes,
    cycleways,
    bikeroutes,
    hoverIdx,
    isDragging,
    dragStartX,
    dragCurrentX,
    days,
  } = params;

  if (points.length < 2) return;

  const w = width;
  const h = height;
  const chartW = w - PADDING.left - PADDING.right;
  const chartH = h - PADDING.top - PADDING.bottom;

  const maxDist = points[points.length - 1]!.distance;
  const elevations = points.map((p) => p.elevation);
  const minEle = Math.min(...elevations);
  const maxEle = Math.max(...elevations);
  const eleRange = maxEle - minEle || 1;

  const toX = (d: number) => PADDING.left + (d / maxDist) * chartW;
  const toY = (e: number) => PADDING.top + chartH - ((e - minEle) / eleRange) * chartH;

  ctx.clearRect(0, 0, w, h);

  if (colorMode === "grade") {
    drawSegments(ctx, points, chartH, (i) => {
      const p0 = points[i]!;
      const p1 = points[i + 1]!;
      const dDist = p1.distance - p0.distance;
      const grade = dDist > 0 ? ((p1.elevation - p0.elevation) / dDist) * 100 : 0;
      return gradeColor(grade);
    }, toX, toY);
  } else if (colorMode === "elevation") {
    // elevationColor returns rgb(...), not hex, so we can't use hex alpha suffix
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]!;
      const p1 = points[i + 1]!;
      const t = (p0.elevation - minEle) / eleRange;
      const color = elevationColor(t);

      ctx.beginPath();
      ctx.moveTo(toX(p0.distance), PADDING.top + chartH);
      ctx.lineTo(toX(p0.distance), toY(p0.elevation));
      ctx.lineTo(toX(p1.distance), toY(p1.elevation));
      ctx.lineTo(toX(p1.distance), PADDING.top + chartH);
      ctx.closePath();
      ctx.fillStyle = color.replace("rgb", "rgba").replace(")", ", 0.2)");
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(toX(p0.distance), toY(p0.elevation));
      ctx.lineTo(toX(p1.distance), toY(p1.elevation));
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else if (colorMode === "surface" && surfaces.length >= points.length) {
    drawSegments(ctx, points, chartH, (i) => SURFACE_COLORS[surfaces[i] ?? "unknown"] ?? DEFAULT_SURFACE_COLOR, toX, toY);
  } else if (colorMode === "highway" && highways.length >= points.length) {
    drawSegments(ctx, points, chartH, (i) => HIGHWAY_COLORS[highways[i] ?? "unknown"] ?? DEFAULT_HIGHWAY_COLOR, toX, toY);
  } else if (colorMode === "maxspeed" && maxspeeds.length >= points.length) {
    drawSegments(ctx, points, chartH, (i) => maxspeedColor(maxspeeds[i] ?? "unknown"), toX, toY);
  } else if (colorMode === "smoothness" && smoothnesses.length >= points.length) {
    drawSegments(ctx, points, chartH, (i) => SMOOTHNESS_COLORS[smoothnesses[i] ?? "unknown"] ?? DEFAULT_SMOOTHNESS_COLOR, toX, toY);
  } else if (colorMode === "tracktype" && tracktypes.length >= points.length) {
    drawSegments(ctx, points, chartH, (i) => TRACKTYPE_COLORS[tracktypes[i] ?? "unknown"] ?? DEFAULT_TRACKTYPE_COLOR, toX, toY);
  } else if (colorMode === "cycleway" && cycleways.length >= points.length) {
    drawSegments(ctx, points, chartH, (i) => CYCLEWAY_COLORS[cycleways[i] ?? "unknown"] ?? DEFAULT_CYCLEWAY_COLOR, toX, toY);
  } else if (colorMode === "bikeroute" && bikeroutes.length >= points.length) {
    drawSegments(ctx, points, chartH, (i) => BIKEROUTE_COLORS[bikeroutes[i] ?? "none"] ?? DEFAULT_BIKEROUTE_COLOR, toX, toY);
  } else {
    // Plain fill and line
    ctx.beginPath();
    ctx.moveTo(PADDING.left, PADDING.top + chartH);
    for (const p of points) {
      ctx.lineTo(toX(p.distance), toY(p.elevation));
    }
    ctx.lineTo(PADDING.left + chartW, PADDING.top + chartH);
    ctx.closePath();
    ctx.fillStyle = "rgba(220, 38, 38, 0.8)"; // demo: vivid red fill to trigger visual regression
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      if (i === 0) ctx.moveTo(toX(p.distance), toY(p.elevation));
      else ctx.lineTo(toX(p.distance), toY(p.elevation));
    }
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Axis labels
  ctx.fillStyle = "#6b7280";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`${Math.round(maxEle)}m`, PADDING.left - 4, PADDING.top + 10);
  ctx.fillText(`${Math.round(minEle)}m`, PADDING.left - 4, PADDING.top + chartH);
  ctx.textAlign = "center";
  ctx.fillText("0 km", PADDING.left, h - 4);
  ctx.fillText(`${(maxDist / 1000).toFixed(1)} km`, PADDING.left + chartW, h - 4);

  // Day dividers
  if (days && days.length > 1) {
    for (let d = 0; d < days.length - 1; d++) {
      const boundaryDist = days.slice(0, d + 1).reduce((sum, s) => sum + s.distance, 0);
      const bx = toX(boundaryDist);

      ctx.beginPath();
      ctx.setLineDash([4, 3]);
      ctx.moveTo(bx, PADDING.top);
      ctx.lineTo(bx, PADDING.top + chartH);
      ctx.strokeStyle = "#9A9484";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#9A9484";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${(boundaryDist / 1000).toFixed(0)} km`, bx, h - 4);
    }
  }

  // Hover crosshair + info
  if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < points.length) {
    const p = points[hoverIdx]!;
    const hx = toX(p.distance);
    const hy = toY(p.elevation);

    ctx.beginPath();
    ctx.moveTo(hx, PADDING.top);
    ctx.lineTo(hx, PADDING.top + chartH);
    ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(hx, hy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "left";
    let label = `${Math.round(p.elevation)}m · ${(p.distance / 1000).toFixed(1)}km`;
    if (colorMode === "grade" && hoverIdx > 0) {
      const prev = points[hoverIdx - 1]!;
      const dDist = p.distance - prev.distance;
      const grade = dDist > 0 ? ((p.elevation - prev.elevation) / dDist) * 100 : 0;
      label += ` · ${grade > 0 ? "+" : ""}${grade.toFixed(1)}%`;
    }
    if (colorMode === "surface" && surfaces[hoverIdx]) label += ` · ${surfaces[hoverIdx]}`;
    if (colorMode === "highway" && highways[hoverIdx]) label += ` · ${highways[hoverIdx]}`;
    if (colorMode === "maxspeed" && maxspeeds[hoverIdx]) {
      const s = maxspeeds[hoverIdx]!;
      label += ` · ${s === "unknown" ? s : `${s} km/h`}`;
    }
    if (colorMode === "smoothness" && smoothnesses[hoverIdx]) label += ` · ${smoothnesses[hoverIdx]}`;
    if (colorMode === "tracktype" && tracktypes[hoverIdx]) label += ` · ${tracktypes[hoverIdx]}`;
    if (colorMode === "cycleway" && cycleways[hoverIdx]) label += ` · ${cycleways[hoverIdx]}`;
    if (colorMode === "bikeroute" && bikeroutes[hoverIdx]) {
      const names: Record<string, string> = { icn: "International", ncn: "National", rcn: "Regional", lcn: "Local", none: "None" };
      label += ` · ${names[bikeroutes[hoverIdx]!] ?? bikeroutes[hoverIdx]}`;
    }
    const labelX = hx + 8 > w - 80 ? hx - 8 : hx + 8;
    ctx.textAlign = hx + 8 > w - 80 ? "right" : "left";
    ctx.fillText(label, labelX, PADDING.top + 10);
  }

  // Drag selection overlay
  if (isDragging && dragStartX != null && dragCurrentX != null) {
    const x1 = Math.max(PADDING.left, Math.min(dragStartX, PADDING.left + chartW));
    const x2 = Math.max(PADDING.left, Math.min(dragCurrentX, PADDING.left + chartW));
    const selLeft = Math.min(x1, x2);
    const selRight = Math.max(x1, x2);
    ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
    ctx.fillRect(selLeft, PADDING.top, selRight - selLeft, chartH);
    ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(selLeft, PADDING.top, selRight - selLeft, chartH);
  }
}
