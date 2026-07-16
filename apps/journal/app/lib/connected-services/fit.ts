// Shared FIT file → GPX converter for provider importers.
//
// FIT is an open standard (Garmin/ANT+) used by Wahoo, Garmin, Coros, and
// others. This module is the single conversion seam for every provider that
// produces FIT files.
//
// Beyond flattening records to a track, it is pause- and session-aware:
//   - timer stop/start events (or, as a fallback, record gaps > 5 min) split
//     the output into multiple <trkseg>s, so downstream moving-time and speed
//     math never bridges a pause;
//   - multi-session (multisport) files emit one-or-more segments per session,
//     records sliced to each session's time window (still one activity);
//   - it prefers the corrected `enhanced_altitude`, validates coordinates, and
//     surfaces the file's sport mapped to the Journal's SportType.
//
// Validation policy intentionally mirrors gpx-parser-robustness so both import
// formats behave identically downstream.

import FitParser from "fit-file-parser";
import { generateGpx, type TrackPoint } from "@trails-cool/gpx";
import type { SportType } from "@trails-cool/db/schema/journal";

// A record-to-record timestamp gap larger than this starts a new segment in
// files without (reliable) timer events. Matches movingTime's MAX_GAP
// philosophy at a coarser grain.
const GAP_SPLIT_MS = 5 * 60 * 1000;

// --- Raw fit-file-parser shapes (only the fields we consume) ---

interface FitRecord {
  position_lat?: number; // degrees (parser converts semicircles)
  position_long?: number;
  altitude?: number;
  enhanced_altitude?: number;
  timestamp?: string | Date;
}

interface FitEvent {
  event?: string; // "timer"
  event_type?: string; // "stop_all" | "stop" | "start"
  timestamp?: string | Date;
}

interface FitSession {
  start_time?: string | Date;
  total_elapsed_time?: number; // seconds, wall-clock (includes pauses)
  total_timer_time?: number; // seconds, moving
  sport?: string;
  sub_sport?: string;
}

interface ParsedFit {
  records?: FitRecord[];
  events?: FitEvent[];
  sessions?: FitSession[];
}

/** A record that passed validation, with its timestamp resolved to epoch ms. */
interface ValidPoint {
  lat: number;
  lon: number;
  ele?: number;
  t: number; // epoch ms
  time: string; // ISO 8601
}

export interface FitConversion {
  /** GPX string, or null when the file has no usable GPS track. */
  gpx: string | null;
  /** The file's sport mapped to a Journal SportType, or null if unknown. */
  sport: SportType | null;
}

function parse(buffer: Buffer): Promise<ParsedFit> {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({ force: true });
    // fit-file-parser's typing requires `Buffer<ArrayBuffer>` specifically;
    // a generic Node `Buffer` is structurally `Buffer<ArrayBufferLike>`.
    // The runtime accepts either, so coerce the underlying buffer slot.
    parser.parse(buffer as Buffer<ArrayBuffer>, (error, data) => {
      if (error) reject(error);
      else resolve((data ?? {}) as ParsedFit);
    });
  });
}

function toMillis(value: string | Date | undefined): number | null {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

/**
 * Validate + normalize one record. Drops records with missing/non-finite/
 * out-of-range coordinates or no timestamp; prefers enhanced altitude; treats
 * non-finite altitude as absent (point kept). Records without a position are
 * dropped (indoor/no-GPS samples never become track points).
 */
function toValidPoint(r: FitRecord): ValidPoint | null {
  const { position_lat: lat, position_long: lon } = r;
  if (lat == null || lon == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  const t = toMillis(r.timestamp);
  if (t === null) return null; // FIT records are timestamped by spec; absence = corruption

  const rawEle = r.enhanced_altitude ?? r.altitude;
  const ele = typeof rawEle === "number" && Number.isFinite(rawEle) ? rawEle : undefined;

  return { lat, lon, ele, t, time: new Date(t).toISOString() };
}

/** Split a session's ordered points at pauses (timer stops) and long gaps. */
function splitByPausesAndGaps(points: ValidPoint[], stopTimes: number[]): ValidPoint[][] {
  const segments: ValidPoint[][] = [];
  let current: ValidPoint[] = [];
  for (const p of points) {
    if (current.length > 0) {
      const prev = current[current.length - 1]!;
      const gap = p.t - prev.t > GAP_SPLIT_MS;
      const pausedBetween = stopTimes.some((ts) => ts >= prev.t && ts < p.t);
      if (gap || pausedBetween) {
        segments.push(current);
        current = [];
      }
    }
    current.push(p);
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

/** `[start, end]` epoch-ms windows per session, sorted by start. */
function sessionWindows(sessions: FitSession[]): Array<[number, number]> {
  const starts = sessions
    .map((s) => ({
      start: toMillis(s.start_time),
      dur: s.total_elapsed_time ?? s.total_timer_time,
    }))
    .filter((s): s is { start: number; dur: number | undefined } => s.start !== null)
    .sort((a, b) => a.start - b.start);

  return starts.map(({ start, dur }, i) => {
    const end =
      typeof dur === "number" && Number.isFinite(dur)
        ? start + dur * 1000 + 1000 // +1s tolerance for rounding
        : i + 1 < starts.length
          ? starts[i + 1]!.start - 1
          : Number.POSITIVE_INFINITY;
    return [start, end] as [number, number];
  });
}

function buildSegments(
  points: ValidPoint[],
  sessions: FitSession[],
  events: FitEvent[],
): ValidPoint[][] {
  const sorted = [...points].sort((a, b) => a.t - b.t);

  const stopTimes = events
    .filter((e) => e.event === "timer" && (e.event_type === "stop_all" || e.event_type === "stop"))
    .map((e) => toMillis(e.timestamp))
    .filter((t): t is number => t !== null);

  const windows = sessionWindows(sessions);
  if (windows.length === 0) {
    // No session info — one implicit session covering all points.
    return splitByPausesAndGaps(sorted, stopTimes);
  }

  const segments: ValidPoint[][] = [];
  for (const [start, end] of windows) {
    const inWindow = sorted.filter((p) => p.t >= start && p.t <= end);
    for (const seg of splitByPausesAndGaps(inWindow, stopTimes)) segments.push(seg);
  }
  return segments;
}

/**
 * Map the file's session sport/sub-sport to a Journal SportType. First session
 * wins (multisport still imports as one activity). Returns null when there's no
 * session or the sport is generic/unknown, so callers can fall back to the
 * provider's own type.
 */
function mapSport(sessions: FitSession[]): SportType | null {
  const s = sessions[0];
  if (!s) return null;
  const sport = String(s.sport ?? "").toLowerCase();
  const sub = String(s.sub_sport ?? "").toLowerCase();

  // Sub-sport refinements take precedence over the base sport.
  if (sub.includes("trail")) return "run";
  if (sub.includes("gravel")) return "gravel";
  if (sub.includes("mountain")) return "mtb";
  if (sub.includes("backcountry") || sub.includes("alpine")) return "ski";

  switch (sport) {
    case "running":
      return "run";
    case "cycling":
      return "ride";
    case "hiking":
    case "mountaineering":
      return "hike";
    case "walking":
      return "walk";
    case "alpine_skiing":
    case "cross_country_skiing":
    case "backcountry_skiing":
    case "skiing":
      return "ski";
    case "":
    case "generic":
      return null;
    default:
      return "other";
  }
}

export async function fitToGpx(buffer: Buffer, name: string): Promise<FitConversion> {
  const parsed = await parse(buffer);
  const records = parsed.records ?? [];
  const events = parsed.events ?? [];
  const sessions = parsed.sessions ?? [];

  const sport = mapSport(sessions);

  const points = records
    .map(toValidPoint)
    .filter((p): p is ValidPoint => p !== null);

  if (points.length < 2) return { gpx: null, sport };

  const tracks: TrackPoint[][] = buildSegments(points, sessions, events)
    .map((seg) => seg.map((p): TrackPoint => ({ lat: p.lat, lon: p.lon, ele: p.ele, time: p.time })))
    // A lone point isn't a drawable track segment; GPX needs >= 2 per <trkseg>.
    .filter((seg) => seg.length >= 2);

  if (tracks.length === 0) return { gpx: null, sport };
  return { gpx: generateGpx({ name, tracks }), sport };
}
