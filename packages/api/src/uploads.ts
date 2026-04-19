import { z } from "zod";

export const PresignedUploadRequestSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  resourceType: z.enum(["route", "activity"]),
  resourceId: z.uuid(),
});

export const PresignedUploadResponseSchema = z.object({
  uploadUrl: z.url(),
  storageKey: z.string(),
  expiresAt: z.iso.datetime(),
});

export type PresignedUploadRequest = z.infer<typeof PresignedUploadRequestSchema>;
export type PresignedUploadResponse = z.infer<typeof PresignedUploadResponseSchema>;
