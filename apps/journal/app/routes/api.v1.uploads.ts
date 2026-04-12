import type { Route } from "./+types/api.v1.uploads";
import { requireApiUser, apiError } from "~/lib/api-guard.server";
import { PresignedUploadRequestSchema, ERROR_CODES } from "@trails-cool/api";
import { randomUUID } from "node:crypto";

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:3902";
const S3_BUCKET = process.env.S3_BUCKET ?? "trails-cool";
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL ?? S3_ENDPOINT;

/** POST /api/v1/uploads — generate presigned upload URL */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  await requireApiUser(request);

  const body = await request.json().catch(() => null);
  const parsed = PresignedUploadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, ERROR_CODES.VALIDATION_ERROR, "Validation failed",
      parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })));
  }

  const { filename, resourceType, resourceId } = parsed.data;
  const key = `${resourceType}/${resourceId}/${randomUUID()}-${filename}`;

  // Return the upload URL and the final public URL
  return Response.json({
    uploadUrl: `${S3_ENDPOINT}/${S3_BUCKET}/${key}`,
    publicUrl: `${S3_PUBLIC_URL}/${S3_BUCKET}/${key}`,
    key,
  });
}
