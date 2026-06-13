import { useTranslation } from "react-i18next";
import { StatRow } from "./StatRow.tsx";
import { formatDistanceKm, formatElevationM, formatDuration } from "~/lib/stats";

// Structural shape (mirrors ActivityStats from activities.server) so this
// presentational component doesn't import from a `.server` module.
export interface ProfileStatsData {
  count: number;
  distance: number;
  elevationGain: number;
  duration: number;
  last4Weeks: number;
}

/**
 * Lifetime roll-up header on the profile: activity count · distance · ascent ·
 * elapsed time, plus a "N in the last 4 weeks" line. Renders nothing when the
 * (viewer-scoped) count is zero.
 */
export function ProfileStats({ stats, className }: { stats: ProfileStatsData; className?: string }) {
  const { t } = useTranslation("journal");
  if (stats.count === 0) return null;

  return (
    <div className={className}>
      <StatRow
        size="lg"
        items={[
          { label: t("profileStats.activities"), value: String(stats.count) },
          { label: t("profileStats.distance"), value: formatDistanceKm(stats.distance) },
          { label: t("profileStats.ascent"), value: `↑ ${formatElevationM(stats.elevationGain)}` },
          { label: t("profileStats.time"), value: formatDuration(stats.duration) },
        ]}
      />
      {stats.last4Weeks > 0 && (
        <p className="mt-2 text-sm text-gray-500">
          {t("profileStats.last4Weeks", { count: stats.last4Weeks })}
        </p>
      )}
    </div>
  );
}
