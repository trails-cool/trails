import type { Route } from "./+types/api.v1.auth.devices.$id";
import { requireApiUser, apiError } from "~/lib/api-guard.server";
import { eq, and, isNull } from "drizzle-orm";
import { getDb } from "~/lib/db";
import { oauthTokens } from "@trails-cool/db/schema/journal";
import { ERROR_CODES } from "@trails-cool/api";

/** DELETE /api/v1/auth/devices/:id — revoke a device token */
export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "DELETE") return new Response(null, { status: 405 });
  const user = await requireApiUser(request);
  const db = getDb();

  const [token] = await db
    .select({ id: oauthTokens.id })
    .from(oauthTokens)
    .where(
      and(
        eq(oauthTokens.id, params.id),
        eq(oauthTokens.userId, user.id),
        isNull(oauthTokens.revokedAt),
      ),
    );

  if (!token) {
    return apiError(404, ERROR_CODES.NOT_FOUND, "Device not found");
  }

  await db
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(eq(oauthTokens.id, params.id));

  return new Response(null, { status: 204 });
}
