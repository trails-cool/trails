import { useRef } from "react";
import type { ElevationSample } from "@trails-cool/gpx";
import { formatElevationM, formatDistanceKm } from "~/lib/stats";

const W = 1000;
const H = 220;
const PAD = { top: 16, right: 8, bottom: 22, left: 46 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/**
 * Read-only elevation profile chart (SVG, responsive via viewBox). Distance on
 * x, elevation on y, with a gradient area fill. Reports the hovered sample
 * index via `onActive` (for the map marker) and the clicked index via `onSeek`
 * (centre the map), and draws a marker at `activeIndex` (set by the map when the
 * route line is hovered). Renders nothing for an empty/too-short series.
 */
export function ElevationProfile({
  series,
  activeIndex,
  onActive,
  onSeek,
  labels,
  className,
}: {
  series: ElevationSample[];
  activeIndex: number | null;
  onActive: (index: number | null) => void;
  onSeek: (index: number) => void;
  labels: { highest: string; lowest: string };
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  if (series.length < 2) return null;

  const maxD = series[series.length - 1]!.d || 1;
  let minE = Infinity;
  let maxE = -Infinity;
  for (const s of series) {
    if (s.e < minE) minE = s.e;
    if (s.e > maxE) maxE = s.e;
  }
  const eRange = Math.max(1, maxE - minE);
  const baseY = PAD.top + PLOT_H;

  const x = (d: number) => PAD.left + (d / maxD) * PLOT_W;
  const y = (e: number) => PAD.top + (1 - (e - minE) / eRange) * PLOT_H;

  const linePath = series
    .map((s, i) => `${i === 0 ? "M" : "L"}${x(s.d).toFixed(1)},${y(s.e).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${x(maxD).toFixed(1)},${baseY} L${PAD.left},${baseY} Z`;

  const active = activeIndex != null ? series[activeIndex] : null;

  function indexFromClientX(clientX: number): number {
    const rect = ref.current!.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W; // → SVG user units
    const d = ((px - PAD.left) / PLOT_W) * maxD;
    let best = 0;
    let bestDelta = Infinity;
    for (let i = 0; i < series.length; i++) {
      const delta = Math.abs(series[i]!.d - d);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = i;
      }
    }
    return best;
  }

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
        <span>
          {labels.highest} <span className="font-semibold text-gray-900">{formatElevationM(maxE)}</span>
          {" · "}
          {labels.lowest} <span className="font-semibold text-gray-900">{formatElevationM(minE)}</span>
        </span>
        {active && (
          <span className="tabular-nums">
            {formatDistanceKm(active.d)} · {formatElevationM(active.e)}
          </span>
        )}
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-40 w-full touch-none select-none"
        role="img"
        aria-label="Elevation profile"
        onPointerMove={(e) => onActive(indexFromClientX(e.clientX))}
        onPointerLeave={() => onActive(null)}
        onPointerDown={(e) => onSeek(indexFromClientX(e.clientX))}
      >
        <defs>
          <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#elev-fill)" />
        <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {active && (
          <g>
            <line
              x1={x(active.d)}
              y1={PAD.top}
              x2={x(active.d)}
              y2={baseY}
              stroke="#9ca3af"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={x(active.d)} cy={y(active.e)} r="4" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
          </g>
        )}
      </svg>
    </div>
  );
}
