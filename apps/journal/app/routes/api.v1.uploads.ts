import type { Route } from "./+types/api.v1.uploads";
import { requireApiUser, apiError } from "~/lib/api-guard.server";
import {
  PresignedUploadRequestSchema,
  sanitizeUploadFilename,
  ERROR_CODES,
  zodIssuesToFieldErrors,
} from "@trails-cool/api";
import { randomUUID } from "node:crypto";
import { loadOwnedRoute, loadOwnedActivity } from "~/lib/ownership.server";

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:3902";
const S3_BUCKET = process.env.S3_BUCKET ?? "trails-cool";
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL ?? S3_ENDPOINT;

/** POST /api/v1/uploads — generate presigned upload URL */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const user = await requireApiUser(request);

  const body = await request.json().catch(() => null);
  // The schema enforces a content-type allowlist (no active content that
  // could execute if served inline) and a bounded filename.
  const parsed = PresignedUploadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, ERROR_CODES.VALIDATION_ERROR, "Validation failed",
      zodIssuesToFieldErrors(parsed.error));
  }

  const { filename, resourceType, resourceId } = parsed.data;

  // Authorization: a caller may only mint upload URLs for a route or
  // activity they own. Without this, anyone could write objects into the
  // key-space of another user's resource. 404 (not 403) so a guessed id
  // doesn't reveal the resource exists.
  const owned = resourceType === "route"
    ? await loadOwnedRoute(resourceId, user.id)
    : await loadOwnedActivity(resourceId, user.id);
  if (!owned.ok) {
    return apiError(404, ERROR_CODES.NOT_FOUND, `${resourceType} not found`);
  }

  // Sanitize the client filename before it becomes part of the S3 key.
  const safeName = sanitizeUploadFilename(filename);
  const key = `${resourceType}/${resourceId}/${randomUUID()}-${safeName}`;

  // Return the upload URL and the final public URL
  return Response.json({
    uploadUrl: `${S3_ENDPOINT}/${S3_BUCKET}/${key}`,
    publicUrl: `${S3_PUBLIC_URL}/${S3_BUCKET}/${key}`,
    key,
  });
}
