import { z } from "zod";

/**
 * Distance-weighted surface/waytype breakdown (metres per category). Shared
 * wire shape for the planner→journal handoff and the route/activity read APIs.
 * Mirrors `SurfaceBreakdown` in `@trails-cool/map-core`.
 */
const MetresByCategory = z.record(z.string(), z.number().min(0));

export const SurfaceBreakdownSchema = z.object({
  surface: MetresByCategory,
  highway: MetresByCategory,
});

export type SurfaceBreakdown = z.infer<typeof SurfaceBreakdownSchema>;
