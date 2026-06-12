import { useTranslation } from "react-i18next";
import type { SportType } from "@trails-cool/db/schema/journal";

// Emoji glyphs as lightweight, dependency-free sport icons. The localized
// label carries the meaning; the glyph is decorative (aria-hidden).
const SPORT_EMOJI: Record<SportType, string> = {
  hike: "🥾",
  walk: "🚶",
  run: "🏃",
  ride: "🚴",
  gravel: "🚲",
  mtb: "🚵",
  ski: "⛷️",
  other: "📍",
};

/**
 * Small pill (glyph + localized label) shown next to an activity title on the
 * detail page, feed cards, and the profile list. Renders nothing when the
 * sport type is unset.
 */
export function SportBadge({
  sportType,
  className,
}: {
  sportType: SportType | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation("journal");
  if (!sportType) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700${className ? ` ${className}` : ""}`}
    >
      <span aria-hidden>{SPORT_EMOJI[sportType]}</span>
      {t(`activities.sport.${sportType}`)}
    </span>
  );
}
