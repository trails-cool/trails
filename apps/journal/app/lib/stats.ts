import type { SportType } from "@trails-cool/db/schema/journal";

// Minimal translate signature (the `t` returned by react-i18next satisfies it)
// so this stays a plain util with no react-i18next coupling.
type Translate = (key: string) => string;

export interface StatItem {
  label: string;
  value: string;
}

// --- pure formatters (metric baseline; an imperial toggle is future work) ---

export function formatDistanceKm(meters: number): string {
  const km = meters / 1000;
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

export function formatElevationM(meters: number): string {
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatSpeedKmh(kmh: number): string {
  return `${kmh.toFixed(1)} km/h`;
}

export function formatPace(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

// --- derived rate (pace vs speed, sport-aware) ---

const PACE_SPORTS = new Set<SportType>(["hike", "walk", "run"]);

export function deriveRate(
  distanceM: number | null | undefined,
  timeSec: number | null | undefined,
  sportType: SportType | null | undefined,
): { kind: "pace" | "speed"; value: number } | null {
  if (!distanceM || !timeSec || distanceM <= 0 || timeSec <= 0) return null;
  const km = distanceM / 1000;
  if (sportType && PACE_SPORTS.has(sportType)) {
    return { kind: "pace", value: timeSec / km };
  }
  return { kind: "speed", value: km / (timeSec / 3600) };
}

export interface ActivityStatsInput {
  distance?: number | null;
  durationSec?: number | null; // elapsed
  movingTimeSec?: number | null;
  elevationGain?: number | null;
  elevationLoss?: number | null;
  sportType?: SportType | null;
}

/**
 * Build the canonical ordered stat items for an activity or route. Order is
 * fixed (distance · time · avg pace/speed · ascent · descent); moving time, when
 * present, is shown right after elapsed time. `compact` drops moving time and
 * ascent/descent for tight surfaces (feed card, profile list) — the remaining
 * items keep the canonical order. Items with no value are omitted.
 */
export function activityStatItems(
  input: ActivityStatsInput,
  t: Translate,
  opts: { compact?: boolean } = {},
): StatItem[] {
  const { compact = false } = opts;
  const items: StatItem[] = [];

  if (input.distance != null) {
    items.push({ label: t("stats.distance"), value: formatDistanceKm(input.distance) });
  }

  const elapsed = input.durationSec;
  if (elapsed != null) {
    items.push({ label: t("stats.duration"), value: formatDuration(elapsed) });
  }
  if (!compact && input.movingTimeSec != null) {
    items.push({ label: t("stats.movingTime"), value: formatDuration(input.movingTimeSec) });
  }

  // Rate prefers moving time when available, else elapsed.
  const rate = deriveRate(input.distance, input.movingTimeSec ?? elapsed, input.sportType);
  if (rate) {
    items.push(
      rate.kind === "pace"
        ? { label: t("stats.avgPace"), value: formatPace(rate.value) }
        : { label: t("stats.avgSpeed"), value: formatSpeedKmh(rate.value) },
    );
  }

  if (!compact) {
    if (input.elevationGain != null) {
      items.push({ label: t("stats.ascent"), value: `↑ ${formatElevationM(input.elevationGain)}` });
    }
    if (input.elevationLoss != null) {
      items.push({ label: t("stats.descent"), value: `↓ ${formatElevationM(input.elevationLoss)}` });
    }
  }

  return items;
}
