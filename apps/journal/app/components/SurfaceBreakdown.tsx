import { useTranslation } from "react-i18next";
import {
  SURFACE_COLORS,
  DEFAULT_SURFACE_COLOR,
  HIGHWAY_COLORS,
  DEFAULT_HIGHWAY_COLOR,
} from "@trails-cool/map-core";
import { formatDistanceKm } from "~/lib/stats";

export interface SurfaceBreakdownData {
  surface: Record<string, number>;
  highway: Record<string, number>;
}

function Bar({
  title,
  data,
  colorFor,
}: {
  title: string;
  data: Record<string, number>;
  colorFor: (category: string) => string;
}) {
  const { t } = useTranslation("journal");
  const entries = Object.entries(data)
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, m]) => s + m, 0);
  if (total <= 0) return null;

  const label = (cat: string) =>
    cat === "unknown"
      ? t("surface.other")
      : t(`surface.cat.${cat}`, { defaultValue: cat.replace(/_/g, " ") });

  return (
    <div className="mt-3 first:mt-0">
      <p className="mb-1 text-xs font-medium text-gray-500">{title}</p>
      <div className="flex h-3 w-full overflow-hidden rounded">
        {entries.map(([cat, m]) => (
          <div
            key={cat}
            style={{ width: `${(m / total) * 100}%`, backgroundColor: colorFor(cat) }}
            title={`${label(cat)} · ${formatDistanceKm(m)}`}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        {entries.map(([cat, m]) => (
          <li key={cat} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: colorFor(cat) }}
              aria-hidden
            />
            <span>{label(cat)}</span>
            <span className="tabular-nums text-gray-400">
              {Math.round((m / total) * 100)}% · {formatDistanceKm(m)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Surface + waytype proportion bars (route-surface-breakdown). Renders nothing
 * when there's no breakdown data. Colours come from the shared map-core
 * palettes; unknown tags collapse into "other".
 */
export function SurfaceBreakdown({
  breakdown,
  className,
}: {
  breakdown: SurfaceBreakdownData | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation("journal");
  if (!breakdown) return null;
  const hasSurface = Object.values(breakdown.surface).some((m) => m > 0);
  const hasHighway = Object.values(breakdown.highway).some((m) => m > 0);
  if (!hasSurface && !hasHighway) return null;

  return (
    <div className={className}>
      <Bar
        title={t("surface.surface")}
        data={breakdown.surface}
        colorFor={(c) => SURFACE_COLORS[c] ?? DEFAULT_SURFACE_COLOR}
      />
      <Bar
        title={t("surface.waytype")}
        data={breakdown.highway}
        colorFor={(c) => HIGHWAY_COLORS[c] ?? DEFAULT_HIGHWAY_COLOR}
      />
    </div>
  );
}
