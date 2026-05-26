// Shared FIT file → GPX converter for provider importers.
//
// FIT is an open standard (Garmin/ANT+) used by Wahoo, Garmin, Coros, and
// others. This module is shared across all providers that produce FIT files
// so the conversion logic lives in one place.

import FitParser from "fit-file-parser";
import { generateGpx } from "@trails-cool/gpx";

export async function fitToGpx(buffer: Buffer, name: string): Promise<string | null> {
  const parsed = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const parser = new FitParser({ force: true });
    // fit-file-parser's typing requires `Buffer<ArrayBuffer>` specifically;
    // a generic Node `Buffer` is structurally `Buffer<ArrayBufferLike>`.
    // The runtime accepts either, so coerce the underlying buffer slot.
    parser.parse(buffer as Buffer<ArrayBuffer>, (error, data) => {
      if (error) reject(error);
      else resolve((data ?? {}) as Record<string, unknown>);
    });
  });

  const records = (parsed.records ?? []) as Array<{
    position_lat?: number;
    position_long?: number;
    altitude?: number;
    timestamp?: string | Date;
  }>;

  const trackPoints = records
    .filter((r) => r.position_lat != null && r.position_long != null)
    .map((r) => ({
      lat: r.position_lat!,
      lon: r.position_long!,
      ele: r.altitude,
      time: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
    }));

  if (trackPoints.length < 2) return null;
  return generateGpx({ name, tracks: [trackPoints] });
}
