import { sql } from "drizzle-orm";
import type { Database } from "@trails-cool/db";
import { parseGpxAsync } from "@trails-cool/gpx";
import type { GpxData } from "@trails-cool/gpx";

// Re-export so callers only need one import.
export type { GpxData };

export class GpxValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GpxValidationError";
  }
}

/**
 * Parse and validate a GPX string. Returns the parsed data so callers
 * don't need to parse again for stat extraction. Throws GpxValidationError
 * when the GPX is malformed, has fewer than 2 track points, or contains
 * out-of-range coordinates.
 */
export async function validateGpx(gpx: string): Promise<GpxData> {
  let parsed: GpxData;
  try {
    parsed = await parseGpxAsync(gpx);
  } catch (e) {
    throw new GpxValidationError(`GPX parse failed: ${(e as Error).message}`);
  }

  const points = parsed.tracks.flat();
  if (points.length < 2) {
    throw new GpxValidationError(
      `GPX must contain at least 2 track points (got ${points.length})`,
    );
  }

  for (const p of points) {
    if (p.lat < -90 || p.lat > 90 || p.lon < -180 || p.lon > 180) {
      throw new GpxValidationError(
        `GPX contains out-of-range coordinates: lat=${p.lat}, lon=${p.lon}`,
      );
    }
  }

  return parsed;
}

export interface GpxStats {
  distance: number | null;
  elevationGain: number | null;
  elevationLoss: number | null;
  /** Indices of waypoints flagged as day breaks. */
  dayBreaks: number[];
  /** GPX-level description, when present. */
  description?: string;
  /** Timestamp of the first track point, when present. */
  startTime: Date | null;
}

export interface ProcessedGpx {
  parsed: GpxData;
  /** [lon, lat] pairs in PostGIS axis order, ready for writeGeom. */
  coords: Array<[number, number]>;
  stats: GpxStats;
}

/**
 * The validate-and-derive step every GPX save starts with: parse +
 * validate (throws GpxValidationError), extract the geometry
 * coordinates, and derive the stats rows store. Callers own the
 * precedence between these derived stats and caller-supplied ones —
 * routes let explicit input win wholesale, activities prefer the GPX
 * distance unless it is zero.
 */
export async function processGpx(gpx: string): Promise<ProcessedGpx> {
  const parsed = await validateGpx(gpx);
  return {
    parsed,
    coords: parsed.tracks.flat().map((p) => [p.lon, p.lat] as [number, number]),
    stats: {
      distance: parsed.distance ?? null,
      elevationGain: parsed.elevation.gain ?? null,
      elevationLoss: parsed.elevation.loss ?? null,
      dayBreaks: parsed.waypoints
        .map((w, i) => (w.isDayBreak ? i : -1))
        .filter((i) => i >= 0),
      description: parsed.description,
      startTime: parsed.tracks[0]?.[0]?.time ? new Date(parsed.tracks[0][0].time) : null,
    },
  };
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Write a PostGIS LineString geometry from already-validated track points.
 * Must be called inside a db.transaction() — the tx client is required so
 * the geometry write participates in the enclosing transaction.
 * Throws on failure; callers must NOT swallow the error.
 */
export async function writeGeom(
  tx: Tx,
  id: string,
  table: "routes" | "activities",
  coords: Array<[number, number]>,
): Promise<void> {
  const geojson = JSON.stringify({ type: "LineString", coordinates: coords });
  await tx.execute(
    sql`UPDATE ${sql.identifier("journal")}.${sql.identifier(table)} SET geom = ST_GeomFromGeoJSON(${geojson}) WHERE id = ${id}`,
  );
}
