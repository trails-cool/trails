import { z } from "zod";

/** Activity summary for list views */
export const ActivitySummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  routeId: z.string().uuid().nullable(),
  routeName: z.string().nullable(),
  distance: z.number().nullable(),
  duration: z.number().nullable(),
  elevationGain: z.number().nullable(),
  elevationLoss: z.number().nullable(),
  startedAt: z.string().datetime().nullable(),
  geojson: z.string().nullable(),
  createdAt: z.string().datetime(),
});

/** Full activity detail */
export const ActivityDetailSchema = ActivitySummarySchema.extend({
  gpx: z.string().nullable(),
  photos: z.array(z.string().url()),
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
  gpx: z.string().optional(),
  routeId: z.string().uuid().optional(),
  startedAt: z.string().datetime().optional(),
  duration: z.number().optional(),
  distance: z.number().optional(),
});

export type ActivitySummary = z.infer<typeof ActivitySummarySchema>;
export type ActivityDetail = z.infer<typeof ActivityDetailSchema>;
export type ActivityListResponse = z.infer<typeof ActivityListResponseSchema>;
export type CreateActivityRequest = z.infer<typeof CreateActivityRequestSchema>;
