import { z } from "zod";

export const DiscoveryResponseSchema = z.object({
  apiVersion: z.string(),
  instanceName: z.string(),
  apiBaseUrl: z.url(),
  tileUrl: z.url().optional(),
});

export type DiscoveryResponse = z.infer<typeof DiscoveryResponseSchema>;
