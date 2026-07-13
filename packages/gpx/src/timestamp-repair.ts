import type { TrackPoint } from "./types.ts";

// Post-parse timestamp repair (spec: gpx-parser-robustness "Timestamp
// repair"). Recorders from flaky devices emit runs of missing or garbage
// `<time>` values; passed through raw they silently shrink moving time and
// skew start-time derivation. This is a pure per-segment pass with an
// explicit policy, so `movingTime`/`computeDays`/`startTime` stay correct
// without each re-implementing (and drifting on) the same rules.
//
// Policy:
//   - Validity = `Date.parse` yields a finite epoch.
//   - A segment with NO valid timestamps is left untouched (an untimed
//     track — downstream already handles that).
//   - > 50% of a segment's points invalid → drop ALL of that segment's
//     timestamps (a mostly-broken time channel is noise, not signal).
//   - Otherwise → linearly interpolate invalid runs between their valid
//     neighbours; a leading/trailing invalid run clamps to the nearest
//     valid timestamp. Only repaired points are rewritten (as ISO 8601);
//     valid points keep their original string untouched.
//
// Monotonicity is deliberately not enforced — `movingTime` already skips
// non-positive intervals, and reordering recorded data would be fabrication.

function epochOf(time: string | undefined): number {
  return time == null ? NaN : Date.parse(time);
}

export function repairSegmentTimestamps(points: TrackPoint[]): TrackPoint[] {
  const epochs = points.map((p) => epochOf(p.time));
  const validIdx = epochs.map((e, i) => (Number.isFinite(e) ? i : -1)).filter((i) => i >= 0);

  // Nothing to anchor to, or the time channel is mostly broken → treat the
  // segment as untimed. (When there are zero valid timestamps this leaves
  // the already-absent times as-is.)
  if (validIdx.length === 0) return points;
  const invalidCount = points.length - validIdx.length;
  if (invalidCount === 0) return points; // all valid → untouched
  if (invalidCount / points.length > 0.5) {
    return points.map((p) => (p.time === undefined ? p : { ...p, time: undefined }));
  }

  const firstValid = validIdx[0]!;
  const lastValid = validIdx[validIdx.length - 1]!;

  return points.map((p, i) => {
    if (Number.isFinite(epochs[i]!)) return p; // valid → keep original string
    let t: number;
    if (i < firstValid) {
      t = epochs[firstValid]!; // leading run clamps forward
    } else if (i > lastValid) {
      t = epochs[lastValid]!; // trailing run clamps back
    } else {
      // Between two valid anchors: linear interpolation by point index.
      let prev = i;
      while (!Number.isFinite(epochs[prev]!)) prev--;
      let next = i;
      while (!Number.isFinite(epochs[next]!)) next++;
      const frac = (i - prev) / (next - prev);
      t = epochs[prev]! + (epochs[next]! - epochs[prev]!) * frac;
    }
    return { ...p, time: new Date(t).toISOString() };
  });
}

export function repairTimestamps(segments: TrackPoint[][]): TrackPoint[][] {
  return segments.map(repairSegmentTimestamps);
}
