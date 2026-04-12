import { z } from "zod";

export const PresignedUploadRequestSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  resourceType: z.enum(["route", "activity"]),
  resourceId: z.string().uuid(),
});

export const PresignedUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  storageKey: z.string(),
  expiresAt: z.string().datetime(),
});

export type PresignedUploadRequest = z.infer<typeof PresignedUploadRequestSchema>;
export type PresignedUploadResponse = z.infer<typeof PresignedUploadResponseSchema>;
