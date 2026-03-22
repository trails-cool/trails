import { useEffect, useState, useRef } from "react";
import type { YjsState } from "~/lib/use-yjs";

interface ElevationPoint {
  distance: number; // meters from start
  elevation: number; // meters
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
        points.push({ distance: totalDist, elevation: coords[i]![2]! });
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

export function ElevationChart({ yjs }: { yjs: YjsState }) {
  const [points, setPoints] = useState<ElevationPoint[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const update = () => {
      const geojson = yjs.routeData.get("geojson") as string | undefined;
      if (geojson) {
        setPoints(extractElevation(geojson));
      } else {
        setPoints([]);
      }
    };
    yjs.routeData.observe(update);
    update();
    return () => yjs.routeData.unobserve(update);
  }, [yjs.routeData]);

  useEffect(() => {
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
    const padding = { top: 10, right: 10, bottom: 25, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const maxDist = points[points.length - 1]!.distance;
    const elevations = points.map((p) => p.elevation);
    const minEle = Math.min(...elevations);
    const maxEle = Math.max(...elevations);
    const eleRange = maxEle - minEle || 1;

    ctx.clearRect(0, 0, w, h);

    // Fill area
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartH);
    for (const p of points) {
      const x = padding.left + (p.distance / maxDist) * chartW;
      const y = padding.top + chartH - ((p.elevation - minEle) / eleRange) * chartH;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = "rgba(37, 99, 235, 0.15)";
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      const x = padding.left + (p.distance / maxDist) * chartW;
      const y = padding.top + chartH - ((p.elevation - minEle) / eleRange) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(maxEle)}m`, padding.left - 4, padding.top + 10);
    ctx.fillText(`${Math.round(minEle)}m`, padding.left - 4, padding.top + chartH);
    ctx.textAlign = "center";
    ctx.fillText("0 km", padding.left, h - 4);
    ctx.fillText(`${(maxDist / 1000).toFixed(1)} km`, padding.left + chartW, h - 4);
  }, [points]);

  if (points.length < 2) return null;

  return (
    <div className="border-t border-gray-200 px-2 py-2">
      <p className="mb-1 px-2 text-xs font-medium text-gray-500">Elevation Profile</p>
      <canvas ref={canvasRef} className="h-24 w-full" />
    </div>
  );
}
