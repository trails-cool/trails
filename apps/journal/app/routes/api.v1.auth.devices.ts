import type { Route } from "./+types/api.v1.auth.devices";
import { requireApiUser } from "~/lib/api-guard.server";
import { eq, and, isNull } from "drizzle-orm";
import { getDb } from "~/lib/db";
import { oauthTokens } from "@trails-cool/db/schema/journal";

/** GET /api/v1/auth/devices — list connected devices */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  const db = getDb();

  const tokens = await db
    .select({
      id: oauthTokens.id,
      deviceName: oauthTokens.deviceName,
      lastActiveAt: oauthTokens.lastActiveAt,
      createdAt: oauthTokens.createdAt,
    })
    .from(oauthTokens)
    .where(
      and(
        eq(oauthTokens.userId, user.id),
        isNull(oauthTokens.revokedAt),
      ),
    );

  // Determine which token is the current one (from the bearer token)
  const authHeader = request.headers.get("Authorization");
  const currentToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let currentTokenId: string | null = null;
  if (currentToken) {
    const [match] = await db
      .select({ id: oauthTokens.id })
      .from(oauthTokens)
      .where(eq(oauthTokens.accessToken, currentToken));
    currentTokenId = match?.id ?? null;
  }

  return Response.json({
    devices: tokens.map((t) => ({
      id: t.id,
      deviceName: t.deviceName ?? "Unknown device",
      lastActiveAt: t.lastActiveAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      isCurrent: t.id === currentTokenId,
    })),
  });
}
