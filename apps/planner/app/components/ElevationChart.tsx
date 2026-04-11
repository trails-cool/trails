import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { DayStage } from "@trails-cool/gpx";
import type { YjsState } from "~/lib/use-yjs";
import { elevationColor, type ColorMode } from "~/components/ColoredRoute";

function gradeColor(grade: number): string {
  const absGrade = Math.abs(grade);
  if (absGrade < 3) return "#22c55e";     // green: flat/gentle
  if (absGrade < 6) return "#eab308";     // yellow: moderate
  if (absGrade < 10) return "#f97316";    // orange: steep
  if (absGrade < 15) return "#ef4444";    // red: very steep
  return "#991b1b";                        // dark red: extreme
}

interface ElevationPoint {
  distance: number;
  elevation: number;
  lat: number;
  lon: number;
}

function extractElevation(geojsonStr: string): ElevationPoint[] {
  try {
    const geojson = JSON.parse(geojsonStr);
    const coords: number[][] = geojson.features?.[0]?.geometry?.coordinates ?? [];
    if (coords.length === 0) return [];

    const points: ElevationPoint[] = [];
    let totalDist = 0;

    for (let i = 0; i < coords.length; i++) {
      if (i > 0) {
        const prev = coords[i - 1]!;
        const curr = coords[i]!;
        totalDist += haversine(prev[1]!, prev[0]!, curr[1]!, curr[0]!);
      }
      if (coords[i]![2] !== undefined) {
        points.push({
          distance: totalDist,
          elevation: coords[i]![2]!,
          lat: coords[i]![1]!,
          lon: coords[i]![0]!,
        });
      }
    }
    return points;
  } catch {
    return [];
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PADDING = { top: 10, right: 10, bottom: 25, left: 40 };

interface ElevationChartProps {
  yjs: YjsState;
  onHover?: (position: [number, number] | null) => void;
  days?: DayStage[];
}

export function ElevationChart({ yjs, onHover, days }: ElevationChartProps) {
  const { t } = useTranslation("planner");
  const [points, setPoints] = useState<ElevationPoint[]>([]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("plain");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<ElevationPoint[]>([]);
  pointsRef.current = points;

  useEffect(() => {
    const update = () => {
      const geojson = yjs.routeData.get("geojson") as string | undefined;
      if (geojson) {
        setPoints(extractElevation(geojson));
      } else {
        setPoints([]);
      }
      const mode = yjs.routeData.get("colorMode") as ColorMode | undefined;
      setColorMode(mode ?? "plain");
    };
    yjs.routeData.observe(update);
    update();
    return () => yjs.routeData.unobserve(update);
  }, [yjs.routeData]);

  const drawChart = useCallback(
    (highlightIdx: number | null) => {
      const canvas = canvasRef.current;
      if (!canvas || points.length < 2) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
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
        // Grade-colored segments: color by steepness
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i]!;
          const p1 = points[i + 1]!;
          const dDist = p1.distance - p0.distance;
          const grade = dDist > 0 ? ((p1.elevation - p0.elevation) / dDist) * 100 : 0;
          const color = gradeColor(grade);

          // Fill segment
          ctx.beginPath();
          ctx.moveTo(toX(p0.distance), PADDING.top + chartH);
          ctx.lineTo(toX(p0.distance), toY(p0.elevation));
          ctx.lineTo(toX(p1.distance), toY(p1.elevation));
          ctx.lineTo(toX(p1.distance), PADDING.top + chartH);
          ctx.closePath();
          ctx.fillStyle = color.replace(")", ", 0.25)").replace("rgb", "rgba").replace("#", "");
          // hex to rgba fill
          ctx.fillStyle = color + "40";
          ctx.fill();

          // Line segment
          ctx.beginPath();
          ctx.moveTo(toX(p0.distance), toY(p0.elevation));
          ctx.lineTo(toX(p1.distance), toY(p1.elevation));
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else if (colorMode === "elevation") {
        // Elevation-colored fill and line segments
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i]!;
          const p1 = points[i + 1]!;
          const t = (p0.elevation - minEle) / eleRange;
          const color = elevationColor(t);

          // Fill segment
          ctx.beginPath();
          ctx.moveTo(toX(p0.distance), PADDING.top + chartH);
          ctx.lineTo(toX(p0.distance), toY(p0.elevation));
          ctx.lineTo(toX(p1.distance), toY(p1.elevation));
          ctx.lineTo(toX(p1.distance), PADDING.top + chartH);
          ctx.closePath();
          ctx.fillStyle = color.replace("rgb", "rgba").replace(")", ", 0.2)");
          ctx.fill();

          // Line segment
          ctx.beginPath();
          ctx.moveTo(toX(p0.distance), toY(p0.elevation));
          ctx.lineTo(toX(p1.distance), toY(p1.elevation));
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else {
        // Plain fill and line
        ctx.beginPath();
        ctx.moveTo(PADDING.left, PADDING.top + chartH);
        for (const p of points) {
          ctx.lineTo(toX(p.distance), toY(p.elevation));
        }
        ctx.lineTo(PADDING.left + chartW, PADDING.top + chartH);
        ctx.closePath();
        ctx.fillStyle = "rgba(37, 99, 235, 0.15)";
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
          // Find the point closest to the day boundary distance
          const boundaryDist = days.slice(0, d + 1).reduce((sum, s) => sum + s.distance, 0);
          const bx = toX(boundaryDist);

          // Dashed vertical line
          ctx.beginPath();
          ctx.setLineDash([4, 3]);
          ctx.moveTo(bx, PADDING.top);
          ctx.lineTo(bx, PADDING.top + chartH);
          ctx.strokeStyle = "#9A9484";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.setLineDash([]);

          // Day label at top
          ctx.fillStyle = "#9A9484";
          ctx.font = "9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${(boundaryDist / 1000).toFixed(0)} km`, bx, h - 4);
        }
      }

      // Hover crosshair + info
      if (highlightIdx !== null && highlightIdx >= 0 && highlightIdx < points.length) {
        const p = points[highlightIdx]!;
        const hx = toX(p.distance);
        const hy = toY(p.elevation);

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(hx, PADDING.top);
        ctx.lineTo(hx, PADDING.top + chartH);
        ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Dot
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Info label
        ctx.fillStyle = "#1f2937";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "left";
        let label = `${Math.round(p.elevation)}m · ${(p.distance / 1000).toFixed(1)}km`;
        if (colorMode === "grade" && highlightIdx > 0) {
          const prev = points[highlightIdx - 1]!;
          const dDist = p.distance - prev.distance;
          const grade = dDist > 0 ? ((p.elevation - prev.elevation) / dDist) * 100 : 0;
          label += ` · ${grade > 0 ? "+" : ""}${grade.toFixed(1)}%`;
        }
        const labelX = hx + 8 > w - 80 ? hx - 8 : hx + 8;
        ctx.textAlign = hx + 8 > w - 80 ? "right" : "left";
        ctx.fillText(label, labelX, PADDING.top + 10);
      }
    },
    [points, colorMode, days, t],
  );

  useEffect(() => {
    drawChart(hoverIdx);
  }, [points, hoverIdx, colorMode, drawChart]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || points.length < 2) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const chartW = rect.width - PADDING.left - PADDING.right;
      const ratio = (mouseX - PADDING.left) / chartW;

      if (ratio < 0 || ratio > 1) {
        setHoverIdx(null);
        onHover?.(null);
        return;
      }

      const maxDist = points[points.length - 1]!.distance;
      const targetDist = ratio * maxDist;

      // Find closest point
      let closest = 0;
      let minDiff = Infinity;
      for (let i = 0; i < points.length; i++) {
        const diff = Math.abs(points[i]!.distance - targetDist);
        if (diff < minDiff) {
          minDiff = diff;
          closest = i;
        }
      }

      setHoverIdx(closest);
      const p = points[closest]!;
      onHover?.([p.lat, p.lon]);
    },
    [points, onHover],
  );

  const handleMouseLeave = useCallback(() => {
    setHoverIdx(null);
    onHover?.(null);
  }, [onHover]);

  const setMode = useCallback((mode: string) => {
    yjs.routeData.set("colorMode", mode);
  }, [yjs.routeData]);

  if (points.length < 2) return null;

  return (
    <div className="border-t border-gray-200 px-2 py-2">
      <div className="mb-1 flex items-center gap-2 px-2">
        <p className="shrink-0 text-xs font-medium text-gray-500">
          {colorMode === "grade" ? t("elevation.grade") : t("elevation.profile")}
        </p>
        <div className="flex flex-1 items-center justify-center gap-1.5 text-[10px] text-gray-400">
          {colorMode === "grade" && (<>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#22c55e" }} />{"<3%"}</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#eab308" }} />{"<6%"}</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#f97316" }} />{"<10%"}</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#ef4444" }} />{"<15%"}</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#991b1b" }} />{"15%+"}</span>
          </>)}
          {colorMode === "elevation" && (<>
            <span>{Math.round(Math.min(...points.map(p => p.elevation)))}m</span>
            <span className="inline-block h-1.5 w-16 rounded-sm" style={{ background: "linear-gradient(to right, rgb(0, 200, 50), rgb(255, 200, 50), rgb(255, 0, 50))" }} />
            <span>{Math.round(Math.max(...points.map(p => p.elevation)))}m</span>
          </>)}
          {colorMode === "surface" && (
            <span>{t("colorMode.surfaceLegend")}</span>
          )}
        </div>
        <select
          value={colorMode}
          onChange={(e) => setMode(e.target.value)}
          className="shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-500"
        >
          <option value="plain">{t("colorMode.plain")}</option>
          <option value="elevation">{t("colorMode.elevation")}</option>
          <option value="surface">{t("colorMode.surface")}</option>
          <option value="grade">{t("colorMode.grade")}</option>
        </select>
      </div>
      <canvas
        ref={canvasRef}
        className="h-24 w-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
