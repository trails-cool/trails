import { z } from "zod";

/**
 * Sport / activity type. Must stay in sync with `SPORT_TYPES` in
 * `@trails-cool/db` (schema/journal.ts) — this package is intentionally
 * standalone (zod only), so the wire enum is mirrored here.
 */
export const SPORT_TYPES = [
  "hike",
  "walk",
  "run",
  "ride",
  "gravel",
  "mtb",
  "ski",
  "other",
] as const;
export const SportTypeSchema = z.enum(SPORT_TYPES);
export type SportType = z.infer<typeof SportTypeSchema>;

/** Activity summary for list views */
export const ActivitySummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  sportType: SportTypeSchema.nullable(),
  routeId: z.uuid().nullable(),
  routeName: z.string().nullable(),
  distance: z.number().nullable(),
  duration: z.number().nullable(),
  elevationGain: z.number().nullable(),
  elevationLoss: z.number().nullable(),
  startedAt: z.iso.datetime().nullable(),
  geojson: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

/** Full activity detail */
export const ActivityDetailSchema = ActivitySummarySchema.extend({
  gpx: z.string().nullable(),
  photos: z.array(z.url()),
});

/** Paginated activity list response */
export const ActivityListResponseSchema = z.object({
  activities: z.array(ActivitySummarySchema),
  nextCursor: z.string().nullable(),
});

/** Create activity request */
export const CreateActivityRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).default(""),
  sportType: SportTypeSchema.optional(),
  gpx: z.string().optional(),
  routeId: z.uuid().optional(),
  startedAt: z.iso.datetime().optional(),
  duration: z.number().optional(),
  distance: z.number().optional(),
});

/** Response to POST /api/v1/activities */
export const CreateActivityResponseSchema = z.object({ id: z.uuid() });

export type ActivitySummary = z.infer<typeof ActivitySummarySchema>;
export type CreateActivityResponse = z.infer<typeof CreateActivityResponseSchema>;
export type ActivityDetail = z.infer<typeof ActivityDetailSchema>;
export type ActivityListResponse = z.infer<typeof ActivityListResponseSchema>;
export type CreateActivityRequest = z.infer<typeof CreateActivityRequestSchema>;
