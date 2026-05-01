import { redirect, data } from "react-router";
import type { Route } from "./+types/api.sync.disconnect.$provider";
import { getSessionUser } from "~/lib/auth.server";
import { getProvider } from "~/lib/sync/registry";
import { deleteConnection, getConnection } from "~/lib/sync/connections.server";

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");

  const provider = getProvider(params.provider);
  if (!provider) return data({ error: "Unknown provider" }, { status: 404 });

  if (provider.revoke) {
    const conn = await getConnection(user.id, provider.id);
    if (conn) {
      try {
        await provider.revoke({
          accessToken: conn.accessToken,
          refreshToken: conn.refreshToken,
          expiresAt: conn.expiresAt,
        });
      } catch (e) {
        // Best-effort: token may already be expired/revoked. Drop the local row regardless.
        console.warn(`Failed to revoke ${provider.id} token (continuing with disconnect):`, e);
      }
    }
  }

  await deleteConnection(user.id, provider.id);
  return redirect("/settings");
}
