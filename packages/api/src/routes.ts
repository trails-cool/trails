import { z } from "zod";

/** Route summary for list views */
export const RouteSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  distance: z.number().nullable(),
  elevationGain: z.number().nullable(),
  elevationLoss: z.number().nullable(),
  routingProfile: z.string().nullable(),
  dayBreaks: z.array(z.number()),
  geojson: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** Route version info */
export const RouteVersionSchema = z.object({
  version: z.number(),
  changeDescription: z.string().nullable(),
  createdAt: z.string().datetime(),
});

/** Full route detail */
export const RouteDetailSchema = RouteSummarySchema.extend({
  gpx: z.string().nullable(),
  versions: z.array(RouteVersionSchema),
});

/** Paginated route list response */
export const RouteListResponseSchema = z.object({
  routes: z.array(RouteSummarySchema),
  nextCursor: z.string().nullable(),
});

/** Create route request */
export const CreateRouteRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).default(""),
  gpx: z.string().optional(),
  routingProfile: z.string().optional(),
});

/** Update route request */
export const UpdateRouteRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  gpx: z.string().optional(),
});

/** Compute route request (BRouter proxy) */
export const ComputeRouteRequestSchema = z.object({
  waypoints: z.array(z.object({
    lat: z.number(),
    lon: z.number(),
  })).min(2),
  profile: z.string().default("fastbike"),
  noGoAreas: z.array(z.object({
    points: z.array(z.object({
      lat: z.number(),
      lon: z.number(),
    })),
  })).optional(),
});

export type RouteSummary = z.infer<typeof RouteSummarySchema>;
export type RouteVersion = z.infer<typeof RouteVersionSchema>;
export type RouteDetail = z.infer<typeof RouteDetailSchema>;
export type RouteListResponse = z.infer<typeof RouteListResponseSchema>;
export type CreateRouteRequest = z.infer<typeof CreateRouteRequestSchema>;
export type UpdateRouteRequest = z.infer<typeof UpdateRouteRequestSchema>;
export type ComputeRouteRequest = z.infer<typeof ComputeRouteRequestSchema>;
