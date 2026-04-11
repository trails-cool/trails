import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { DayStage } from "@trails-cool/gpx";
import type { YjsState } from "~/lib/use-yjs";
import {
  elevationColor, maxspeedColor,
  SURFACE_COLORS, DEFAULT_SURFACE_COLOR,
  HIGHWAY_COLORS, DEFAULT_HIGHWAY_COLOR,
  SMOOTHNESS_COLORS, DEFAULT_SMOOTHNESS_COLOR,
  TRACKTYPE_COLORS, DEFAULT_TRACKTYPE_COLOR,
  CYCLEWAY_COLORS, DEFAULT_CYCLEWAY_COLOR,
  BIKEROUTE_COLORS, DEFAULT_BIKEROUTE_COLOR,
  type ColorMode,
} from "~/components/ColoredRoute";

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
  const [surfaces, setSurfaces] = useState<string[]>([]);
  const [highways, setHighways] = useState<string[]>([]);
  const [maxspeeds, setMaxspeeds] = useState<string[]>([]);
  const [smoothnesses, setSmoothnesses] = useState<string[]>([]);
  const [tracktypes, setTracktypes] = useState<string[]>([]);
  const [cycleways, setCycleways] = useState<string[]>([]);
  const [bikeroutes, setBikeroutes] = useState<string[]>([]);
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
      const surfacesJson = yjs.routeData.get("surfaces") as string | undefined;
      if (surfacesJson) {
        try { setSurfaces(JSON.parse(surfacesJson)); } catch { setSurfaces([]); }
      } else {
        setSurfaces([]);
      }
      const highwaysJson = yjs.routeData.get("highways") as string | undefined;
      if (highwaysJson) {
        try { setHighways(JSON.parse(highwaysJson)); } catch { setHighways([]); }
      } else {
        setHighways([]);
      }
      const maxspeedsJson = yjs.routeData.get("maxspeeds") as string | undefined;
      if (maxspeedsJson) {
        try { setMaxspeeds(JSON.parse(maxspeedsJson)); } catch { setMaxspeeds([]); }
      } else {
        setMaxspeeds([]);
      }
      const smoothnessesJson = yjs.routeData.get("smoothnesses") as string | undefined;
      if (smoothnessesJson) {
        try { setSmoothnesses(JSON.parse(smoothnessesJson)); } catch { setSmoothnesses([]); }
      } else {
        setSmoothnesses([]);
      }
      const tracktypesJson = yjs.routeData.get("tracktypes") as string | undefined;
      if (tracktypesJson) {
        try { setTracktypes(JSON.parse(tracktypesJson)); } catch { setTracktypes([]); }
      } else {
        setTracktypes([]);
      }
      const cyclewaysJson = yjs.routeData.get("cycleways") as string | undefined;
      if (cyclewaysJson) {
        try { setCycleways(JSON.parse(cyclewaysJson)); } catch { setCycleways([]); }
      } else {
        setCycleways([]);
      }
      const bikeroutesJson = yjs.routeData.get("bikeroutes") as string | undefined;
      if (bikeroutesJson) {
        try { setBikeroutes(JSON.parse(bikeroutesJson)); } catch { setBikeroutes([]); }
      } else {
        setBikeroutes([]);
      }
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
      } else if (colorMode === "surface" && surfaces.length >= points.length) {
        // Surface-colored segments
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i]!;
          const p1 = points[i + 1]!;
          const surface = surfaces[i] ?? "unknown";
          const color = SURFACE_COLORS[surface] ?? DEFAULT_SURFACE_COLOR;

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
      } else if (colorMode === "highway" && highways.length >= points.length) {
        // Highway-colored segments
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i]!;
          const p1 = points[i + 1]!;
          const highway = highways[i] ?? "unknown";
          const color = HIGHWAY_COLORS[highway] ?? DEFAULT_HIGHWAY_COLOR;

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
      } else if (colorMode === "maxspeed" && maxspeeds.length >= points.length) {
        // Maxspeed-colored segments
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i]!;
          const p1 = points[i + 1]!;
          const speed = maxspeeds[i] ?? "unknown";
          const color = maxspeedColor(speed);

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
      } else if (colorMode === "smoothness" && smoothnesses.length >= points.length) {
        // Smoothness-colored segments
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i]!;
          const p1 = points[i + 1]!;
          const smoothness = smoothnesses[i] ?? "unknown";
          const color = SMOOTHNESS_COLORS[smoothness] ?? DEFAULT_SMOOTHNESS_COLOR;

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
      } else if (colorMode === "tracktype" && tracktypes.length >= points.length) {
        // Track type-colored segments
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i]!;
          const p1 = points[i + 1]!;
          const tracktype = tracktypes[i] ?? "unknown";
          const color = TRACKTYPE_COLORS[tracktype] ?? DEFAULT_TRACKTYPE_COLOR;

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
      } else if (colorMode === "cycleway" && cycleways.length >= points.length) {
        // Cycleway-colored segments
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i]!;
          const p1 = points[i + 1]!;
          const cycleway = cycleways[i] ?? "unknown";
          const color = CYCLEWAY_COLORS[cycleway] ?? DEFAULT_CYCLEWAY_COLOR;

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
      } else if (colorMode === "bikeroute" && bikeroutes.length >= points.length) {
        // Bike route-colored segments
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i]!;
          const p1 = points[i + 1]!;
          const bikeroute = bikeroutes[i] ?? "none";
          const color = BIKEROUTE_COLORS[bikeroute] ?? DEFAULT_BIKEROUTE_COLOR;

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
        if (colorMode === "surface" && surfaces[highlightIdx]) {
          label += ` · ${surfaces[highlightIdx]}`;
        }
        if (colorMode === "highway" && highways[highlightIdx]) {
          label += ` · ${highways[highlightIdx]}`;
        }
        if (colorMode === "maxspeed" && maxspeeds[highlightIdx]) {
          const s = maxspeeds[highlightIdx]!;
          label += ` · ${s === "unknown" ? s : `${s} km/h`}`;
        }
        if (colorMode === "smoothness" && smoothnesses[highlightIdx]) {
          label += ` · ${smoothnesses[highlightIdx]}`;
        }
        if (colorMode === "tracktype" && tracktypes[highlightIdx]) {
          label += ` · ${tracktypes[highlightIdx]}`;
        }
        if (colorMode === "cycleway" && cycleways[highlightIdx]) {
          label += ` · ${cycleways[highlightIdx]}`;
        }
        if (colorMode === "bikeroute" && bikeroutes[highlightIdx]) {
          label += ` · ${bikeroutes[highlightIdx]}`;
        }
        const labelX = hx + 8 > w - 80 ? hx - 8 : hx + 8;
        ctx.textAlign = hx + 8 > w - 80 ? "right" : "left";
        ctx.fillText(label, labelX, PADDING.top + 10);
      }
    },
    [points, colorMode, surfaces, highways, maxspeeds, smoothnesses, tracktypes, cycleways, bikeroutes, days, t],
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
        {(() => {
          const osmLinks: Record<string, string> = {
            highway: "https://wiki.openstreetmap.org/wiki/Key:highway",
            maxspeed: "https://wiki.openstreetmap.org/wiki/Key:maxspeed",
            surface: "https://wiki.openstreetmap.org/wiki/Key:surface",
            smoothness: "https://wiki.openstreetmap.org/wiki/Key:smoothness",
            tracktype: "https://wiki.openstreetmap.org/wiki/Key:tracktype",
            cycleway: "https://wiki.openstreetmap.org/wiki/Key:cycleway",
            bikeroute: "https://wiki.openstreetmap.org/wiki/Tag:route%3Dbicycle",
          };
          const titles: Record<string, string> = {
            grade: t("elevation.grade"),
            highway: t("elevation.highway"),
            maxspeed: t("elevation.maxspeed"),
            smoothness: t("elevation.smoothness"),
            tracktype: t("elevation.tracktype"),
            cycleway: t("elevation.cycleway"),
            bikeroute: t("elevation.bikeroute"),
          };
          const title = titles[colorMode] ?? t("elevation.profile");
          const link = osmLinks[colorMode];
          return link ? (
            <a href={link} target="_blank" rel="noopener" className="shrink-0 text-xs font-medium text-gray-500 hover:text-blue-600 hover:underline">
              {title}
            </a>
          ) : (
            <p className="shrink-0 text-xs font-medium text-gray-500">{title}</p>
          );
        })()}
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
          {colorMode === "surface" && surfaces.length > 0 && (<>
            {[...new Set(surfaces)].slice(0, 6).map((s) => (
              <span key={s} className="flex items-center gap-0.5">
                <span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: SURFACE_COLORS[s] ?? DEFAULT_SURFACE_COLOR }} />
                {s}
              </span>
            ))}
            {[...new Set(surfaces)].length > 6 && <span>+{[...new Set(surfaces)].length - 6}</span>}
          </>)}
          {colorMode === "highway" && highways.length > 0 && (<>
            {[...new Set(highways)].slice(0, 6).map((h) => (
              <span key={h} className="flex items-center gap-0.5">
                <span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: HIGHWAY_COLORS[h] ?? DEFAULT_HIGHWAY_COLOR }} />
                {h}
              </span>
            ))}
            {[...new Set(highways)].length > 6 && <span>+{[...new Set(highways)].length - 6}</span>}
          </>)}
          {colorMode === "maxspeed" && (<>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#22c55e" }} />{"≤30"}</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#eab308" }} />{"≤50"}</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#f97316" }} />{"≤70"}</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#ef4444" }} />{"≤100"}</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#991b1b" }} />{"100+"}</span>
          </>)}
          {colorMode === "smoothness" && smoothnesses.length > 0 && (<>
            {[...new Set(smoothnesses)].slice(0, 6).map((s) => (
              <span key={s} className="flex items-center gap-0.5">
                <span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: SMOOTHNESS_COLORS[s] ?? DEFAULT_SMOOTHNESS_COLOR }} />
                {s}
              </span>
            ))}
            {[...new Set(smoothnesses)].length > 6 && <span>+{[...new Set(smoothnesses)].length - 6}</span>}
          </>)}
          {colorMode === "tracktype" && (<>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#22c55e" }} />grade1</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#84cc16" }} />grade2</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#eab308" }} />grade3</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#f97316" }} />grade4</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#ef4444" }} />grade5</span>
          </>)}
          {colorMode === "cycleway" && cycleways.length > 0 && (<>
            {[...new Set(cycleways)].slice(0, 6).map((c) => (
              <span key={c} className="flex items-center gap-0.5">
                <span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: CYCLEWAY_COLORS[c] ?? DEFAULT_CYCLEWAY_COLOR }} />
                {c}
              </span>
            ))}
            {[...new Set(cycleways)].length > 6 && <span>+{[...new Set(cycleways)].length - 6}</span>}
          </>)}
          {colorMode === "bikeroute" && (<>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#dc2626" }} />icn</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#f97316" }} />ncn</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#eab308" }} />rcn</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#22c55e" }} />lcn</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#d4d4d8" }} />none</span>
          </>)}
        </div>
        <select
          value={colorMode}
          onChange={(e) => setMode(e.target.value)}
          className="shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-500"
        >
          <option value="plain">{t("colorMode.plain")}</option>
          <option value="elevation">{t("colorMode.elevation")}</option>
          <option value="grade">{t("colorMode.grade")}</option>
          <option value="surface">{t("colorMode.surface")}</option>
          <option value="highway">{t("colorMode.highway")}</option>
          <option value="maxspeed">{t("colorMode.maxspeed")}</option>
          <option value="smoothness">{t("colorMode.smoothness")}</option>
          <option value="tracktype">{t("colorMode.tracktype")}</option>
          <option value="cycleway">{t("colorMode.cycleway")}</option>
          <option value="bikeroute">{t("colorMode.bikeroute")}</option>
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
