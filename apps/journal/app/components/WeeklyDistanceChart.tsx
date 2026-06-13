import { useTranslation } from "react-i18next";
import { formatDistanceKm } from "~/lib/stats";

export interface WeeklyDistanceBucket {
  weekStart: string;
  distance: number;
}

/**
 * Compact weekly-distance bar chart for the profile (last N weeks, oldest →
 * newest). Bars are normalized to the busiest week; empty weeks keep their slot
 * as a zero-height bar so the axis stays contiguous. Renders nothing when there
 * is no distance in the window.
 */
export function WeeklyDistanceChart({
  weeks,
  className,
}: {
  weeks: WeeklyDistanceBucket[];
  className?: string;
}) {
  const { t } = useTranslation("journal");
  const max = weeks.reduce((m, w) => Math.max(m, w.distance), 0);
  if (max <= 0) return null;

  return (
    <div className={className}>
      <p className="mb-1 text-xs text-gray-500">{t("profileStats.weeklyDistance")}</p>
      <div className="flex h-16 items-end gap-1" role="img" aria-label={t("profileStats.weeklyDistance")}>
        {weeks.map((w) => (
          <div
            key={w.weekStart}
            className="flex-1 rounded-t bg-blue-500/70"
            style={{ height: `${(w.distance / max) * 100}%` }}
            title={formatDistanceKm(w.distance)}
          />
        ))}
      </div>
    </div>
  );
}
