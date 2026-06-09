import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { DayStage } from "@trails-cool/gpx";
import type { YjsState } from "~/lib/use-yjs";
import {
  SURFACE_COLORS,
  DEFAULT_SURFACE_COLOR,
  HIGHWAY_COLORS,
  DEFAULT_HIGHWAY_COLOR,
  SMOOTHNESS_COLORS,
  DEFAULT_SMOOTHNESS_COLOR,
  CYCLEWAY_COLORS,
  DEFAULT_CYCLEWAY_COLOR,
} from "@trails-cool/map-core";
import { drawElevationChart, PADDING } from "~/lib/elevation-chart-draw";
import { useElevationData } from "~/lib/use-elevation-data";
import { setColorMode, type ColorMode } from "~/lib/route-data";

interface ElevationChartProps {
  yjs: YjsState;
  onHover?: (position: [number, number] | null) => void;
  highlightDistance?: number | null;
  onClickPosition?: (position: [number, number]) => void;
  onDragSelect?: (bounds: [[number, number], [number, number]]) => void;
  days?: DayStage[];
}

export function ElevationChart({ yjs, onHover, highlightDistance, onClickPosition, onDragSelect, days }: ElevationChartProps) {
  const { t } = useTranslation("planner");
  const { points, colorMode, surfaces, highways, maxspeeds, smoothnesses, tracktypes, cycleways, bikeroutes } = useElevationData(yjs.routeData);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isExternalHover = useRef(false);
  const dragStartX = useRef<number | null>(null);
  const dragStartClientX = useRef<number | null>(null);
  const isDragging = useRef(false);
  const dragCurrentX = useRef<number | null>(null);

  // External highlight from map hover: find closest point by distance
  useEffect(() => {
    if (highlightDistance == null) {
      if (isExternalHover.current) {
        isExternalHover.current = false;
        setHoverIdx(null);
      }
      return;
    }
    if (points.length < 2) return;

    let closest = 0;
    let minDiff = Infinity;
    for (let i = 0; i < points.length; i++) {
      const diff = Math.abs(points[i]!.distance - highlightDistance);
      if (diff < minDiff) {
        minDiff = diff;
        closest = i;
      }
    }
    isExternalHover.current = true;
    setHoverIdx(closest);
  }, [highlightDistance, points]);

  const draw = useCallback(
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

      drawElevationChart(ctx, rect.width, rect.height, {
        points,
        colorMode,
        surfaces,
        highways,
        maxspeeds,
        smoothnesses,
        tracktypes,
        cycleways,
        bikeroutes,
        hoverIdx: highlightIdx,
        isDragging: isDragging.current,
        dragStartX: dragStartX.current,
        dragCurrentX: dragCurrentX.current,
        days,
      });
    },
    [points, colorMode, surfaces, highways, maxspeeds, smoothnesses, tracktypes, cycleways, bikeroutes, days],
  );

  useEffect(() => {
    draw(hoverIdx);
  }, [points, hoverIdx, colorMode, draw]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || points.length < 2) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const chartW = rect.width - PADDING.left - PADDING.right;
      const ratio = (mouseX - PADDING.left) / chartW;

      if (dragStartClientX.current != null) {
        const dx = Math.abs(e.clientX - dragStartClientX.current);
        if (dx > 5) {
          isDragging.current = true;
          dragCurrentX.current = mouseX;
          draw(hoverIdx);
          return;
        }
      }

      if (ratio < 0 || ratio > 1) {
        setHoverIdx(null);
        onHover?.(null);
        return;
      }

      const maxDist = points[points.length - 1]!.distance;
      const targetDist = ratio * maxDist;

      let closest = 0;
      let minDiff = Infinity;
      for (let i = 0; i < points.length; i++) {
        const diff = Math.abs(points[i]!.distance - targetDist);
        if (diff < minDiff) {
          minDiff = diff;
          closest = i;
        }
      }

      isExternalHover.current = false;
      setHoverIdx(closest);
      const p = points[closest]!;
      onHover?.([p.lat, p.lon]);
    },
    [points, onHover, hoverIdx, draw],
  );

  const handleMouseLeave = useCallback(() => {
    setHoverIdx(null);
    onHover?.(null);
    dragStartX.current = null;
    dragStartClientX.current = null;
    isDragging.current = false;
    dragCurrentX.current = null;
  }, [onHover]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragStartX.current = e.clientX - rect.left;
    dragStartClientX.current = e.clientX;
    isDragging.current = false;
    dragCurrentX.current = null;
  }, []);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || points.length < 2) {
        dragStartX.current = null;
        dragStartClientX.current = null;
        isDragging.current = false;
        dragCurrentX.current = null;
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const chartW = rect.width - PADDING.left - PADDING.right;
      const maxDist = points[points.length - 1]!.distance;

      if (isDragging.current && dragStartX.current != null) {
        const endX = e.clientX - rect.left;
        const startRatio = Math.max(0, Math.min(1, (dragStartX.current - PADDING.left) / chartW));
        const endRatio = Math.max(0, Math.min(1, (endX - PADDING.left) / chartW));
        const startDist = Math.min(startRatio, endRatio) * maxDist;
        const endDist = Math.max(startRatio, endRatio) * maxDist;

        let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
        let found = false;
        for (const p of points) {
          if (p.distance >= startDist && p.distance <= endDist) {
            minLat = Math.min(minLat, p.lat);
            maxLat = Math.max(maxLat, p.lat);
            minLon = Math.min(minLon, p.lon);
            maxLon = Math.max(maxLon, p.lon);
            found = true;
          }
        }
        if (found && onDragSelect) {
          onDragSelect([[minLat, minLon], [maxLat, maxLon]]);
        }
      } else if (dragStartClientX.current != null) {
        const dx = Math.abs(e.clientX - dragStartClientX.current);
        if (dx <= 5 && onClickPosition) {
          const mouseX = e.clientX - rect.left;
          const ratio = (mouseX - PADDING.left) / chartW;
          if (ratio >= 0 && ratio <= 1) {
            const targetDist = ratio * maxDist;
            let closest = 0;
            let minDiff = Infinity;
            for (let i = 0; i < points.length; i++) {
              const diff = Math.abs(points[i]!.distance - targetDist);
              if (diff < minDiff) {
                minDiff = diff;
                closest = i;
              }
            }
            onClickPosition([points[closest]!.lat, points[closest]!.lon]);
          }
        }
      }

      dragStartX.current = null;
      dragStartClientX.current = null;
      isDragging.current = false;
      dragCurrentX.current = null;
      draw(hoverIdx);
    },
    [points, onClickPosition, onDragSelect, hoverIdx, draw],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      if (e.touches.length === 1) {
        const x = e.touches[0]!.clientX - rect.left;
        dragStartX.current = x;
        dragStartClientX.current = e.touches[0]!.clientX;
        isDragging.current = false;
        dragCurrentX.current = null;
        const chartW = rect.width - PADDING.left - PADDING.right;
        const ratio = (x - PADDING.left) / chartW;
        if (ratio >= 0 && ratio <= 1 && points.length >= 2) {
          const maxDist = points[points.length - 1]!.distance;
          const targetDist = ratio * maxDist;
          let closest = 0;
          let minDiff = Infinity;
          for (let i = 0; i < points.length; i++) {
            const diff = Math.abs(points[i]!.distance - targetDist);
            if (diff < minDiff) { minDiff = diff; closest = i; }
          }
          isExternalHover.current = false;
          setHoverIdx(closest);
          const p = points[closest]!;
          onHover?.([p.lat, p.lon]);
        }
      } else if (e.touches.length === 2) {
        const x1 = e.touches[0]!.clientX - rect.left;
        const x2 = e.touches[1]!.clientX - rect.left;
        dragStartX.current = Math.min(x1, x2);
        dragCurrentX.current = Math.max(x1, x2);
        isDragging.current = true;
        draw(hoverIdx);
      }
    },
    [points, onHover, hoverIdx, draw],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas || points.length < 2) return;
      const rect = canvas.getBoundingClientRect();

      if (e.touches.length === 1 && !isDragging.current) {
        const x = e.touches[0]!.clientX - rect.left;
        const chartW = rect.width - PADDING.left - PADDING.right;
        const ratio = (x - PADDING.left) / chartW;
        if (ratio >= 0 && ratio <= 1) {
          const maxDist = points[points.length - 1]!.distance;
          const targetDist = ratio * maxDist;
          let closest = 0;
          let minDiff = Infinity;
          for (let i = 0; i < points.length; i++) {
            const diff = Math.abs(points[i]!.distance - targetDist);
            if (diff < minDiff) { minDiff = diff; closest = i; }
          }
          isExternalHover.current = false;
          setHoverIdx(closest);
          const p = points[closest]!;
          onHover?.([p.lat, p.lon]);
        }
      } else if (e.touches.length === 2) {
        const x1 = e.touches[0]!.clientX - rect.left;
        const x2 = e.touches[1]!.clientX - rect.left;
        dragStartX.current = Math.min(x1, x2);
        dragCurrentX.current = Math.max(x1, x2);
        isDragging.current = true;
        draw(hoverIdx);
      }
    },
    [points, onHover, hoverIdx, draw],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (isDragging.current && dragStartX.current != null && dragCurrentX.current != null && points.length >= 2) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const chartW = rect.width - PADDING.left - PADDING.right;
          const maxDist = points[points.length - 1]!.distance;
          const startRatio = Math.max(0, Math.min(1, (dragStartX.current - PADDING.left) / chartW));
          const endRatio = Math.max(0, Math.min(1, (dragCurrentX.current - PADDING.left) / chartW));
          const startDist = Math.min(startRatio, endRatio) * maxDist;
          const endDist = Math.max(startRatio, endRatio) * maxDist;

          let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
          let found = false;
          for (const p of points) {
            if (p.distance >= startDist && p.distance <= endDist) {
              minLat = Math.min(minLat, p.lat);
              maxLat = Math.max(maxLat, p.lat);
              minLon = Math.min(minLon, p.lon);
              maxLon = Math.max(maxLon, p.lon);
              found = true;
            }
          }
          if (found && onDragSelect) {
            onDragSelect([[minLat, minLon], [maxLat, maxLon]]);
          }
        }
      } else if (e.changedTouches.length === 1 && onClickPosition && dragStartClientX.current != null) {
        const dx = Math.abs(e.changedTouches[0]!.clientX - dragStartClientX.current);
        if (dx <= 10) {
          const canvas = canvasRef.current;
          if (canvas && points.length >= 2) {
            const rect = canvas.getBoundingClientRect();
            const chartW = rect.width - PADDING.left - PADDING.right;
            const mouseX = e.changedTouches[0]!.clientX - rect.left;
            const ratio = (mouseX - PADDING.left) / chartW;
            if (ratio >= 0 && ratio <= 1) {
              const maxDist = points[points.length - 1]!.distance;
              const targetDist = ratio * maxDist;
              let closest = 0;
              let minDiff = Infinity;
              for (let i = 0; i < points.length; i++) {
                const diff = Math.abs(points[i]!.distance - targetDist);
                if (diff < minDiff) { minDiff = diff; closest = i; }
              }
              onClickPosition([points[closest]!.lat, points[closest]!.lon]);
            }
          }
        }
      }

      setHoverIdx(null);
      onHover?.(null);
      dragStartX.current = null;
      dragStartClientX.current = null;
      isDragging.current = false;
      dragCurrentX.current = null;
      draw(null);
    },
    [points, onHover, onClickPosition, onDragSelect, draw],
  );

  const setMode = useCallback((mode: string) => {
    setColorMode(yjs.routeData, mode as ColorMode);
  }, [yjs.routeData]);

  if (points.length < 2) return null;

  return (
    <div className="border-t border-gray-200 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#7c3aed" }} />International</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#2563eb" }} />National</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#0891b2" }} />Regional</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#059669" }} />Local</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-2.5 rounded-sm" style={{ background: "#d4d4d8" }} />None</span>
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
        className="h-24 w-full cursor-crosshair touch-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}
