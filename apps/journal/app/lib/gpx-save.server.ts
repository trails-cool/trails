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
