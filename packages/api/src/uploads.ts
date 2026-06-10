import { z } from "zod";

/**
 * Content types accepted for uploads. Constrained so a caller can't
 * stash active content (HTML/SVG/JS) that would execute if the object
 * were ever served inline. Keep in sync with what the upload UI sends.
 */
export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/gpx+xml",
] as const;

export const PresignedUploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_UPLOAD_CONTENT_TYPES),
  resourceType: z.enum(["route", "activity"]),
  resourceId: z.uuid(),
});

/**
 * Reduce a client-supplied filename to a safe S3 object-key segment:
 * basename only (drop any path), restrict to a conservative charset,
 * collapse runs, strip leading dots, and bound the length. Never empty.
 */
export function sanitizeUploadFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 128);
  return cleaned.length > 0 ? cleaned : "upload";
}

export const PresignedUploadResponseSchema = z.object({
  uploadUrl: z.url(),
  storageKey: z.string(),
  expiresAt: z.iso.datetime(),
});

export type PresignedUploadRequest = z.infer<typeof PresignedUploadRequestSchema>;
export type PresignedUploadResponse = z.infer<typeof PresignedUploadResponseSchema>;
