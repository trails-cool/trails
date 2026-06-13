import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceKm } from "~/lib/stats";

export interface WeeklyDistanceBucket {
  weekStart: string;
  distance: number;
}

// SVG layout (user units; rendered responsive via viewBox).
const W = 480;
const H = 132;
const PAD = { top: 10, right: 6, bottom: 18, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const BASE_Y = PAD.top + PLOT_H;

function axisLabel(km: number): string {
  if (km <= 0) return "0";
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/**
 * Weekly-distance bar chart for the profile (last N weeks, oldest → newest).
 * Gridlines + a y-scale topped at the busiest week, faint per-week tracks so
 * the 12-week axis is always visible (empty weeks read as gaps, not nothing),
 * and a hover readout naming the week + its distance. Hidden when there is no
 * distance in the window.
 */
export function WeeklyDistanceChart({
  weeks,
  className,
}: {
  weeks: WeeklyDistanceBucket[];
  className?: string;
}) {
  const { t, i18n } = useTranslation("journal");
  const [hover, setHover] = useState<number | null>(null);

  const maxM = weeks.reduce((m, w) => Math.max(m, w.distance), 0);
  if (maxM <= 0) return null;

  const maxKm = maxM / 1000;
  const n = weeks.length;
  const colW = PLOT_W / n;
  const barW = colW * 0.6;
  const x = (i: number) => PAD.left + i * colW + (colW - barW) / 2;
  const yFor = (m: number) => BASE_Y - (m / maxM) * PLOT_H;

  const fmtWeek = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, { month: "short", day: "numeric" });

  const gridFracs = [0, 0.5, 1];
  const active = hover != null ? weeks[hover] : null;
  const first = weeks[0];
  const last = weeks[n - 1];
  const firstLabel = first ? fmtWeek(first.weekStart) : "";
  const lastLabel = last ? fmtWeek(last.weekStart) : "";

  return (
    <div className={className}>
      <div className="mb-1 flex items-baseline justify-between text-xs text-gray-500">
        <span>{t("profileStats.weeklyDistance")}</span>
        {active && (
          <span className="tabular-nums text-gray-700">
            {t("profileStats.weekOf", { date: fmtWeek(active.weekStart) })} ·{" "}
            <span className="font-semibold">{formatDistanceKm(active.distance)}</span>
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-28 w-full"
        role="img"
        aria-label={t("profileStats.weeklyDistance")}
        onMouseLeave={() => setHover(null)}
      >
        {/* gridlines + y-axis labels (0 · half · peak) */}
        {gridFracs.map((f) => {
          const yy = BASE_Y - f * PLOT_H;
          return (
            <g key={f}>
              <line x1={PAD.left} y1={yy} x2={W - PAD.right} y2={yy} stroke="#e5e7eb" strokeWidth="1" />
              <text x={PAD.left - 5} y={yy + 3} textAnchor="end" fontSize="9" fill="#9ca3af">
                {axisLabel(maxKm * f)}
              </text>
            </g>
          );
        })}
        {weeks.map((w, i) => {
          const isActive = hover === i;
          return (
            <g key={w.weekStart}>
              {/* faint week-slot track so empty weeks stay visible */}
              <rect
                x={x(i)}
                y={PAD.top}
                width={barW}
                height={PLOT_H}
                rx="1.5"
                fill={isActive ? "#dbeafe" : "#f3f4f6"}
              />
              {/* distance bar */}
              {w.distance > 0 && (
                <rect
                  data-week-bar
                  x={x(i)}
                  y={yFor(w.distance)}
                  width={barW}
                  height={BASE_Y - yFor(w.distance)}
                  rx="1.5"
                  fill={isActive ? "#1d4ed8" : "#3b82f6"}
                />
              )}
              {/* full-height hover hit area */}
              <rect
                x={PAD.left + i * colW}
                y={PAD.top}
                width={colW}
                height={PLOT_H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              >
                <title>{`${fmtWeek(w.weekStart)} · ${formatDistanceKm(w.distance)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between px-px text-[10px] text-gray-400">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}
