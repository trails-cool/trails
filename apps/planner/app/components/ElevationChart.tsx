import { useEffect, useState, useRef, useCallback } from "react";
import type { YjsState } from "~/lib/use-yjs";
import { elevationColor, type ColorMode } from "~/components/ColoredRoute";

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
}

export function ElevationChart({ yjs, onHover }: ElevationChartProps) {
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

      if (colorMode === "elevation") {
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
        const label = `${Math.round(p.elevation)}m · ${(p.distance / 1000).toFixed(1)}km`;
        const labelX = hx + 8 > w - 80 ? hx - 8 : hx + 8;
        ctx.textAlign = hx + 8 > w - 80 ? "right" : "left";
        ctx.fillText(label, labelX, PADDING.top + 10);
      }
    },
    [points, colorMode],
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

  if (points.length < 2) return null;

  return (
    <div className="border-t border-gray-200 px-2 py-2">
      <p className="mb-1 px-2 text-xs font-medium text-gray-500">Elevation Profile</p>
      <canvas
        ref={canvasRef}
        className="h-24 w-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
