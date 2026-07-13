// Elevation cleaning primitives (spec: elevation-profile-hardening).
// GPS/barometric altitude jitters by a few metres per point, so summing
// every positive delta overstates ascent by 20–50% on long activities,
// and single-point spikes distort the profile chart. These two pure
// functions — adapted from Organic Maps' SmoothSlopeOutliers +
// hysteresis ascent bookkeeping — are applied once so the headline stats
// and the chart derive from the same cleaned sequence.
//
// Both operate on a `{ distance, elevation }` sequence (metres), one
// track segment at a time — callers must NOT concatenate segments across
// `trkseg` gaps, or a despike would interpolate over a real discontinuity.

export interface ElevPoint {
  distance: number;
  elevation: number;
}

/** Slope of a genuinely steep climb, in percent (45° = 100%). Above this,
 * an isolated opposite-sign pair reads as a recorder spike, not terrain. */
export const MAX_SLOPE_PERCENT = 100;

/** Altitude jitter band, in metres, below which change is treated as noise
 * (typical barometric wobble). */
export const NOISE_THRESHOLD_M = 5;

function slopePercent(from: ElevPoint, to: ElevPoint): number {
  const run = to.distance - from.distance;
  const rise = to.elevation - from.elevation;
  if (run <= 0) return rise === 0 ? 0 : rise > 0 ? Infinity : -Infinity;
  return (rise / run) * 100;
}

/**
 * Replace isolated peak/pit spikes with linear interpolation. A point is a
 * spike iff the slope to its previous neighbour and the slope to its next
 * neighbour both exceed `maxSlopePercent` in magnitude AND have opposite
 * signs (an isolated up-then-down or down-then-up). Genuinely steep
 * terrain climbs monotonically (same-sign slopes) and is never touched.
 */
export function despike(
  points: ElevPoint[],
  opts?: { maxSlopePercent?: number },
): ElevPoint[] {
  const max = opts?.maxSlopePercent ?? MAX_SLOPE_PERCENT;
  if (points.length < 3) return points.map((p) => ({ ...p }));
  const out = points.map((p) => ({ ...p }));
  for (let i = 1; i < out.length - 1; i++) {
    const prevSlope = slopePercent(out[i - 1]!, out[i]!);
    const nextSlope = slopePercent(out[i]!, out[i + 1]!);
    const bothSteep = Math.abs(prevSlope) > max && Math.abs(nextSlope) > max;
    const oppositeSign = prevSlope > 0 !== nextSlope > 0;
    if (bothSteep && oppositeSign) {
      const a = out[i - 1]!;
      const b = out[i + 1]!;
      const span = b.distance - a.distance;
      const frac = span > 0 ? (out[i]!.distance - a.distance) / span : 0.5;
      out[i]!.elevation = a.elevation + (b.elevation - a.elevation) * frac;
    }
  }
  return out;
}

export interface ElevationTotals {
  /** Filtered ascent (raw when filtering removed everything but raw > 0). */
  gain: number;
  /** Filtered descent (raw fallback, as above). */
  loss: number;
  /** Unfiltered sum of positive deltas. */
  gainRaw: number;
  /** Unfiltered sum of negative deltas (positive number). */
  lossRaw: number;
}

/**
 * Ascent/descent via hysteresis: accumulate only once altitude deviates
 * from a moving reference by more than `noiseThresholdM`, then move the
 * reference — suppressing sub-threshold jitter while capturing every real
 * climb/descent larger than the threshold.
 *
 * Fallback: when a direction filters to exactly zero, report the NET
 * change (end − start) in that direction rather than the raw sum-of-deltas.
 * The design's literal "report raw" would resurrect the very jitter we
 * removed (a ±2 m wobble sums to several metres of raw "gain"); netting to
 * ~0 satisfies "±2 m jitter → 0 totals" while a genuine small net climb
 * taken in sub-threshold steps still surfaces. `gainRaw`/`lossRaw` remain
 * the unfiltered sums for transparency.
 */
export function filteredTotals(
  points: ElevPoint[],
  opts?: { noiseThresholdM?: number },
): ElevationTotals {
  const threshold = opts?.noiseThresholdM ?? NOISE_THRESHOLD_M;
  let gain = 0;
  let loss = 0;
  let gainRaw = 0;
  let lossRaw = 0;
  if (points.length > 0) {
    let ref = points[0]!.elevation;
    for (let i = 1; i < points.length; i++) {
      const delta = points[i]!.elevation - points[i - 1]!.elevation;
      if (delta > 0) gainRaw += delta;
      else lossRaw += -delta;
      const dev = points[i]!.elevation - ref;
      if (dev > threshold) {
        gain += dev;
        ref = points[i]!.elevation;
      } else if (dev < -threshold) {
        loss += -dev;
        ref = points[i]!.elevation;
      }
    }
  }
  const net =
    points.length > 0 ? points[points.length - 1]!.elevation - points[0]!.elevation : 0;
  return {
    gain: gain > 0 ? gain : Math.max(0, net),
    loss: loss > 0 ? loss : Math.max(0, -net),
    gainRaw,
    lossRaw,
  };
}

/**
 * Running filtered ascent/descent at every point index (same hysteresis as
 * {@link filteredTotals}), so per-day splits can take `cumulative[end] −
 * cumulative[start]` and have the day totals sum to the route total by
 * construction. Both arrays have the same length as `points`; index 0 is 0.
 * No raw fallback here — cumulative arrays feed differences, not a headline.
 */
export function cumulativeFilteredTotals(
  points: ElevPoint[],
  opts?: { noiseThresholdM?: number },
): { ascent: number[]; descent: number[] } {
  const threshold = opts?.noiseThresholdM ?? NOISE_THRESHOLD_M;
  const ascent: number[] = [];
  const descent: number[] = [];
  let gain = 0;
  let loss = 0;
  let ref = points.length > 0 ? points[0]!.elevation : 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      const dev = points[i]!.elevation - ref;
      if (dev > threshold) {
        gain += dev;
        ref = points[i]!.elevation;
      } else if (dev < -threshold) {
        loss += -dev;
        ref = points[i]!.elevation;
      }
    }
    ascent.push(gain);
    descent.push(loss);
  }
  return { ascent, descent };
}
